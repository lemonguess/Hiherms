// HRP / Message AST type skeleton — iteration-001 placeholder.
// project.md §14 forbids `type Message = string`; this file holds the union
// that all parsers/runtimes will agree on. Implementation follows in later
// iterations (HRP parser, AST builder).

export type EmotionIntent =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'cute'
  | 'shy'
  | 'sleepy'
  | 'thinking'

export type MotionIntent =
  | 'idle'
  | 'blink'
  | 'wave'
  | 'nod'
  | 'shake_head'
  | 'sleep'
  | 'happy_jump'

export interface TextPart {
  kind: 'text'
  content: string
}

export interface SpeechPart {
  kind: 'speech'
  text: string
  tone?: string
  speed?: number
  emotion?: EmotionIntent
}

export interface EmotionPart {
  kind: 'emotion'
  value: EmotionIntent
  intensity?: number
}

export interface MotionPart {
  kind: 'motion'
  action: MotionIntent
}

export interface MediaPart {
  kind: 'media'
  type: 'image' | 'audio' | 'video' | 'file'
  src: string
}

export interface ToolPart {
  kind: 'tool'
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  payload?: unknown
}

export interface StatusPart {
  kind: 'status'
  state: string
  detail?: string
}

export type MessagePart =
  | TextPart
  | SpeechPart
  | EmotionPart
  | MotionPart
  | MediaPart
  | ToolPart
  | StatusPart

export interface AgentHistoryMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AgentSendRequest {
  sessionId: string
  message: string
  history?: AgentHistoryMessage[]
  instructions?: string
  model?: string
  provider?: string
}

export interface AgentRunStarted {
  sessionId: string
  runId: string
}

export type AgentRunEvent =
  | {
      type: 'delta'
      sessionId: string
      runId: string
      delta: string
    }
  | {
      type: 'runtime-event'
      sessionId: string
      runId: string
      event: Record<string, unknown>
    }
  | {
      type: 'done'
      sessionId: string
      runId: string
      fullText: string
    }
  | {
      type: 'error'
      sessionId: string
      runId?: string
      error: string
    }
