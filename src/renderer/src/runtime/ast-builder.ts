import type { MessagePart } from '@shared/types'

/**
 * Aggregates parts emitted by stream-parser into a stable AST per message.
 * Real impl in iteration-005.
 */
export interface AstBuilder {
  push(part: MessagePart): void
  finalize(): MessagePart[]
  reset(): void
}

export function createAstBuilder(): AstBuilder {
  let parts: MessagePart[] = []
  return {
    push(part) {
      parts.push(part)
    },
    finalize() {
      const out = parts
      parts = []
      return out
    },
    reset() {
      parts = []
    },
  }
}
