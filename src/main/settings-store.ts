// Persistent settings store — JSON file in userData directory
// Reads on startup, writes on change, broadcasts via IPC

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppSettings, DEFAULT_SETTINGS, IPC_CHANNELS } from '../shared/types';

export class SettingsStore {
  private filePath: string;
  private settings: AppSettings;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    const userData = app.getPath('userData');
    this.filePath = path.join(userData, 'himers-settings.json');
    this.settings = this.load();
    this.setupIPC();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...data };
      }
    } catch (err) {
      console.warn('[Settings] Failed to load, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    // Debounce saves
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
        console.log('[Settings] Saved to', this.filePath);
      } catch (err) {
        console.error('[Settings] Failed to save:', err);
      }
    }, 300);
  }

  private setupIPC(): void {
    // Get all settings
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
      return this.settings;
    });

    // Update settings (partial merge)
    ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, partial: Partial<AppSettings>) => {
      this.settings = { ...this.settings, ...partial };
      this.save();
      this.broadcast();
      return this.settings;
    });
  }

  private broadcast(): void {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach((win: any) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.SETTINGS_UPDATED, this.settings);
      }
    });
  }

  // Accessors
  getAll(): AppSettings {
    return { ...this.settings };
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  set(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
    this.broadcast();
  }

  getFilePath(): string {
    return this.filePath;
  }
}
