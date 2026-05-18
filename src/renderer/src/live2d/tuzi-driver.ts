import type { Live2DModel } from 'pixi-live2d-display/cubism4'

/**
 * Driver for the **tuzi_mian** model specifically.
 *
 * tuzi_mian ships without any `.exp3.json` or `.motion3.json`, so every
 * "alive" gesture below is synthesized by writing real parameter IDs
 * (per project.md §20.1) into `coreModel` each frame.
 *
 * IMPORTANT: this is *not* the place to wire abstract HRP intents
 * (`<motion action="wave"/>` etc.). Those go through motion-runtime /
 * emotion-runtime once those land. This driver only owns idle life
 * (breath sway, blink — the latter handled by pixi-live2d-display once
 * EyeBlink group is patched in loader.ts) plus a simple click reaction.
 */

const PARAM = {
  AngleX: 'ParamAngleX',
  AngleY: 'ParamAngleY',
  AngleZ: 'ParamAngleZ',
  EyeLOpen: 'ParamEyeLOpen',
  EyeROpen: 'ParamEyeROpen',
  EyeLSmile: 'ParamEyeLSmile',
  EyeRSmile: 'ParamEyeRSmile',
  MouthOpenY: 'ParamMouthOpenY',
  MouthForm: 'ParamMouthForm',
  Crooked48: 'Param48',
  Glare49: 'Param49',
  Crooked50: 'Param50',
} as const

interface CoreModelLike {
  setParameterValueById(id: string, value: number): void
  addParameterValueById(id: string, value: number, weight?: number): void
  getParameterValueById(id: string): number
}

interface Reaction {
  startedAt: number
  durationMs: number
}

export interface TuziDriver {
  destroy: () => void
  /** Trigger the click "歪嘴 + 瞪眼" micro-reaction. */
  poke: () => void
}

export function attachTuziDriver(model: Live2DModel): TuziDriver {
  const core = model.internalModel.coreModel as unknown as CoreModelLike
  if (typeof core?.setParameterValueById !== 'function') {
    throw new Error('tuzi-driver: coreModel.setParameterValueById is not available — wrong Cubism version?')
  }

  const start = performance.now()
  let reaction: Reaction | null = null

  function poke(): void {
    reaction = { startedAt: performance.now(), durationMs: 420 }
  }

  function tick(): void {
    const now = performance.now()
    const t = (now - start) / 1000

    // Breath sway via ParamAngleY ±2°. The model already runs auto-blink
    // (we injected the EyeBlink group), so we don't touch eye open here.
    core.addParameterValueById(PARAM.AngleY, Math.sin(t * 1.4) * 2.0)
    core.addParameterValueById(PARAM.AngleX, Math.sin(t * 0.6) * 1.0)

    if (reaction) {
      const elapsed = now - reaction.startedAt
      const k = Math.min(1, elapsed / reaction.durationMs)
      // Triangular ease (0→1 by mid, 1→0 by end).
      const intensity = k < 0.5 ? k * 2 : (1 - k) * 2
      core.setParameterValueById(PARAM.Crooked48, intensity)
      core.setParameterValueById(PARAM.Crooked50, intensity)
      core.setParameterValueById(PARAM.Glare49, intensity)
      core.addParameterValueById(PARAM.MouthForm, -0.3 * intensity)
      if (k >= 1) reaction = null
    }
  }

  const internalModel = model.internalModel as unknown as {
    on(event: 'beforeModelUpdate', cb: () => void): void
    off(event: 'beforeModelUpdate', cb: () => void): void
  }

  // pixi-live2d-display fires this after motion / expression / eye blink /
  // focus / physics, and before Cubism model.update(), so our writes affect
  // the current frame.
  internalModel.on('beforeModelUpdate', tick)

  // Click anywhere on the model's body triggers poke.
  model.on('hit', poke)
  // Fallback in case the model has no hit areas (tuzi_mian's HitAreas may be empty).
  model.on('pointerdown', poke)

  return {
    poke,
    destroy() {
      internalModel.off('beforeModelUpdate', tick)
      model.off('hit', poke)
      model.off('pointerdown', poke)
    },
  }
}
