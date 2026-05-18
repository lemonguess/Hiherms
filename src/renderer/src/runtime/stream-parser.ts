import type { MessagePart } from '@shared/types'

/**
 * SSE chunk → MessagePart[] streaming parser.
 *
 * project.md §5 forbids `text.replace(...)` and §14 forbids string messages.
 * The real implementation lands in iteration-005; this stub keeps the
 * interface so callers can wire imports today.
 */
export interface StreamParser {
  feed(chunk: string): MessagePart[]
  flush(): MessagePart[]
}

export function createStreamParser(): StreamParser {
  // TODO(iteration-005): state-machine parser tolerant of half-open HRP tags.
  return {
    feed(chunk) {
      console.warn('[stream-parser] stub feed:', chunk.slice(0, 32))
      return []
    },
    flush() {
      return []
    },
  }
}
