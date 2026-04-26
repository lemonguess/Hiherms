import { contextBridge, ipcRenderer } from 'electron';
import { HermesRequest, HermesResponse, AppSettings, IPC_CHANNELS } from '../shared/types';

contextBridge.exposeInMainWorld('hermesAPI', {
  // Chat
  sendMessage: (request: HermesRequest): Promise<HermesResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, request);
  },

  getSession: (): Promise<{ sessionId: string | null }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS);
  },

  newSession: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.NEW_SESSION);
  },

  onSessionUpdate: (callback: (data: { sessionId: string | null }) => void) => {
    const handler = (_event: any, data: { sessionId: string | null }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SESSION_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.SESSION_UPDATE, handler); };
  },

  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
  },

  setSettings: (partial: Partial<AppSettings>): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, partial);
  },

  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: any, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_UPDATED, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_UPDATED, handler); };
  },

  // Images
  openImageDialog: (): Promise<{ data: string; mimeType: string; filename: string } | null> => {
    return ipcRenderer.invoke('dialog:open-image');
  },
});
