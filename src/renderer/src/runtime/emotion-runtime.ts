import type { EmotionIntent } from '@shared/types'

/**
 * Maps abstract HRP `<emotion value="..."/>` to the actually loaded model.
 *
 * Hard rule (project.md §10): NEVER call `model.expression('happy')` — tuzi_mian
 * has no `.exp3.json` and Alexia's are pinyin-coded (`bbt`/`yfmz`/...).
 * Resolve through this layer.
 *
 * iteration-001: stub.
 */
export interface EmotionRuntime {
  apply(intent: EmotionIntent, intensity?: number): void
}

export function createEmotionRuntime(): EmotionRuntime {
  return {
    apply(intent, intensity) {
      // TODO(iteration-005): map to expression file OR param keyframes per Asset Inventory §20.
      console.warn('[emotion-runtime] stub:', intent, intensity ?? 1)
    },
  }
}
