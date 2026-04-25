import React, { useState, useRef, useCallback, KeyboardEvent, ClipboardEvent } from 'react';
import { MediaAttachment } from '../../shared/types';
import { VoiceButton } from './VoiceButton';

interface InputBarProps {
  onSend: (text: string, media?: MediaAttachment[]) => void;
  onVoiceStart: () => Promise<void>;
  onVoiceStop: () => Promise<Blob>;
  onVoiceResult: (blob: Blob) => Promise<void>;
  isRecording: boolean;
  isLoading: boolean;
}

export function InputBar({
  onSend,
  onVoiceStart,
  onVoiceStop,
  onVoiceResult,
  isRecording,
  isLoading,
}: InputBarProps) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && media.length === 0) return;
    if (isLoading) return;

    onSend(trimmed || '[图片]', media.length > 0 ? media : undefined);
    setText('');
    setMedia([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, media, isLoading, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Paste image from clipboard
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setMedia(prev => [
              ...prev,
              {
                type: 'image',
                data: base64,
                mimeType: item.type,
                filename: `paste-${Date.now()}.png`,
              },
            ]);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  }, []);

  // File input for image upload
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setMedia(prev => [
          ...prev,
          {
            type: 'image',
            data: base64,
            mimeType: file.type,
            filename: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeMedia = useCallback((index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="input-bar">
      {/* Media previews */}
      {media.length > 0 && (
        <div className="media-previews">
          {media.map((m, i) => (
            <div key={i} className="media-preview-item">
              {m.type === 'image' && (
                <img
                  src={`data:${m.mimeType};base64,${m.data}`}
                  alt={m.filename || 'preview'}
                  className="media-preview-img"
                />
              )}
              <button
                className="media-remove-btn"
                onClick={() => removeMedia(i)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="input-row">
        {/* Image upload button */}
        <button
          className="input-tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="上传图片"
          disabled={isLoading}
        >
          🖼️
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          className="text-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行, 支持粘贴图片)"
          rows={1}
          disabled={isLoading}
        />

        {/* Voice button */}
        <VoiceButton
          isRecording={isRecording}
          isLoading={isLoading}
          onStart={onVoiceStart}
          onStop={onVoiceStop}
          onResult={onVoiceResult}
        />

        {/* Send button */}
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && media.length === 0)}
        >
          {isLoading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}
