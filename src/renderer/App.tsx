import React, { useState, useCallback } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import SettingsPanel from './components/SettingsPanel';
import { ChatMessage, MediaAttachment } from '../shared/types';
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

  const { sendMessage, newSession, sessionId } = useHermes();
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
      const response = await sendMessage(text, media);
      setMessages(prev => prev.map(msg =>
        msg.id === placeholderId ? { ...msg, content: response.content, sessionId: response.sessionId } : msg
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

  const handlePlayTTS = useCallback(async (text: string) => {
    try { await playAudio(text); } catch (error) { console.error('TTS failed:', error); }
  }, [playAudio]);

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
        <div className="header-right">
          <button className="header-btn" onClick={() => setShowSettings(true)} title="设置">⚙️</button>
          <button className="header-btn" onClick={handleNewSession} title="新建会话">＋</button>
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
