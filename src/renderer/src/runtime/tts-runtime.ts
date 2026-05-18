import type { SpeechPart } from '@shared/types'

/**
 * Will speak HRP `<speech>` parts via CosyVoice once user provides the
 * deployment URL + API contract (project.md §9). Until then, this is a no-op
 * so the rest of the pipeline can stream without blocking.
 */
export interface TtsRuntime {
  speak(part: SpeechPart): Promise<void>
  cancel(): void
}

export function createTtsRuntime(): TtsRuntime {
  return {
    async speak(part) {
      // TODO(post-cosyvoice): POST to CosyVoice; pipe audio chunks to audio-queue.
      console.warn('[tts-runtime] stub speak:', part.text.slice(0, 40))
    },
    cancel() {
      // no-op until CosyVoice is wired.
    },
  }
}
