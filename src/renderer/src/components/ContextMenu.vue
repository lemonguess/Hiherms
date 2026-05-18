<script setup lang="ts">
const emit = defineEmits<{
  action: [action: string]
}>()

interface MenuItem {
  icon: string
  label: string
  action: string
  shortcut?: string
  accent?: boolean
  danger?: boolean
  active?: boolean
}

const menuItems: MenuItem[][] = [
  [
    { icon: 'chat', label: '开启对话', action: 'chat', shortcut: '⌘K' },
    { icon: 'history', label: '历史会话', action: 'history' },
    { icon: 'settings', label: '系统设置', action: 'settings' },
    { icon: 'touch_app', label: '交互模式', action: 'interaction', active: true },
  ],
  [
    { icon: 'visibility_off', label: '隐藏宠物', action: 'hide' },
    { icon: 'power_settings_new', label: '退出程序', action: 'quit', danger: true },
  ],
]

function handleClick(item: MenuItem): void {
  emit('action', item.action)
}
</script>

<template>
  <nav
    class="w-64 overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-high/70 py-2 shadow-2xl backdrop-blur-3xl"
    style="box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)"
    @click.stop
  >
    <!-- Header -->
    <div class="mb-1 px-4 py-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-container/20 bg-primary-container/10"
        >
          <span
            class="material-symbols-outlined text-primary-container"
            style="font-variation-settings: 'FILL' 1"
            >smart_toy</span
          >
        </div>
        <div>
          <h2 class="font-headline-md text-headline-md font-bold text-primary">HermesPet</h2>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            AI Companion
          </p>
        </div>
      </div>
    </div>

    <div class="mx-4 mb-2 h-px bg-outline-variant/20"></div>

    <!-- Menu groups -->
    <template v-for="(group, gi) in menuItems" :key="gi">
      <ul class="space-y-0.5 px-2">
        <li v-for="item in group" :key="item.action">
          <button
            :class="[
              'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all active:translate-x-1',
              item.danger
                ? 'text-error/80 hover:bg-error/10 hover:text-error'
                : item.active
                  ? 'border-l-4 border-primary-fixed-dim bg-primary-container/10 text-primary-fixed-dim'
                  : 'text-on-surface-variant hover:bg-white/5 hover:text-primary',
            ]"
            @click="handleClick(item)"
          >
            <span
              class="material-symbols-outlined text-[20px]"
              :style="item.active ? 'font-variation-settings: FILL 1' : ''"
            >{{ item.icon }}</span>
            <span
              :class="[
                'font-body-md text-body-md',
                item.active ? 'font-bold' : '',
              ]"
            >{{ item.label }}</span>
            <span v-if="item.shortcut" class="ml-auto font-mono-status text-[10px] text-on-surface-variant/40">
              {{ item.shortcut }}
            </span>
            <span
              v-if="item.active"
              class="ml-auto h-1.5 w-1.5 rounded-full bg-primary-container"
            ></span>
          </button>
        </li>
      </ul>
      <div v-if="gi < menuItems.length - 1" class="mx-2 my-2 h-px bg-outline-variant/10"></div>
    </template>
  </nav>
</template>
