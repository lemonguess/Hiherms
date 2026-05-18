import type { MessagePart } from '@shared/types'

export function appendVisibleText(current: string, parts: MessagePart[]): string {
  let next = current
  for (const part of parts) {
    if (part.kind === 'text') next += part.content
  }
  return next
}
