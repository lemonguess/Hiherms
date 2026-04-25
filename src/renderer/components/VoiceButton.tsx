import React, { useState, useRef } from 'react';

interface VoiceButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<Blob>;
  onResult: (blob: Blob) => Promise<void>;
}

export function VoiceButton({ isRecording, isLoading, onStart, onStop, onResult }: VoiceButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const handleMouseDown = async () => {
    if (isLoading || isProcessing) return;
    isLongPressRef.current = false;

    // Long press detection: 200ms
    pressTimerRef.current = setTimeout(async () => {
      isLongPressRef.current = true;
      try {
        await onStart();
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }, 200);
  };

  const handleMouseUp = async () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (!isLongPressRef.current) {
      // Short click — could be used for something else
      return;
    }

    if (!isRecording) return;

    setIsProcessing(true);
    try {
      const blob = await onStop();
      await onResult(blob);
    } catch (error) {
      console.error('Voice processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMouseLeave = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    // Continue recording even if mouse leaves
  };

  return (
    <button
      className={`voice-btn ${isRecording ? 'voice-btn-recording' : ''} ${isProcessing ? 'voice-btn-processing' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      disabled={isLoading || isProcessing}
      title={isRecording ? '松开停止录音' : '按住录音'}
    >
      {isProcessing ? '⏳' : isRecording ? '🔴' : '🎤'}
      {isRecording && <span className="recording-pulse" />}
    </button>
  );
}
