import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useRuntime = defineStore('runtime', () => {
  const modelStatus = ref<ModelStatus>('idle')
  const modelError = ref<string | null>(null)

  function setStatus(s: ModelStatus): void {
    modelStatus.value = s
    if (s !== 'error') modelError.value = null
  }

  function setError(message: string): void {
    modelStatus.value = 'error'
    modelError.value = message
  }

  return { modelStatus, modelError, setStatus, setError }
})
