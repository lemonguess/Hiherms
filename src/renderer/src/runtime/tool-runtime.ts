import type { ToolPart } from '@shared/types'

/**
 * Tracks `<tool>` status updates streamed inline with the LLM response.
 * iteration-001: stub.
 */
export interface ToolRuntime {
  observe(part: ToolPart): void
}

export function createToolRuntime(): ToolRuntime {
  return {
    observe(part) {
      console.warn('[tool-runtime] stub:', part.name, part.status)
    },
  }
}
