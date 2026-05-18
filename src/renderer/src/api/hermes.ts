import type { AgentHistoryMessage, AgentRunEvent, MessagePart } from '@shared/types'
import { appendVisibleText } from '../runtime/display-text'
import { createStreamParser } from '../runtime/stream-parser'

const DEFAULT_BASE = 'Hermes Agent Bridge'
const DEFAULT_KEY = 'local-ipc'

export interface HermesConfig {
  baseUrl: string
  apiKey: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface SendOptions {
  sessionId: string
  messages: ChatMessage[]
  onDelta: (text: string) => void
  onDone: (fullText: string, parts: MessagePart[]) => void
  onError: (err: Error) => void
}

let config: HermesConfig = {
  baseUrl: DEFAULT_BASE,
  apiKey: DEFAULT_KEY,
}

export function setHermesConfig(c: Partial<HermesConfig>): void {
  if (c.baseUrl !== undefined) config.baseUrl = c.baseUrl
  if (c.apiKey !== undefined) config.apiKey = c.apiKey
}

export function getHermesConfig(): HermesConfig {
  return { ...config }
}

export async function checkHealth(): Promise<boolean> {
  return window.hermes?.agent?.check() ?? false
}

function toAgentHistory(messages: ChatMessage[]): AgentHistoryMessage[] {
  return messages
    .filter(message => message.content.trim().length > 0)
    .map(message => ({
      role: message.role,
      content: message.content,
    }))
}

export function sendMessage({ sessionId, messages, onDelta, onDone, onError }: SendOptions): AbortController {
  const ac = new AbortController()
  const parser = createStreamParser()
  const parts: MessagePart[] = []
  let fullText = ''
  let runId = ''
  let disposed = false

  const latestUser = [...messages].reverse().find(message => message.role === 'user')
  const history = latestUser ? messages.slice(0, messages.lastIndexOf(latestUser)) : messages

  const handleParts = (nextParts: MessagePart[]): void => {
    if (nextParts.length === 0) return
    parts.push(...nextParts)
    const visible = appendVisibleText('', nextParts)
    if (visible) {
      fullText += visible
      onDelta(visible)
    }
  }

  const finish = (): void => {
    if (disposed) return
    handleParts(parser.flush())
    disposed = true
    unsubscribe()
    onDone(fullText, parts)
  }

  const fail = (err: Error): void => {
    if (disposed) return
    disposed = true
    unsubscribe()
    onError(err)
  }

  const onEvent = (event: AgentRunEvent): void => {
    if (event.sessionId !== sessionId) return
    if (runId && event.runId && event.runId !== runId) return
    if (!runId && event.runId) runId = event.runId

    if (event.type === 'delta') {
      handleParts(parser.feed(event.delta))
    } else if (event.type === 'done') {
      finish()
    } else if (event.type === 'error') {
      fail(new Error(event.error))
    }
  }

  const unsubscribe = window.hermes?.agent?.onEvent(onEvent) ?? (() => undefined)

  if (!window.hermes?.agent) {
    fail(new Error('Hermes Agent Bridge is not available'))
    return ac
  }

  window.hermes.agent.send({
    sessionId,
    message: latestUser?.content ?? '',
    history: toAgentHistory(history),
  }).then(started => {
    if (disposed) {
      void window.hermes?.agent?.abort(sessionId, started.runId)
      return
    }
    runId = started.runId
  }).catch(err => {
    fail(err instanceof Error ? err : new Error(String(err)))
  })

  ac.signal.addEventListener('abort', () => {
    if (disposed) return
    disposed = true
    unsubscribe()
    void window.hermes?.agent?.abort(sessionId, runId || undefined)
  }, { once: true })

  return ac
}
