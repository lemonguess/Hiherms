import type { MotionIntent } from '@shared/types'

/**
 * Maps abstract HRP `<motion action="..."/>` intents to the **actual**
 * Motions / parameter-keyframe synthesizers of the currently loaded model.
 *
 * Hard rule (project.md §11): NEVER pass the abstract intent string straight
 * to `model.motion(...)` — tuzi_mian has zero `.motion3.json`s and Alexia's
 * are named `dh`, not `wave`. Resolve through the model's actual settings
 * before deciding the execution path.
 *
 * iteration-001: stub. Real impl gates the Motion Queue (project.md §11) and
 * picks file vs synthesized keyframes based on Asset Inventory §20.
 */
export interface MotionRuntime {
  enqueue(intent: MotionIntent): void
}

export function createMotionRuntime(): MotionRuntime {
  return {
    enqueue(intent) {
      // TODO(iteration-005): consult model settings → motion file or keyframes.
      console.warn('[motion-runtime] stub:', intent)
    },
  }
}
