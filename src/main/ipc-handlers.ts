import { ipcMain, dialog } from 'electron';
import { HermesBridge } from './hermes-bridge';
import { TTSEngine } from './tts-engine';
import { HermesRequest, IPC_CHANNELS } from '../shared/types';

export function registerIpcHandlers(bridge: HermesBridge, ttsEngine: TTSEngine): void {
  // Send a message to Hermes
  ipcMain.handle(
    IPC_CHANNELS.SEND_MESSAGE,
    async (_event, request: HermesRequest) => {
      try {
        const response = await bridge.sendMessage(request);
        return response;
      } catch (error: any) {
        return {
          id: request.id,
          content: '',
          sessionId: bridge.getSessionId() || '',
          error: error.message || 'Failed to send message',
        };
      }
    }
  );

  // Get current session info
  ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async () => {
    return { sessionId: bridge.getSessionId() };
  });

  ipcMain.handle(IPC_CHANNELS.LIST_SESSIONS, async () => {
    const sessions = await bridge.listSessions(30);
    return { sessions };
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_SESSION, async (_event, sessionId: string) => {
    bridge.setSession(sessionId || null);
    return { success: true };
  });

  // Start a new session
  ipcMain.handle(IPC_CHANNELS.NEW_SESSION, async () => {
    bridge.newSession();
    return { success: true };
  });

  // TTS Playback
  ipcMain.handle(IPC_CHANNELS.VOICE_PLAY, async (_event, text: string) => {
    try {
      // Don't wait for speak to finish, just return success once started
      // TTSEngine will handle interruption internally if speak is called again
      ttsEngine.speak(text).catch(err => console.error('[IPC TTS Error]', err));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Session update events from bridge
  bridge.on('session', (sessionId: string | null) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((win: any) => {
      win.webContents.send(IPC_CHANNELS.SESSION_UPDATE, { sessionId });
    });
  });

  // File dialog for image upload
  ipcMain.handle('dialog:open-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const fs = require('fs');
    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
    };

    return {
      data: buffer.toString('base64'),
      mimeType: mimeMap[ext || ''] || 'image/png',
      filename: filePath.split('/').pop() || 'image.png',
    };
  });
}
