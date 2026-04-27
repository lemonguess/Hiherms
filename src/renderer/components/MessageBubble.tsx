import React, { useState } from 'react';
import { ChatMessage } from '../../shared/types';

interface MessageBubbleProps {
  message: ChatMessage;
  onPlayTTS: (text: string) => void;
}

export function MessageBubble({ message, onPlayTTS }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="system-message">
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div
      className={`message-row ${isUser ? 'message-row-user' : 'message-row-assistant'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isUser && (
        <div className="avatar avatar-hermes">
          ⚡
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        {/* Media attachments */}
        {message.media && message.media.length > 0 && (
          <div className="media-attachments">
            {message.media.map((media, i) => (
              <div key={i} className="media-attachment">
                {media.type === 'image' && (
                  <img
                    src={`data:${media.mimeType};base64,${media.data}`}
                    alt={media.filename || 'attached image'}
                    className="media-image"
                    onClick={() => {
                      // Open full size
                      const win = window.open('', '_blank');
                      if (win) {
                        win.document.write(
                          `<img src="data:${media.mimeType};base64,${media.data}" style="max-width:100%;max-height:100vh;" />`
                        );
                      }
                    }}
                  />
                )}
                {media.type === 'audio' && (
                  <div className="media-audio">
                    🎤 语音消息 ({media.filename || 'audio'})
                  </div>
                )}
                {media.type === 'file' && (
                  <div className="media-file" style={{ padding: '8px', background: '#2d333b', borderRadius: '6px', marginTop: '4px', fontSize: '13px' }}>
                    {media.mimeType?.startsWith('image/') && (
                      <img
                        src={`file://${encodeURI(media.data)}`}
                        alt={media.filename || 'local image'}
                        className="media-image"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: media.mimeType?.startsWith('image/') ? '6px' : '0' }}>
                      <span style={{ fontSize: '16px' }}>📄</span>
                      <span style={{ flex: 1, wordBreak: 'break-all' }}>{media.filename || media.data}</span>
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                      <button
                        className="action-btn"
                        onClick={() => {
                          const shell = require('electron').shell;
                          shell.openPath(media.data);
                        }}
                        title="预览文件"
                      >
                        预览
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          const shell = require('electron').shell;
                          shell.showItemInFolder(media.data);
                        }}
                        title="打开所在目录"
                      >
                        定位
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        <div className="message-content">
          {message.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {renderLine(line)}
              {i < message.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        {/* Timestamp */}
        <div className="message-time">
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>

        {/* Action buttons for assistant messages */}
        {!isUser && showActions && (
          <div className="message-actions">
            <button
              className="action-btn"
              onClick={() => onPlayTTS(message.content)}
              title="语音播报"
            >
              🔊
            </button>
            <button
              className="action-btn"
              onClick={() => navigator.clipboard.writeText(message.content)}
              title="复制"
            >
              📋
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="avatar avatar-user">
          👤
        </div>
      )}
    </div>
  );
}

// Simple markdown-like rendering
function renderLine(line: string): React.ReactNode {
  // Bold
  if (line.startsWith('**') && line.endsWith('**')) {
    return <strong>{line.slice(2, -2)}</strong>;
  }

  // Code blocks (backtick)
  const codeMatch = line.match(/`([^`]+)`/g);
  if (codeMatch) {
    const parts = line.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  // Emoji-only lines → bigger
  if (/^[\p{Emoji}\s]+$/u.test(line.trim()) && line.trim().length <= 10) {
    return <span className="emoji-large">{line}</span>;
  }

  return line;
}
