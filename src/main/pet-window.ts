// Pet Window Manager — Transparent frameless window for desktop mascot

import { BrowserWindow, screen, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { TTSEngine } from './tts-engine';
import { SherpaEngine } from './sherpa-engine';
import { HermesBridge } from './hermes-bridge';

export class PetWindow {
  private window: BrowserWindow | null = null;
  private chatWindow: BrowserWindow | null = null;
  private tts: TTSEngine;
  private sherpa: SherpaEngine;
  private hermes: HermesBridge;
  private petState: 'idle' | 'wake' | 'speak' | 'sleep' = 'idle';

  constructor(hermesBridge: HermesBridge) {
    this.hermes = hermesBridge;

    this.tts = new TTSEngine({
      voice: 'zh-CN-XiaoyiNeural',  // 活泼女声，匹配 2B 桌宠人设
      rate: '+0%',
    });

    this.sherpa = new SherpaEngine({
      wakeWords: ['小赫', 'AI助手', '2B'],
    });

    this.setupSherpa();
    this.setupTTS();
    this.setupIPC();
  }

  // === Sherpa: Wake word → ASR → Hermes ===
  private setupSherpa(): void {
    this.sherpa.on('wake', ({ word }) => {
      console.log(`[Pet] Wake word: "${word}"`);
      this.setState('wake');
      this.sendToPet('pet-status', `听到啦！说"${word}"唤醒我了~`);
    });

    this.sherpa.on('asr-result', ({ text, isFinal }) => {
      // Show streaming ASR text on pet
      if (text && text.trim()) {
        this.sendToPet('pet-status', text);
      }
    });

    this.sherpa.on('utterance-end', async ({ text }) => {
      console.log(`[Pet] Utterance: "${text}"`);
      this.setState('speak');

      try {
        // Send to Hermes
        const response = await this.hermes.sendMessage({
          id: Date.now().toString(),
          message: text,
        });

        const reply = response.content;
        console.log(`[Pet] Hermes: "${reply}"`);

        // Speak the response via TTS (streaming by sentence)
        await this.tts.speak(reply);
      } catch (err: any) {
        console.error('[Pet] Hermes error:', err.message);
        this.tts.speak('主人，我好像卡住了，等一下再试吧~');
      }

      // Back to idle after responding
      this.setState('idle');
    });

    this.sherpa.on('sleep', () => {
      this.setState('sleep');
    });

    this.sherpa.on('warning', ({ message }) => {
      console.warn('[Pet] Sherpa warning:', message);
      // Sherpa not available — still functional, just no voice wake
    });

    this.sherpa.on('error', (error) => {
      console.error('[Pet] Sherpa error:', error);
    });
  }

  // === TTS Event Handlers ===
  private setupTTS(): void {
    this.tts.on('start', ({ sentenceCount }) => {
      this.setState('speak');
      this.sendToPet('pet-status', `回复中... (${sentenceCount}句)`);
    });

    this.tts.on('sentence-start', ({ index, total, text }) => {
      this.sendToPet('pet-status', text.slice(0, 20) + (text.length > 20 ? '...' : ''));
    });

    this.tts.on('end', () => {
      if (this.petState === 'speak') {
        this.setState('idle');
      }
    });
  }

  // === IPC Handlers ===
  private setupIPC(): void {
    // Double-click pet → open chat window
    ipcMain.on('pet-double-click', () => {
      this.openChatWindow();
    });

    // Single click → wake if sleeping
    ipcMain.on('pet-click', () => {
      if (this.petState === 'sleep') {
        this.setState('wake');
        setTimeout(() => this.setState('idle'), 2000);
      }
    });

    // Drag pet window
    ipcMain.on('pet-drag', (_event, { dx, dy }) => {
      if (this.window) {
        const [x, y] = this.window.getPosition();
        this.window.setPosition(x + dx, y + dy);
      }
    });

    // Context menu
    ipcMain.on('pet-context-menu', () => {
      this.showContextMenu();
    });

    // Chat window messages
    ipcMain.handle('chat-send-message', async (_event, message: string) => {
      try {
        const response = await this.hermes.sendMessage({
          id: Date.now().toString(),
          message,
        });
        return response.content;
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    });
  }

  // === Pet Window ===
  createPetWindow(): void {
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const petW = 160;
    const petH = 180;

    this.window = new BrowserWindow({
      width: petW,
      height: petH,
      x: screenW - petW - 20,    // bottom-right corner
      y: screenH - petH - 40,
      transparent: true,          // 🔥 transparent background
      frame: false,               // 🔥 no title bar
      alwaysOnTop: true,          // 🔥 stay on top
      skipTaskbar: true,          // no taskbar icon
      resizable: false,
      hasShadow: false,
      type: 'toolbar',            // stays above normal windows
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.window.loadFile(path.join(__dirname, '../../../src/renderer/pet/pet.html'));
    this.window.setVisibleOnAllWorkspaces(true);
    this.window.setAlwaysOnTop(true, 'screen-saver');

    console.log('[Pet] Window created at bottom-right');
  }

  // === Chat Window ===
  private openChatWindow(): void {
    if (this.chatWindow && !this.chatWindow.isDestroyed()) {
      this.chatWindow.focus();
      return;
    }

    this.chatWindow = new BrowserWindow({
      width: 420,
      height: 600,
      title: 'HiHermes Chat',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Load the existing React chat UI
    // In dev: use vite server; in prod: load built files
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      this.chatWindow.loadURL('http://localhost:5173');
    } else {
      this.chatWindow.loadFile(path.join(__dirname, '../renderer/chat/index.html'));
    }

    this.chatWindow.on('closed', () => {
      this.chatWindow = null;
    });
  }

  // === Context Menu ===
  private showContextMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      { label: '💬 打开聊天', click: () => this.openChatWindow() },
      { type: 'separator' },
      {
        label: '🎤 唤醒词设置',
        click: () => {
          // TODO: open settings window
          console.log('[Pet] Open wake word settings');
        },
      },
      { label: '🔊 语音测试', click: () => this.tts.speak('主人好呀！我是2B，有什么可以帮你的吗？') },
      { type: 'separator' },
      {
        label: this.petState === 'sleep' ? '☀️ 唤醒' : '😴 休眠',
        click: () => {
          if (this.petState === 'sleep') {
            this.setState('wake');
            setTimeout(() => this.setState('idle'), 1500);
          } else {
            this.setState('sleep');
          }
        },
      },
      { type: 'separator' },
      { label: '❌ 退出', click: () => this.destroy() },
    ];

    const menu = Menu.buildFromTemplate(template);
    if (this.window) {
      menu.popup({ window: this.window });
    }
  }

  // === State Management ===
  private setState(state: 'idle' | 'wake' | 'speak' | 'sleep'): void {
    this.petState = state;
    this.sendToPet('pet-state', state);
  }

  private sendToPet(channel: string, data: any): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  // === Lifecycle ===
  async start(): Promise<void> {
    this.createPetWindow();
    // Start Sherpa after window is ready
    setTimeout(() => {
      this.sherpa.start();
    }, 1000);
  }

  destroy(): void {
    this.sherpa.stop();
    this.tts.destroy();
    if (this.chatWindow && !this.chatWindow.isDestroyed()) {
      this.chatWindow.close();
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }
}
