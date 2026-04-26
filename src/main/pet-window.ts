// Pet Window Manager — Transparent frameless window for desktop mascot
// Integrates SettingsStore, expanded right-click menu, settings window

import { BrowserWindow, screen, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { TTSEngine } from './tts-engine';
import { SherpaEngine } from './sherpa-engine';
import { HermesBridge } from './hermes-bridge';
import { SettingsStore } from './settings-store';
import { AppSettings, TTS_VOICES, IPC_CHANNELS } from '../shared/types';

export class PetWindow {
  private window: BrowserWindow | null = null;
  private chatWindow: BrowserWindow | null = null;
  private settingsWin: BrowserWindow | null = null;
  private tts: TTSEngine;
  private sherpa: SherpaEngine;
  private hermes: HermesBridge;
  private settingsStore: SettingsStore;
  private petState: 'idle' | 'wake' | 'speak' | 'sleep' = 'idle';

  constructor(hermesBridge: HermesBridge, settingsStore: SettingsStore) {
    this.hermes = hermesBridge;
    this.settingsStore = settingsStore;

    const s = settingsStore.getAll();

    this.tts = new TTSEngine({
      voice: s.ttsVoice,
      rate: s.ttsRate,
      pitch: s.ttsPitch,
      volume: s.ttsVolume,
    });

    this.sherpa = new SherpaEngine({
      wakeWords: s.wakeWords,
      silenceTimeout: s.silenceTimeout,
    });

    // Apply backend config
    this.hermes.configure(s);

    this.setupSherpa();
    this.setupTTS();
    this.setupIPC();

    // Listen for settings changes (broadcast by SettingsStore)
    ipcMain.on(IPC_CHANNELS.SETTINGS_UPDATED, (_e, s: AppSettings) => {
      this.applySettings(s);
    });
  }

  // === Sherpa: Wake word → ASR → Hermes ===
  private setupSherpa(): void {
    this.sherpa.on('wake', ({ word }) => {
      console.log(`[Pet] Wake: "${word}"`);
      this.setState('wake');
      this.sendToPet('pet-status', '我在听~');
    });

    this.sherpa.on('asr-result', ({ text }) => {
      if (text?.trim()) this.sendToPet('pet-status', text);
    });

    this.sherpa.on('utterance-end', async ({ text }) => {
      console.log(`[Pet] Utterance: "${text}"`);
      this.setState('speak');

      try {
        const response = await this.hermes.sendMessage({
          id: Date.now().toString(),
          message: text,
        });
        console.log(`[Pet] Hermes: "${response.content}"`);
        await this.tts.speak(response.content);
      } catch (err: any) {
        console.error('[Pet] Hermes error:', err.message);
        this.tts.speak('主人，我好像卡住了，等一下再试吧~');
      }
      this.setState('idle');
    });

    this.sherpa.on('sleep', () => this.setState('sleep'));
    this.sherpa.on('warning', ({ message }) => console.warn('[Pet] Sherpa:', message));
    this.sherpa.on('error', (error) => console.error('[Pet] Sherpa error:', error));
  }

  // === TTS ===
  private setupTTS(): void {
    this.tts.on('start', ({ sentenceCount }) => {
      this.setState('speak');
      this.sendToPet('pet-status', `回复中... (${sentenceCount}句)`);
    });
    this.tts.on('sentence-start', ({ text }) => {
      this.sendToPet('pet-status', text.slice(0, 20) + (text.length > 20 ? '...' : ''));
    });
    this.tts.on('end', () => {
      if (this.petState === 'speak') this.setState('idle');
    });
  }

  // === IPC: Audio, Clicks, Drag ===
  private setupIPC(): void {
    ipcMain.on('audio-data', (_e, buffer: Buffer) => this.sherpa.feedAudio(buffer));
    ipcMain.on('mic-ready', () => console.log('[Pet] 🎤 Mic active'));
    ipcMain.on('mic-error', (_e, err: string) => {
      console.error('[Pet] Mic error:', err);
      this.sendToPet('pet-status', '⚠️ 麦克风权限未授予');
    });

    ipcMain.on('pet-double-click', () => this.openChatWindow());
    ipcMain.on('pet-click', () => {
      if (this.petState === 'sleep') { this.setState('wake'); setTimeout(() => this.setState('idle'), 2000); }
    });
    ipcMain.on('pet-drag', (_e, { dx, dy }) => {
      if (this.window) { const [x, y] = this.window.getPosition(); this.window.setPosition(x + dx, y + dy); }
    });
    ipcMain.on('pet-context-menu', () => this.showContextMenu());

    // Chat window messages
    ipcMain.handle('chat-send-message', async (_e, message: string) => {
      try {
        const res = await this.hermes.sendMessage({ id: Date.now().toString(), message });
        return res.content;
      } catch (err: any) { return `Error: ${err.message}`; }
    });
  }

  private applySettings(s: AppSettings): void {
    this.hermes.configure(s);
    this.sherpa.setWakeWords(s.wakeWords);
    this.tts.reconfigure({ voice: s.ttsVoice, rate: s.ttsRate, pitch: s.ttsPitch, volume: s.ttsVolume });
  }

  // === Pet Window ===
  createPetWindow(): void {
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const petW = 160, petH = 180;
    let x = screenW - petW - 20, y = screenH - petH - 40;

    const savedPos = this.settingsStore.get('petPosition');
    if (savedPos.x >= 0 && savedPos.y >= 0) { x = savedPos.x; y = savedPos.y; }

    this.window = new BrowserWindow({
      width: petW, height: petH, x, y,
      transparent: true, frame: false, alwaysOnTop: true,
      skipTaskbar: true, resizable: false, hasShadow: false, type: 'toolbar',
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });

    this.window.loadFile(path.join(__dirname, '../../../src/renderer/pet/pet.html'));
    this.window.setVisibleOnAllWorkspaces(true);
    this.window.setAlwaysOnTop(true, 'screen-saver');
    console.log('[Pet] Window at', x, y);
  }

  // === Chat Window ===
  private openChatWindow(): void {
    if (this.chatWindow && !this.chatWindow.isDestroyed()) { this.chatWindow.focus(); return; }

    this.chatWindow = new BrowserWindow({
      width: 480, height: 700, title: 'HiHermes Chat',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      this.chatWindow.loadURL('http://localhost:5173');
    } else {
      this.chatWindow.loadFile(path.join(__dirname, '../renderer/chat/index.html'));
    }
    this.chatWindow.on('closed', () => { this.chatWindow = null; });
  }

  // === Settings Window ===
  private openSettingsWindow(): void {
    if (this.settingsWin && !this.settingsWin.isDestroyed()) { this.settingsWin.focus(); return; }

    this.settingsWin = new BrowserWindow({
      width: 520, height: 620, title: 'HiHermes 设置',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // In dev, load vite; in prod, load a dedicated settings page
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      this.settingsWin.loadURL('http://localhost:5173/#/settings');
    } else {
      this.settingsWin.loadFile(path.join(__dirname, '../renderer/settings/index.html'));
    }
    this.settingsWin.on('closed', () => { this.settingsWin = null; });
  }

  // === Context Menu ===
  private showContextMenu(): void {
    const s = this.settingsStore.getAll();

    const template: Electron.MenuItemConstructorOptions[] = [
      { label: '💬 打开聊天窗口', click: () => this.openChatWindow() },
      { type: 'separator' },

      // Wake words submenu
      {
        label: '🎤 唤醒词',
        submenu: [
          ...s.wakeWords.map(w => ({
            label: `  ${w}`,
            type: 'radio' as const,
            checked: true,
          })),
          { type: 'separator' as const } as Electron.MenuItemConstructorOptions,
          { label: '✏️ 自定义...', click: () => this.openSettingsWindow() } as Electron.MenuItemConstructorOptions,
        ],
      },

      // TTS voice submenu
      {
        label: '🔊 语音',
        submenu: [
          ...TTS_VOICES.slice(0, 8).map(v => ({
            label: v.name,
            type: 'radio' as const,
            checked: s.ttsVoice === v.id,
            click: () => {
              this.settingsStore.set({ ttsVoice: v.id });
              this.tts.reconfigure({ voice: v.id });
            },
          })),
          { type: 'separator' as const } as Electron.MenuItemConstructorOptions,
          { label: '📋 更多语音...', click: () => this.openSettingsWindow() } as Electron.MenuItemConstructorOptions,
        ],
      },

      // TTS speed
      {
        label: '⚡ 语速',
        submenu: [
          { label: '🐌 慢 (-20%)', type: 'radio' as const, checked: s.ttsRate === '-20%', click: () => this.updateTTS('rate', '-20%') },
          { label: '🐢 较慢 (-10%)', type: 'radio' as const, checked: s.ttsRate === '-10%', click: () => this.updateTTS('rate', '-10%') },
          { label: '🚶 正常 (+0%)', type: 'radio' as const, checked: s.ttsRate === '+0%', click: () => this.updateTTS('rate', '+0%') },
          { label: '🏃 较快 (+10%)', type: 'radio' as const, checked: s.ttsRate === '+10%', click: () => this.updateTTS('rate', '+10%') },
          { label: '🚀 快 (+20%)', type: 'radio' as const, checked: s.ttsRate === '+20%', click: () => this.updateTTS('rate', '+20%') },
        ],
      },

      // Backend
      {
        label: '🔗 连接方式',
        submenu: [
          { label: '🌐 API Server (HTTP)', type: 'radio' as const, checked: s.backend === 'api-server', click: () => this.settingsStore.set({ backend: 'api-server' }) },
          { label: '🐧 WSL CLI', type: 'radio' as const, checked: s.backend === 'wsl-cli', click: () => this.settingsStore.set({ backend: 'wsl-cli' }) },
          { type: 'separator' as const },
          { label: '⚙️ 服务器地址...', click: () => this.openSettingsWindow() },
        ],
      },

      { type: 'separator' },

      // Quick actions
      {
        label: this.petState === 'sleep' ? '☀️ 唤醒' : '😴 休眠',
        click: () => {
          if (this.petState === 'sleep') { this.setState('wake'); setTimeout(() => this.setState('idle'), 1500); }
          else this.setState('sleep');
        },
      },
      { label: '🔊 语音测试', click: () => this.tts.speak('主人好呀！我是小赫，有什么可以帮你的吗？') },
      { label: '🔄 重置位置', click: () => this.resetPosition() },

      { type: 'separator' },

      { label: '⚙️ 全部设置...', click: () => this.openSettingsWindow() },
      { label: '❌ 退出', click: () => this.destroy() },
    ];

    const menu = Menu.buildFromTemplate(template);
    if (this.window) menu.popup({ window: this.window });
  }

  private updateTTS(field: 'rate' | 'pitch' | 'volume', value: string): void {
    this.settingsStore.set({ [`tts${field === 'rate' ? 'Rate' : 'Pitch'}`]: value } as any);
    this.tts.reconfigure({ [field]: value } as any);
  }

  private resetPosition(): void {
    if (!this.window) return;
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const x = sw - 180, y = sh - 220;
    this.window.setPosition(x, y);
    this.settingsStore.set({ petPosition: { x, y } });
  }

  // === State ===
  private setState(state: 'idle' | 'wake' | 'speak' | 'sleep'): void {
    this.petState = state;
    this.sendToPet('pet-state', state);
  }

  private sendToPet(channel: string, data: any): void {
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send(channel, data);
  }

  // === Lifecycle ===
  async start(): Promise<void> {
    this.createPetWindow();
    setTimeout(async () => {
      const ok = await this.sherpa.start();
      if (ok) this.sendToPet('pet-status', '说"小赫小赫"唤醒我~');
    }, 1500);
  }

  destroy(): void {
    // Save position before closing
    if (this.window && !this.window.isDestroyed()) {
      const [x, y] = this.window.getPosition();
      this.settingsStore.set({ petPosition: { x, y } });
    }
    this.sherpa.stop();
    this.tts.destroy();
    [this.chatWindow, this.settingsWin].forEach(w => { if (w && !w.isDestroyed()) w.close(); });
    if (this.window && !this.window.isDestroyed()) this.window.close();
  }
}
