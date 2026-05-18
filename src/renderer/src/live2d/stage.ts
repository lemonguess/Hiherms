import { Application, Ticker, TickerPlugin } from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

const g = globalThis as unknown as { __hermespet_stage?: Live2DStage }

let registered = false

function ensureRegistered(): void {
  if (registered) return
  Live2DModel.registerTicker(Ticker)
  Application.registerPlugin(TickerPlugin)
  registered = true
}

export interface Live2DStage {
  app: Application
  destroy: () => void
}

export function createLive2DStage(canvas: HTMLCanvasElement): Live2DStage {
  if (g.__hermespet_stage) {
    g.__hermespet_stage.destroy()
    g.__hermespet_stage = undefined
  }

  ensureRegistered()

  const app = new Application({
    view: canvas,
    autoStart: true,
    antialias: true,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: canvas.parentElement ?? canvas,
  })

  const stage: Live2DStage = {
    app,
    destroy() {
      app.destroy(true, { children: true, texture: true, baseTexture: true })
    },
  }
  g.__hermespet_stage = stage
  return stage
}
