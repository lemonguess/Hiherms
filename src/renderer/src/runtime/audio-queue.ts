/**
 * FIFO queue for TTS audio chunks; downstream of tts-runtime, drives lip-sync
 * (writes `ParamMouthOpenY` per amplitude window).
 * iteration-001: stub.
 */
export interface AudioQueue {
  enqueue(buf: ArrayBuffer): void
  clear(): void
}

export function createAudioQueue(): AudioQueue {
  return {
    enqueue(buf) {
      console.warn('[audio-queue] stub enqueue, bytes:', buf.byteLength)
    },
    clear() {
      // no-op
    },
  }
}
