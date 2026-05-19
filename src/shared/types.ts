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

export interface MediaImportRequest {
  conversationId: string
  sourcePath: string
}

export interface MediaImportResult {
  part: MediaPart
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

export interface HermesCliResult {
  ok: boolean
  stdout: string
  stderr: string
}

export interface HermesGatewayStatus {
  profile: string
  running: boolean
  raw: HermesCliResult
}

export interface HermesModelGroup {
  provider: string
  label: string
  models: string[]
  current?: boolean
}

export interface HermesLogFile {
  name: string
  path: string
  size: string
  modified: string
}

export interface HermesDashboardModule {
  id: string
  label: string
  status: 'available' | 'partial' | 'planned'
  detail: string
}

export interface HermesDashboardSummary {
  cliAvailable: boolean
  activeProfile: string
  profiles: string[]
  gateway: HermesGatewayStatus | null
  models: HermesModelGroup[]
  logs: HermesLogFile[]
  modules: HermesDashboardModule[]
}

export interface HermesProfileDetail {
  name: string
  active: boolean
  path: string
  configExists: boolean
  defaultModel: string
  kind: 'root' | 'profile'
}

export type HermesMemorySection = 'memory' | 'user' | 'soul'

export interface HermesMemoryFile {
  section: HermesMemorySection
  label: string
  path: string
  exists: boolean
  size: string
  modified: string
  preview: string
}

export interface HermesSkillSummary {
  name: string
  category: string
  description: string
  enabled: boolean
  source: 'builtin' | 'hub' | 'local'
}

export interface HermesSkillCategory {
  name: string
  description: string
  skills: HermesSkillSummary[]
}

export interface HermesPluginSummary {
  name: string
  path: string
  hasManifest: boolean
  modified: string
}

export interface HermesUsageSummary {
  source: 'hermespet-local'
  available: boolean
  conversations: number
  messages: number
  inputTokens: number
  outputTokens: number
  reason: string
}

export interface HermesGatewayRow {
  profile: string
  active: boolean
  running: boolean | null
  status: 'running' | 'stopped' | 'unknown'
  raw?: HermesCliResult
}

export interface HermesDashboardDetails {
  profiles: HermesProfileDetail[]
  gateways: HermesGatewayRow[]
  skills: HermesSkillCategory[]
  plugins: HermesPluginSummary[]
  memory: HermesMemoryFile[]
  usage: HermesUsageSummary
}
