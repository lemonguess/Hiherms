<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Live2DModel } from 'pixi-live2d-display/cubism4'
import { createLive2DStage, type Live2DStage } from '../live2d/stage'
import { loadModel } from '../live2d/loader'
import { attachTuziDriver, type TuziDriver } from '../live2d/tuzi-driver'
import { useRuntime } from '../stores/runtime'

const MODEL_URL = '/@fs/Users/lixincheng/workspace/HermesPet/live2d/tuzi_mian__2_/tuzi%20mian.model3.json'

const TUZI_GROUPS = {
  lipSync: ['ParamMouthOpenY'],
  eyeBlink: ['ParamEyeLOpen', 'ParamEyeROpen'],
}

const g = globalThis as unknown as {
  __hermespet_driver?: TuziDriver
  __hermespet_model?: Live2DModel
}

const canvas = ref<HTMLCanvasElement | null>(null)
const runtime = useRuntime()

let stage: Live2DStage | null = null
let model: Live2DModel | null = null
let driver: TuziDriver | null = null
let onMove: ((e: MouseEvent) => void) | null = null
let onDown: ((e: MouseEvent) => void) | null = null
let onUp: (() => void) | null = null
let onCanvasLeave: (() => void) | null = null
let onWindowBlur: (() => void) | null = null
let unsubParam: (() => void) | null = null
let unsubPart: (() => void) | null = null
let unsubMouseLeave: (() => void) | null = null
let unsubMouseEnter: (() => void) | null = null
let applyRuntimeOverrides: (() => void) | null = null
let isDragging = false
let dragStartMouseX = 0
let dragStartMouseY = 0
let dragStartWinX = 0
let dragStartWinY = 0
const partOpacityOverrides = new Map<string, number>()
const partSubtreeCache = new Map<string, number[]>()
let lookTarget = { angleX: 0, angleY: 0, eyeX: 0, eyeY: 0 }

const REF_WIDTH = 233
const REF_HEIGHT = 567

function fitModel(m: Live2DModel, viewW: number, viewH: number): void {
  const pad = 0.04
  const maxW = REF_WIDTH * (1 - pad * 2)
  const maxH = REF_HEIGHT * (1 - pad * 2)
  const scale = Math.min(maxW / m.width, maxH / m.height)
  m.scale.set(scale)
  m.x = viewW * 0.24
  m.y = viewH * 0.02
}

function resetEyes(): void {
  lookTarget = { angleX: 0, angleY: 0, eyeX: 0, eyeY: 0 }
  applyLookTarget()
}

function applyLookTarget(): void {
  if (!model) return
  const core = (model as any).internalModel?.coreModel
  if (!core) return
  core.setParameterValueById('ParamAngleX', lookTarget.angleX)
  core.setParameterValueById('ParamAngleY', lookTarget.angleY)
  core.setParameterValueById('ParamEyeBallX', lookTarget.eyeX)
  core.setParameterValueById('ParamEyeBallY', lookTarget.eyeY)
}

function getPartSubtreeIndices(id: string): number[] {
  const cached = partSubtreeCache.get(id)
  if (cached) return cached

  const core = (model as any)?.internalModel?.coreModel
  const rootIndex = core?.getPartIndex?.(id)
  if (typeof rootIndex !== 'number' || rootIndex < 0) return []

  const rawModel = core.getModel?.()
  const parents = rawModel?.parts?.parentPartIndices as ArrayLike<number> | undefined
  if (!parents) return [rootIndex]

  const indices: number[] = []
  const isDescendantOfRoot = (index: number): boolean => {
    if (index === rootIndex) return true
    let parent = parents[index]
    while (typeof parent === 'number' && parent >= 0) {
      if (parent === rootIndex) return true
      parent = parents[parent]
    }
    return false
  }

  const count = core.getPartCount?.() ?? parents.length
  for (let index = 0; index < count; index++) {
    if (isDescendantOfRoot(index)) indices.push(index)
  }

  partSubtreeCache.set(id, indices)
  return indices
}

function setPartOpacity(id: string, opacity: number): void {
  const core = (model as any)?.internalModel?.coreModel
  if (!core?.setPartOpacityById) return

  const indices = getPartSubtreeIndices(id)
  if (indices.length && core.setPartOpacityByIndex) {
    for (const index of indices) {
      core.setPartOpacityByIndex(index, opacity)
    }
    return
  }

  core.setPartOpacityById(id, opacity)
}

