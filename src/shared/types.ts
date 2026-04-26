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
  history?: ChatMessage[];
}

export interface HermesResponse {
  id: string;
  content: string;
  sessionId: string;
  media?: MediaAttachment[];
  error?: string;
}

// ===== App Settings =====

export interface AppSettings {
  // Hermes connection
  apiServerUrl: string;        // e.g. http://localhost:8642
  apiServerKey: string;        // API_SERVER_KEY if set

  // Voice / Wake
  wakeWords: string[];
  silenceTimeout: number;      // seconds before sleep

  // TTS
  ttsVoice: string;            // edge-tts voice name, e.g. zh-CN-XiaoyiNeural
  ttsRate: string;             // "+0%", "-10%", "+20%"
  ttsPitch: string;            // "+0Hz"
  ttsVolume: string;           // "+0%"

  // Pet appearance
  petPosition: { x: number; y: number };
  petSize: number;             // sprite display size (px)
  autoStart: boolean;          // launch on system startup
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiServerUrl: 'http://localhost:8642',
  apiServerKey: '',

  wakeWords: ['小赫', 'AI助手', '2B'],
  silenceTimeout: 1.5,

  ttsVoice: 'zh-CN-XiaoyiNeural',
  ttsRate: '+0%',
  ttsPitch: '+0Hz',
  ttsVolume: '+0%',

  petPosition: { x: -1, y: -1 },  // -1 = auto (bottom-right)
  petSize: 128,
  autoStart: false,
};

// Edge TTS Chinese voice catalog
export const TTS_VOICES = [
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (活泼女声)', gender: 'female' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (温柔女声)', gender: 'female' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (男声)', gender: 'male' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (新闻男声)', gender: 'male' },
  { id: 'zh-CN-YunjianNeural', name: '云健 (运动男声)', gender: 'male' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰 (少女)', gender: 'female' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵 (温柔女声)', gender: 'female' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦 (活泼女声)', gender: 'female' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨 (冷静女声)', gender: 'female' },
  { id: 'zh-CN-XiaoqiuNeural', name: '晓秋 (成熟女声)', gender: 'female' },
  { id: 'zh-CN-XiaoruiNeural', name: '晓睿 (成熟女声)', gender: 'female' },
  { id: 'zh-CN-XiaoshuangNeural', name: '晓双 (可爱女声)', gender: 'female' },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱 (自信女声)', gender: 'female' },
  { id: 'zh-CN-XiaoyanNeural', name: '晓颜 (温柔女声)', gender: 'female' },
  { id: 'zh-CN-XiaoyouNeural', name: '晓悠 (童声)', gender: 'female' },
  { id: 'zh-CN-XiaozhenNeural', name: '晓臻 (温柔女声)', gender: 'female' },
  { id: 'zh-CN-YunfengNeural', name: '云枫 (温柔男声)', gender: 'male' },
  { id: 'zh-CN-YunhaoNeural', name: '云皓 (明亮男声)', gender: 'male' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏 (活泼男声)', gender: 'male' },
  { id: 'zh-CN-YunyeNeural', name: '云野 (成熟男声)', gender: 'male' },
  { id: 'zh-CN-YunzeNeural', name: '云泽 (深沉男声)', gender: 'male' },
];

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
  // Settings
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  SETTINGS_UPDATED: 'settings:updated',
} as const;

export interface VoiceMessage {
  data: ArrayBuffer;
  format: string;
  duration: number;
}
