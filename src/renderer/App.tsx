import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import SettingsPanel from './components/SettingsPanel';
import { ChatMessage, MediaAttachment, SessionSummary } from '../shared/types';
import { useHermes } from './hooks/useHermes';
import { useVoice } from './hooks/useVoice';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 欢迎使用 HiHermes!\n\n我是你的桌面 AI 宠物，支持：\n• 💬 文字对话\n• 🎤 语音唤醒 "小赫小赫"\n• 🖼️ 图片发送\n• 🔊 语音播报\n\n开始对话吧~',
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionError, setSessionError] = useState('');
  const sessionPanelRef = useRef<HTMLDivElement | null>(null);

  const { sendMessage, newSession, sessionId, listSessions, selectSession } = useHermes();
  const { isRecording, startRecording, stopRecording, playAudio } = useVoice();

  const handleSend = useCallback(async (text: string, media?: MediaAttachment[]) => {
    if (!text.trim() && (!media || media.length === 0)) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      media,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const placeholderId = `resp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: placeholderId, role: 'assistant', content: '思考中...', timestamp: Date.now(),
    }]);

    try {
      // Exclude system messages, the initial welcome message, and the current placeholder
      const validHistory = messages.filter(m => 
        m.role !== 'system' && 
        m.id !== 'welcome' && 
        m.id !== placeholderId
      );
      const response = await sendMessage(text, media, validHistory);
      setMessages(prev => prev.map(msg =>
        msg.id === placeholderId ? { ...msg, content: response.content, sessionId: response.sessionId, media: response.media } : msg
      ));
    } catch (error: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === placeholderId ? { ...msg, content: `❌ 错误：${error.message || '未知错误'}` } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [sendMessage]);

  const handleVoiceResult = useCallback(async (audioBlob: Blob) => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const voiceMedia: MediaAttachment = {
      type: 'audio', data: base64, mimeType: audioBlob.type || 'audio/webm', filename: `voice-${Date.now()}.webm`,
    };
    handleSend('[🎤 语音消息]', [voiceMedia]);
  }, [handleSend]);

  const handleNewSession = useCallback(() => {
    newSession();
    setMessages([{ id: 'new-session', role: 'system', content: '🆕 新会话已开始', timestamp: Date.now() }]);
  }, [newSession]);

  const handleToggleSessions = useCallback(async () => {
    setSessionError('');
    if (!showSessionPicker) {
      try {
        const items = await listSessions();
        setSessions(items);
      } catch (err: any) {
        setSessions([]);
        setSessionError(err?.message || '会话加载失败');
      }
    }
    setShowSessionPicker(prev => !prev);
  }, [showSessionPicker, listSessions]);

  const handleSelectSession = useCallback(async (id: string) => {
    await selectSession(id);
    setShowSessionPicker(false);
    setMessages([
      { id: `switch-${Date.now()}`, role: 'system', content: `🔁 已切换会话 #${id.slice(-8)}`, timestamp: Date.now() },
    ]);
  }, [selectSession]);

  useEffect(() => {
    if (!showSessionPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (!sessionPanelRef.current) return;
      if (!sessionPanelRef.current.contains(e.target as Node)) {
        setShowSessionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSessionPicker]);

  const handlePlayTTS = useCallback(async (text: string) => {
    try { await playAudio(text); } catch (error) { console.error('TTS failed:', error); }
  }, [playAudio]);

  React.useEffect(() => {
    if (window.hermesAPI && window.hermesAPI.onShowSettings) {
      const unsubscribe = window.hermesAPI.onShowSettings(() => {
        setShowSettings(true);
      });
      return unsubscribe;
    }
  }, []);

  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">⚡</span>
          <h1 className="header-title">HiHermes</h1>
          {sessionId && <span style={{ fontSize: 10, color: '#8b949e', marginLeft: 8 }}>#{sessionId.slice(-8)}</span>}
        </div>
        <div className="header-right" ref={sessionPanelRef}>
          <button className="header-btn has-tooltip" data-tooltip="会话列表" onClick={handleToggleSessions}>🗂️</button>
          <button className="header-btn has-tooltip" data-tooltip="设置" onClick={() => setShowSettings(true)}>⚙️</button>
          <button className="header-btn has-tooltip" data-tooltip="新建会话" onClick={handleNewSession}>＋</button>

          {showSessionPicker && (
            <div className="session-picker">
              {sessionError && <div className="session-item muted">{sessionError}</div>}
              {!sessionError && sessions.length === 0 && <div className="session-item muted">暂无会话</div>}
              {sessions.map((s) => (
                <button
                  key={s.id}
                  className={`session-item ${s.id === sessionId ? 'active' : ''}`}
                  onClick={() => handleSelectSession(s.id)}
                  title={s.id}
                >
                  <div className="session-title">{s.title}</div>
                  {s.time && <div className="session-time">{s.time}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <ChatWindow messages={messages} isLoading={isLoading} onPlayTTS={handlePlayTTS} />

      <InputBar
        onSend={handleSend}
        onVoiceStart={startRecording} onVoiceStop={stopRecording} onVoiceResult={handleVoiceResult}
        isRecording={isRecording} isLoading={isLoading}
      />
    </div>
  );
}
