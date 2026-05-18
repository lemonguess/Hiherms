import { Live2DModel } from 'pixi-live2d-display/cubism4'

/**
 * Live2D model3.json may ship with empty `Groups.LipSync` / `Groups.EyeBlink`
 * arrays (tuzi_mian's case). pixi-live2d-display only wires the auto-blink /
 * lipsync controllers when those groups have parameter IDs in them, so we
 * patch the parsed JSON before the factory builds the model.
 *
 * Pass in the **actual parameter IDs the loaded model exposes** — never
 * abstract names. See project.md §20.1 for tuzi_mian's IDs.
 */
export interface GroupOverrides {
  lipSync?: string[]
  eyeBlink?: string[]
}

export interface LoadOptions {
  /** Absolute or alias-resolved URL to the model3.json file. */
  modelUrl: string
  /** Group overrides applied before Live2DFactory builds the model. */
  groups?: GroupOverrides
}

interface ModelGroupRaw {
  Target?: string
  Name?: string
  Ids?: string[]
}

interface Model3Settings {
  Groups?: ModelGroupRaw[]
  url?: string
  [key: string]: unknown
}

function patchGroups(settings: Model3Settings, overrides: GroupOverrides): void {
  const groups = (settings.Groups ??= [])
  const ensure = (name: 'LipSync' | 'EyeBlink', ids: string[]): void => {
    if (!ids.length) return
    const existing = groups.find((g) => g.Name === name)
    if (existing) {
      if (!existing.Ids?.length) existing.Ids = [...ids]
      return
    }
    groups.push({ Target: 'Parameter', Name: name, Ids: [...ids] })
  }
  if (overrides.lipSync) ensure('LipSync', overrides.lipSync)
  if (overrides.eyeBlink) ensure('EyeBlink', overrides.eyeBlink)
}

export async function loadModel(opts: LoadOptions): Promise<Live2DModel> {
  const res = await fetch(opts.modelUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch model3.json: ${res.status} ${res.statusText} (${opts.modelUrl})`)
  }
  const settings = (await res.json()) as Model3Settings
  if (opts.groups) patchGroups(settings, opts.groups)
  // pixi-live2d-display resolves relative texture/moc paths against settings.url.
  settings.url = opts.modelUrl

  const model = await Live2DModel.from(settings as never, { autoUpdate: true })
  return model
}
