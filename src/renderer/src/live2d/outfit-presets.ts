export type OutfitId = 'normal' | 'dark'

export interface OutfitPreset {
  id: OutfitId
  parts: Record<string, number>
  params: Record<string, number>
}

const PRESETS: Record<OutfitId, OutfitPreset> = {
  normal: {
    id: 'normal',
    parts: {
      Part28: 1,
      Part20: 0,
    },
    params: {},
  },
  dark: {
    id: 'dark',
    parts: {
      Part28: 1,
      Part20: 1,
    },
    params: {},
  },
}

export function getOutfitPreset(id: OutfitId): OutfitPreset {
  return PRESETS[id]
}
