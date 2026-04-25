// Shared types between main and renderer processes

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  media?: MediaAttachment[];
  timestamp: number;
  sessionId?: string;
}

export interface MediaAttachment {
  type: 'image' | 'audio' | 'file';
  data: string;       // base64 or file path
  mimeType: string;
  filename?: string;
}

export interface HermesRequest {
  id: string;
  message: string;
  media?: MediaAttachment[];
  sessionId?: string;
}

export interface HermesResponse {
  id: string;
  content: string;
  sessionId: string;
  media?: MediaAttachment[];
  error?: string;
}

// IPC channel names
export const IPC_CHANNELS = {
  SEND_MESSAGE: 'hermes:send-message',
  MESSAGE_RESPONSE: 'hermes:message-response',
  STREAM_CHUNK: 'hermes:stream-chunk',
  SESSION_UPDATE: 'hermes:session-update',
  VOICE_RECORD_START: 'hermes:voice-record-start',
  VOICE_RECORD_STOP: 'hermes:voice-record-stop',
  VOICE_PLAY: 'hermes:voice-play',
  GET_SESSIONS: 'hermes:get-sessions',
  LOAD_SESSION: 'hermes:load-session',
  NEW_SESSION: 'hermes:new-session',
} as const;

export interface VoiceMessage {
  data: ArrayBuffer;
  format: string;
  duration: number;
}
