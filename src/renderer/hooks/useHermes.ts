import { useState, useCallback } from 'react';
import { MediaAttachment } from '../../shared/types';

// Type declaration for the preload-exposed API
declare global {
  interface Window {
    hermesAPI: {
      sendMessage(request: any): Promise<any>;
      getSession(): Promise<{ sessionId: string | null }>;
      newSession(): Promise<{ success: boolean }>;
      onSessionUpdate(callback: (data: { sessionId: string | null }) => void): () => void;
      openImageDialog(): Promise<{ data: string; mimeType: string; filename: string } | null>;
    };
  }
}

export function useHermes() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string, media?: MediaAttachment[]) => {
    const request = {
      id: `req-${Date.now()}`,
      message: text,
      media,
      sessionId: sessionId || undefined,
    };

    const response = await window.hermesAPI.sendMessage(request);

    if (response.sessionId && response.sessionId !== sessionId) {
      setSessionId(response.sessionId);
    }

    return response;
  }, [sessionId]);

  const newSession = useCallback(async () => {
    await window.hermesAPI.newSession();
    setSessionId(null);
  }, []);

  const openImageDialog = useCallback(async () => {
    return window.hermesAPI.openImageDialog();
  }, []);

  return { sessionId, sendMessage, newSession, openImageDialog };
}
