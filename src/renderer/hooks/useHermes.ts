import { useState, useCallback, useEffect } from 'react';
import { MediaAttachment, SessionSummary } from '../../shared/types';

// Type declaration for the preload-exposed API
declare global {
  interface Window {
    hermesAPI: {
      sendMessage(request: any): Promise<any>;
      getSession(): Promise<{ sessionId: string | null }>;
      listSessions(): Promise<{ sessions: SessionSummary[] }>;
      selectSession(sessionId: string): Promise<{ success: boolean }>;
      newSession(): Promise<{ success: boolean }>;
      onSessionUpdate(callback: (data: { sessionId: string | null }) => void): () => void;
      openImageDialog(): Promise<{ data: string; mimeType: string; filename: string } | null>;
      playTTS(text: string): Promise<{ success: boolean; error?: string }>;
      onShowSettings(callback: () => void): () => void;
    };
  }
}

export function useHermes() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    window.hermesAPI.getSession().then((res) => {
      if (mounted) setSessionId(res.sessionId || null);
    }).catch(() => {});

    const unsubscribe = window.hermesAPI.onSessionUpdate((data) => {
      if (mounted) setSessionId(data.sessionId || null);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const sendMessage = useCallback(async (text: string, media?: MediaAttachment[], history?: any[]) => {
    const request = {
      id: `req-${Date.now()}`,
      message: text,
      media,
      history,
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

  const listSessions = useCallback(async () => {
    const res = await window.hermesAPI.listSessions();
    return res.sessions || [];
  }, []);

  const selectSession = useCallback(async (id: string) => {
    await window.hermesAPI.selectSession(id);
    setSessionId(id);
  }, []);

  return { sessionId, sendMessage, newSession, openImageDialog, listSessions, selectSession };
}
