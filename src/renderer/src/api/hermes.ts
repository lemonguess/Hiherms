const DEFAULT_BASE = 'http://127.0.0.1:8642/v1'
const DEFAULT_KEY = 'hermespet-local-dev'

export interface HermesConfig {
  baseUrl: string
  apiKey: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface SendOptions {
  messages: ChatMessage[]
  onDelta: (text: string) => void
  onDone: (fullText: string) => void
  onError: (err: Error) => void
}

type ParsedSseLine =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'empty' }

let config: HermesConfig = {
  baseUrl: DEFAULT_BASE,
  apiKey: DEFAULT_KEY,
}

export function setHermesConfig(c: Partial<HermesConfig>): void {
  if (c.baseUrl !== undefined) config.baseUrl = c.baseUrl.replace(/\/+$/, '')
  if (c.apiKey !== undefined) config.apiKey = c.apiKey
}

export function getHermesConfig(): HermesConfig {
  return { ...config }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const base = config.baseUrl.replace(/\/v1\/?$/, '')
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${config.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  })
  if (!res.ok) throw new Error(`Models request failed: ${res.status}`)
  const data = await res.json()
  return data.data?.map((m: { id: string }) => m.id) ?? []
}

function parseChatCompletionSseLine(line: string): ParsedSseLine {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith('data:')) return { type: 'empty' }

  const payload = trimmed.slice(5).trim()
  if (!payload) return { type: 'empty' }
  if (payload === '[DONE]') return { type: 'done' }

  try {
    const evt = JSON.parse(payload)
    const content = evt.choices?.[0]?.delta?.content
    if (typeof content === 'string' && content.length > 0) {
      return { type: 'delta', text: content }
    }
  } catch {
    // skip malformed JSON lines
  }

  return { type: 'empty' }
}

export function sendMessage({ messages, onDelta, onDone, onError }: SendOptions): AbortController {
  const ac = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'hermes',
          messages,
          stream: true,
        }),
        signal: ac.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API ${res.status}: ${text}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      const handleLine = (line: string): { done: boolean; gotDelta: boolean } => {
        const parsed = parseChatCompletionSseLine(line)
        if (parsed.type === 'done') {
          onDone(fullText)
          return { done: true, gotDelta: false }
        }
        if (parsed.type === 'delta') {
          fullText += parsed.text
          onDelta(parsed.text)
          return { done: false, gotDelta: true }
        }
        return { done: false, gotDelta: false }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let gotDelta = false
        for (const line of lines) {
          const result = handleLine(line)
          if (result.done) return
          gotDelta ||= result.gotDelta
        }

        // Yield to event loop so Vue can flush DOM updates between chunks
        if (gotDelta) {
          await new Promise(r => setTimeout(r, 0))
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          const result = handleLine(line)
          if (result.done) return
        }
      }

      // Stream ended without explicit [DONE]
      onDone(fullText)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }
  })()

  return ac
}
