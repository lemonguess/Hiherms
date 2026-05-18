import type { MediaPart } from '@shared/types'

/**
 * Renders inline `<media>` parts. project.md §13 requires path containment
 * within `~/HermesPet_Media/` — that check goes here, not in the renderer.
 *
 * iteration-001: stub.
 */
export interface MediaRuntime {
  resolve(part: MediaPart): { ok: true; src: string } | { ok: false; reason: string }
}

export function createMediaRuntime(): MediaRuntime {
  return {
    resolve(part) {
      // TODO: validate path is inside ~/HermesPet_Media/, reject `..` traversal.
      console.warn('[media-runtime] stub resolve:', part.src)
      return { ok: false, reason: 'media-runtime not implemented' }
    },
  }
}