function cleanup(): void {
  if (onMove && canvas.value) {
    canvas.value.removeEventListener('mousemove', onMove)
    onMove = null
  }
  if (onDown && canvas.value) {
    canvas.value.removeEventListener('mousedown', onDown)
    onDown = null
  }
  if (onUp) {
    window.removeEventListener('mouseup', onUp)
    onUp = null
  }
  if (onCanvasLeave && canvas.value) {
    canvas.value.removeEventListener('mouseleave', onCanvasLeave)
    onCanvasLeave = null
  }
  if (onWindowBlur) {
    window.removeEventListener('blur', onWindowBlur)
    onWindowBlur = null
  }
  if (applyRuntimeOverrides && model) {
    ;(model.internalModel as any)?.off?.('beforeModelUpdate', applyRuntimeOverrides)
    applyRuntimeOverrides = null
  }
  partOpacityOverrides.clear()
  partSubtreeCache.clear()
  unsubParam?.(); unsubParam = null
  unsubPart?.(); unsubPart = null
  unsubMouseLeave?.(); unsubMouseLeave = null
  unsubMouseEnter?.(); unsubMouseEnter = null
  driver?.destroy()
  driver = null
  g.__hermespet_driver = undefined
  if (model) {
    model.destroy({ children: true, texture: true, baseTexture: true })
    model = null
    g.__hermespet_model = undefined
  }
  stage?.destroy()
  stage = null
}

onMounted(async () => {
  if (!canvas.value) return

  if (g.__hermespet_driver || g.__hermespet_model || stage) {
    cleanup()
  }

  runtime.setStatus('loading')
  try {
    stage = createLive2DStage(canvas.value)
    model = await loadModel({ modelUrl: MODEL_URL, groups: TUZI_GROUPS })

    model.anchor.set(0.5, 0)
    model.interactive = false

    stage.app.stage.addChild(model)
    fitModel(model, stage.app.renderer.width, stage.app.renderer.height)

    const onResize = (): void => {
      if (!stage || !model) return
      fitModel(model, stage.app.renderer.width, stage.app.renderer.height)
    }
    stage.app.renderer.on('resize', onResize)

    const el = canvas.value

    // Mouse-follow eye tracking
    onMove = (e: MouseEvent): void => {
      if (!model) return

      if (isDragging) {
        const newX = dragStartWinX + (e.screenX - dragStartMouseX)
        const newY = dragStartWinY + (e.screenY - dragStartMouseY)
        window.hermes?.pet?.moveWindow(newX, newY)
        return
      }

      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const anchorX = rect.width * 0.5
      const anchorY = rect.height * 0.1
      const nx = Math.max(-1, Math.min(1, (mx - anchorX) / (rect.width * 0.5)))
      const ny = Math.max(-1, Math.min(1, (my - anchorY) / (rect.height * 0.5)))
      lookTarget = {
        angleX: nx * 30,
        angleY: -ny * 30,
        eyeX: nx,
        eyeY: -ny,
      }
      applyLookTarget()
    }
    el.addEventListener('mousemove', onMove)

    // Drag: left-click hold to move window
    onDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      isDragging = true
      dragStartMouseX = e.screenX
      dragStartMouseY = e.screenY
      window.hermes?.pet?.getPosition().then(([wx, wy]) => {
        dragStartWinX = wx
        dragStartWinY = wy
      })
    }
    el.addEventListener('mousedown', onDown)

    onUp = (): void => {
      isDragging = false
    }
    window.addEventListener('mouseup', onUp)

    driver = attachTuziDriver(model)
    g.__hermespet_model = model
    g.__hermespet_driver = driver

    partOpacityOverrides.set('Part28', 1)
    partOpacityOverrides.set('Part20', 0)
    applyRuntimeOverrides = (): void => {
      for (const [id, opacity] of partOpacityOverrides) {
        setPartOpacity(id, opacity)
      }
      applyLookTarget()
    }
    ;(model.internalModel as any)?.on?.('beforeModelUpdate', applyRuntimeOverrides)
    applyRuntimeOverrides()

    onCanvasLeave = (): void => {
      if (!isDragging) resetEyes()
    }
    el.addEventListener('mouseleave', onCanvasLeave)

    onWindowBlur = (): void => {
      isDragging = false
      resetEyes()
    }
    window.addEventListener('blur', onWindowBlur)

    // IPC: model parameter control from chat window
    unsubParam = window.hermes?.pet?.onSetParam?.((id: string, value: number) => {
      console.log('[IPC] setParam', id, value)
      const core = (model as any)?.internalModel?.coreModel
      if (core) core.setParameterValueById(id, value)
    }) ?? null
    unsubPart = window.hermes?.pet?.onSetPartOpacity?.((id: string, opacity: number) => {
      partOpacityOverrides.set(id, opacity)
      setPartOpacity(id, opacity)
    }) ?? null

    // IPC: mouse leave window → reset eyes (sent by main process cursor polling)
    unsubMouseLeave = window.hermes?.pet?.onMouseLeave?.(() => {
      console.log('[IPC] MouseLeave → resetEyes')
      resetEyes()
    }) ?? null
    unsubMouseEnter = window.hermes?.pet?.onMouseEnter?.(() => {
      console.log('[IPC] MouseEnter')
    }) ?? null

    runtime.setStatus('ready')
  } catch (err) {
    console.error('[Live2DStage] failed to load model:', err)
    runtime.setError(err instanceof Error ? err.message : String(err))
  }
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<template>
  <canvas ref="canvas" class="block h-full w-full" />
</template>
