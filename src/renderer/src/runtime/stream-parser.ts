import type { EmotionIntent, MediaPart, MessagePart, MotionIntent, ToolPart } from '@shared/types'

/**
 * SSE chunk → MessagePart[] streaming parser.
 *
 * project.md §5 requires incrementally parsing half-open HRP tags instead of
 * doing whole-message cleanup. This parser keeps an internal buffer and emits
 * AST parts as soon as each text span or supported tag is complete.
 */
export interface StreamParser {
  feed(chunk: string): MessagePart[]
  flush(): MessagePart[]
}

type AttrMap = Record<string, string>

const EMOTIONS = new Set<EmotionIntent>(['neutral', 'happy', 'sad', 'angry', 'cute', 'shy', 'sleepy', 'thinking'])
const MOTIONS = new Set<MotionIntent>(['idle', 'blink', 'wave', 'nod', 'shake_head', 'sleep', 'happy_jump'])
const MEDIA_TYPES = new Set<MediaPart['type']>(['image', 'audio', 'video', 'file'])
const TOOL_STATUSES = new Set<ToolPart['status']>(['pending', 'running', 'done', 'error'])

function isEmotion(value: string): value is EmotionIntent {
  return EMOTIONS.has(value as EmotionIntent)
}

function isMotion(value: string): value is MotionIntent {
  return MOTIONS.has(value as MotionIntent)
}

function isMediaType(value: string): value is MediaPart['type'] {
  return MEDIA_TYPES.has(value as MediaPart['type'])
}

function isToolStatus(value: string): value is ToolPart['status'] {
  return TOOL_STATUSES.has(value as ToolPart['status'])
}

function parseAttrs(raw: string): AttrMap {
  const attrs: AttrMap = {}
  const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s/>]+))/g
  let match: RegExpExecArray | null
  while ((match = attrRe.exec(raw))) {
    attrs[match[1]] = match[3] ?? match[4] ?? match[5] ?? ''
  }
  return attrs
}

function parseTag(raw: string): { name: string; attrs: AttrMap } | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) return null
  let body = trimmed.slice(1, -1).trim()
  if (body.endsWith('/')) body = body.slice(0, -1).trim()
  if (!body || body.startsWith('/')) return null
  const firstSpace = body.search(/\s/)
  const name = (firstSpace < 0 ? body : body.slice(0, firstSpace)).toLowerCase()
  const attrSource = firstSpace < 0 ? '' : body.slice(firstSpace + 1)
  return { name, attrs: parseAttrs(attrSource) }
}

function numberAttr(attrs: AttrMap, name: string): number | undefined {
  const raw = attrs[name]
  if (raw == null || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function partFromTag(raw: string, innerText = ''): MessagePart | null {
  const parsed = parseTag(raw)
  if (!parsed) return null
  const { name, attrs } = parsed

  if (name === 'emotion') {
    const value = attrs.value
    if (!isEmotion(value)) return null
    return { kind: 'emotion', value, intensity: numberAttr(attrs, 'intensity') }
  }

  if (name === 'motion') {
    const action = attrs.action
    if (!isMotion(action)) return null
    return { kind: 'motion', action }
  }

  if (name === 'speech') {
    const emotion = attrs.emotion
    return {
      kind: 'speech',
      text: innerText,
      tone: attrs.tone || undefined,
      speed: numberAttr(attrs, 'speed'),
      emotion: isEmotion(emotion) ? emotion : undefined,
    }
  }

  if (name === 'media') {
    const type = attrs.type
    const src = attrs.src
    if (!isMediaType(type) || !src) return null
    return { kind: 'media', type, src }
  }

  if (name === 'tool') {
    const status = attrs.status
    if (!isToolStatus(status)) return null
    return { kind: 'tool', name: attrs.name || 'unknown', status }
  }

  if (name === 'status') {
    const state = attrs.state
    if (!state) return null
    return { kind: 'status', state, detail: attrs.detail || undefined }
  }

  return null
}

export function createStreamParser(): StreamParser {
  let buffer = ''

  const drain = (final: boolean): MessagePart[] => {
    const parts: MessagePart[] = []

    while (buffer.length > 0) {
      if (!buffer.startsWith('<')) {
        const nextTag = buffer.indexOf('<')
        if (nextTag < 0) {
          parts.push({ kind: 'text', content: buffer })
          buffer = ''
          break
        }
        if (nextTag > 0) {
          parts.push({ kind: 'text', content: buffer.slice(0, nextTag) })
          buffer = buffer.slice(nextTag)
          continue
        }
      }

      const closeOpen = buffer.indexOf('>')
      if (closeOpen < 0) {
        if (final && !buffer.startsWith('<')) {
          parts.push({ kind: 'text', content: buffer })
        }
        if (final) buffer = ''
        break
      }

      const rawOpen = buffer.slice(0, closeOpen + 1)
      const parsed = parseTag(rawOpen)
      if (!parsed) {
        buffer = buffer.slice(closeOpen + 1)
        continue
      }

      if (parsed.name === 'speech') {
        const closeTag = '</speech>'
        const lowerBuffer = buffer.toLowerCase()
        const closeStart = lowerBuffer.indexOf(closeTag, closeOpen + 1)
        if (closeStart < 0) {
          if (!final) break
          const text = buffer.slice(closeOpen + 1)
          const part = partFromTag(rawOpen, text)
          if (part) parts.push(part)
          buffer = ''
          break
        }
        const text = buffer.slice(closeOpen + 1, closeStart)
        const part = partFromTag(rawOpen, text)
        if (part) parts.push(part)
        buffer = buffer.slice(closeStart + closeTag.length)
        continue
      }

      const part = partFromTag(rawOpen)
      if (part) parts.push(part)
      buffer = buffer.slice(closeOpen + 1)
    }

    return parts
  }

  return {
    feed(chunk) {
      buffer += chunk
      return drain(false)
    },
    flush() {
      return drain(true)
    },
  }
}
