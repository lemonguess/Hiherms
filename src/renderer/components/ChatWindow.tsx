import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../../shared/types';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onPlayTTS: (text: string) => void;
}

export function ChatWindow({ messages, isLoading, onPlayTTS }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="chat-window" ref={scrollRef}>
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-icon">⚡</div>
            <p>开始和 Hermes 对话吧</p>
            <p className="empty-hint">支持文字、语音、图片输入</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onPlayTTS={onPlayTTS}
          />
        ))}

        {isLoading && (
          <div className="typing-indicator">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
