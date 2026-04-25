import React, { useState, useCallback } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { ChatMessage, MediaAttachment } from '../shared/types';
import { useHermes } from './hooks/useHermes';
import { useVoice } from './hooks/useVoice';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 欢迎使用 Hermes Desktop！\n\n我是你的 AI 助手，支持：\n• 💬 文字对话\n• 🎤 语音输入\n• 🖼️ 图片上传\n• 🔊 语音播报\n\n开始对话吧~',
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const { sendMessage, newSession } = useHermes();
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

    // Add a placeholder for the response
    const placeholderId = `resp-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: placeholderId,
        role: 'assistant',
        content: '思考中...',
        timestamp: Date.now(),
      },
    ]);

    try {
      const response = await sendMessage(text, media);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === placeholderId
            ? {
                ...msg,
                content: response.content,
                sessionId: response.sessionId,
              }
            : msg
        )
      );
    } catch (error: any) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === placeholderId
            ? { ...msg, content: `❌ 错误：${error.message || '未知错误'}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [sendMessage]);

  const handleVoiceResult = useCallback(async (audioBlob: Blob) => {
    // For now, we indicate voice was captured - STT will be added
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const voiceMedia: MediaAttachment = {
      type: 'audio',
      data: base64,
      mimeType: audioBlob.type || 'audio/webm',
      filename: `voice-${Date.now()}.webm`,
    };

    handleSend('[🎤 语音消息]', [voiceMedia]);
  }, [handleSend]);

  const handleNewSession = useCallback(() => {
    newSession();
    setMessages([
      {
        id: 'new-session',
        role: 'system',
        content: '🆕 新会话已开始',
        timestamp: Date.now(),
      },
    ]);
  }, [newSession]);

  const handlePlayTTS = useCallback(async (text: string) => {
    try {
      await playAudio(text);
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
  }, [playAudio]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">⚡</span>
          <h1 className="header-title">Hermes Desktop</h1>
        </div>
        <div className="header-right">
          <button
            className="header-btn"
            onClick={handleNewSession}
            title="新建会话"
          >
            ＋ 新会话
          </button>
        </div>
      </header>

      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        onPlayTTS={handlePlayTTS}
      />

      <InputBar
        onSend={handleSend}
        onVoiceStart={startRecording}
        onVoiceStop={stopRecording}
        onVoiceResult={handleVoiceResult}
        isRecording={isRecording}
        isLoading={isLoading}
      />
    </div>
  );
}
