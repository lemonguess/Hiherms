import { ipcMain, dialog } from 'electron';
import { HermesBridge } from './hermes-bridge';
import { HermesRequest, IPC_CHANNELS } from '../shared/types';

export function registerIpcHandlers(bridge: HermesBridge): void {
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

  // Start a new session
  ipcMain.handle(IPC_CHANNELS.NEW_SESSION, async () => {
    bridge.newSession();
    return { success: true };
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
