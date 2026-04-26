import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { HermesBridge } from './hermes-bridge';
import { SettingsStore } from './settings-store';
import { registerIpcHandlers } from './ipc-handlers';
import { PetWindow } from './pet-window';
import { IPC_CHANNELS } from '../shared/types';

let chatWindow: BrowserWindow | null = null;
let hermesBridge: HermesBridge;
let settingsStore: SettingsStore;
let petWindow: PetWindow;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
const startMode = process.env.HIMERS_MODE || 'pet';

function createChatWindow(): void {
  const { screen } = require('electron');
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  chatWindow = new BrowserWindow({
    width: Math.min(1200, Math.floor(screenW * 0.75)),
    height: Math.min(850, Math.floor(screenH * 0.85)),
    minWidth: 680, minHeight: 500,
    title: 'HiHermes Chat',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });

  chatWindow.setMenuBarVisibility(false);

  if (isDev) {
    chatWindow.loadURL('http://localhost:5173');
    chatWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    chatWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  chatWindow.on('closed', () => { chatWindow = null; });
}

app.whenReady().then(() => {
  // Initialize core services
  settingsStore = new SettingsStore();
  hermesBridge = new HermesBridge();
  registerIpcHandlers(hermesBridge);

  // Apply saved settings
  hermesBridge.configure(settingsStore.getAll());

  if (startMode === 'pet') {
    petWindow = new PetWindow(hermesBridge, settingsStore);
    petWindow.start();
  } else {
    createChatWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (startMode === 'pet') {
        petWindow = new PetWindow(hermesBridge, settingsStore);
        petWindow.start();
      } else {
        createChatWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (petWindow) petWindow.destroy();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (petWindow) petWindow.destroy();
});
