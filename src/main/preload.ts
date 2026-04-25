import { contextBridge, ipcRenderer } from 'electron';
import { HermesRequest, HermesResponse, IPC_CHANNELS } from '../shared/types';

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('hermesAPI', {
  // Send a message to Hermes and get response
  sendMessage: (request: HermesRequest): Promise<HermesResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, request);
  },

  // Get session info
  getSession: (): Promise<{ sessionId: string | null }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS);
  },

  // Start a new session
  newSession: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.NEW_SESSION);
  },

  // Listen for session updates
  onSessionUpdate: (callback: (data: { sessionId: string | null }) => void) => {
    const handler = (_event: any, data: { sessionId: string | null }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.SESSION_UPDATE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SESSION_UPDATE, handler);
    };
  },

  // Open file dialog for image selection
  openImageDialog: (): Promise<{ data: string; mimeType: string; filename: string } | null> => {
    return ipcRenderer.invoke('dialog:open-image');
  },
});

// Type declaration for the exposed API
export interface HermesAPI {
  sendMessage(request: HermesRequest): Promise<HermesResponse>;
  getSession(): Promise<{ sessionId: string | null }>;
  newSession(): Promise<{ success: boolean }>;
  onSessionUpdate(callback: (data: { sessionId: string | null }) => void): () => void;
  openImageDialog(): Promise<{ data: string; mimeType: string; filename: string } | null>;
}

declare global {
  interface Window {
    hermesAPI: HermesAPI;
  }
}
