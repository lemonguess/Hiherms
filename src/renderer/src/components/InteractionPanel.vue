<script setup lang="ts">
import { ref } from 'vue'

// --- Outfit ---
const activeOutfit = ref('normal')

function setOutfit(id: string): void {
  activeOutfit.value = id
  // Part20 is the dark outfit layer; keep Part28 visible as the base outfit.
  const dark = id === 'dark'
  window.hermes?.pet?.setPartOpacity('Part28', 1)
  window.hermes?.pet?.setPartOpacity('Part20', dark ? 1 : 0)
}

// --- Expressions ---
const activeExpr = ref<string | null>(null)

interface ExpressionDef {
  id: string
  label: string
  icon: string
  params: Record<string, number>
}

const expressions: ExpressionDef[] = [
  { id: 'smile', label: '微笑', icon: '😊', params: { ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamMouthForm: 1 } },
  { id: 'crooked', label: '歪嘴', icon: '😏', params: { Param48: 1, Param50: 1 } },
  { id: 'glare', label: '瞪眼', icon: '😠', params: { Param49: 1, ParamEyeLOpen: 1.3, ParamEyeROpen: 1.3 } },
  { id: 'puff', label: '鼓脸', icon: '😤', params: { Param46: 1 } },
  { id: 'blush', label: '脸红', icon: '🥰', params: { ParamCheek: 1 } },
  { id: 'wink', label: 'wink', icon: '😉', params: { ParamEyeLSmile: 1, ParamEyeLOpen: 0, ParamMouthForm: 0.5 } },
]

const exprDefaults: Record<string, number> = {
  ParamEyeLSmile: 0, ParamEyeRSmile: 0, ParamMouthForm: 0,
  Param48: 0, Param50: 0, Param49: 0,
  ParamEyeLOpen: 1, ParamEyeROpen: 1, Param46: 0, ParamCheek: 0,
}

function resetExprParams(): void {
  for (const [param, val] of Object.entries(exprDefaults)) {
    window.hermes?.pet?.setParam(param, val)
  }
}

function setExpression(id: string): void {
  if (activeExpr.value === id) {
    resetExprParams()
    activeExpr.value = null
    return
  }

  resetExprParams()

  const expr = expressions.find(e => e.id === id)
  if (!expr) return
  for (const [param, val] of Object.entries(expr.params)) {
    window.hermes?.pet?.setParam(param, val)
  }
  activeExpr.value = id
}

function resetExpression(): void {
  resetExprParams()
  activeExpr.value = null
}

// --- Pose sliders ---
const angleX = ref(0)
const angleY = ref(0)
const angleZ = ref(0)

function applyPose(): void {
  window.hermes?.pet?.setParam('ParamAngleX', angleX.value)
  window.hermes?.pet?.setParam('ParamAngleY', angleY.value)
  window.hermes?.pet?.setParam('ParamAngleZ', angleZ.value)
}

function resetPose(): void {
  angleX.value = 0
  angleY.value = 0
  angleZ.value = 0
  applyPose()
}

// --- Full reset ---
function resetAll(): void {
  resetExpression()
  resetPose()
  setOutfit('normal')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-10 flex h-16 items-center justify-between bg-surface/70 px-8 backdrop-blur-xl">
      <div>
        <h2 class="font-headline-lg text-headline-lg text-primary">交互模式</h2>
        <p class="font-body-sm text-on-surface-variant opacity-80">服装切换 / 表情测试 / 姿势控制</p>
      </div>
    </header>

    <div class="flex-1 space-y-6 overflow-y-auto px-8 pb-32 pt-4">
      <!-- Outfit -->
      <section class="glass-panel flex flex-col gap-4 rounded-xl p-6 shadow-2xl">
        <div class="flex items-center gap-3 border-b border-outline-variant/20 pb-3">
          <span class="material-symbols-outlined text-2xl text-primary">checkroom</span>
          <h3 class="font-headline-md text-headline-md">服装</h3>
        </div>
        <div class="flex gap-3">
          <button
            v-for="o in ([{ id: 'normal', label: '常服', icon: 'checkroom' }, { id: 'dark', label: '暗黑', icon: 'dark_mode' }])"
            :key="o.id"
            :class="[
              'flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition-all',
              activeOutfit === o.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:border-primary/40 hover:bg-surface-container',
            ]"
            @click="setOutfit(o.id)"
          >
            <span class="material-symbols-outlined text-2xl" :style="activeOutfit === o.id ? 'font-variation-settings: FILL 1' : ''">{{ o.icon }}</span>
            <span class="font-body-sm font-medium">{{ o.label }}</span>
          </button>
        </div>
      </section>

      <!-- Expressions -->
      <section class="glass-panel flex flex-col gap-4 rounded-xl p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl text-primary">sentiment_satisfied</span>
            <h3 class="font-headline-md text-headline-md">表情</h3>
          </div>
          <button
            v-if="activeExpr"
            class="cursor-pointer rounded-lg px-3 py-1 font-body-sm text-primary transition-colors hover:bg-primary/10"
            @click="resetExpression"
          >
            重置
          </button>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="e in expressions"
            :key="e.id"
            :class="[
              'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 transition-all',
              activeExpr === e.id
                ? 'border-primary bg-primary/10'
                : 'border-outline-variant/30 bg-surface-container-low hover:border-primary/40 hover:bg-surface-container',
            ]"
            @click="setExpression(e.id)"
          >
            <span class="text-2xl leading-none">{{ e.icon }}</span>
            <span class="font-body-xs text-on-surface-variant">{{ e.label }}</span>
          </button>
        </div>
      </section>

      <!-- Pose -->
      <section class="glass-panel flex flex-col gap-4 rounded-xl p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl text-primary">face</span>
            <h3 class="font-headline-md text-headline-md">头部姿势</h3>
          </div>
          <button
            class="cursor-pointer rounded-lg px-3 py-1 font-body-sm text-primary transition-colors hover:bg-primary/10"
            @click="resetPose"
          >
            重置
          </button>
        </div>
        <div class="space-y-4">
          <div class="flex items-center gap-4">
            <span class="w-12 font-body-sm text-on-surface-variant">左右</span>
            <input v-model.number="angleX" type="range" :min="-30" :max="30" :step="1" class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-surface-container-highest accent-primary" @input="applyPose" />
            <span class="w-10 text-right font-mono-status text-mono-status text-on-surface-variant">{{ angleX }}°</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="w-12 font-body-sm text-on-surface-variant">上下</span>
            <input v-model.number="angleY" type="range" :min="-30" :max="30" :step="1" class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-surface-container-highest accent-primary" @input="applyPose" />
            <span class="w-10 text-right font-mono-status text-mono-status text-on-surface-variant">{{ angleY }}°</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="w-12 font-body-sm text-on-surface-variant">旋转</span>
            <input v-model.number="angleZ" type="range" :min="-30" :max="30" :step="1" class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-surface-container-highest accent-primary" @input="applyPose" />
            <span class="w-10 text-right font-mono-status text-mono-status text-on-surface-variant">{{ angleZ }}°</span>
          </div>
        </div>
      </section>

      <!-- Reset all -->
      <button
        class="glass-border flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-error/20 py-3 font-body-sm font-medium text-error transition-all hover:bg-error/10 active:scale-[0.98]"
        @click="resetAll"
      >
        <span class="material-symbols-outlined text-[18px]">restart_alt</span>
        全部重置
      </button>
    </div>
  </div>
</template>
