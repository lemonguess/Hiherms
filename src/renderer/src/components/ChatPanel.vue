<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'

const emit = defineEmits<{ close: [] }>()

interface Message {
  id: number
  role: 'user' | 'hermes'
  text: string
}

const messages = ref<Message[]>([
  { id: 1, role: 'hermes', text: '你好！我是 Hermes，你的桌面伙伴。有什么我可以帮你的吗？' },
  { id: 2, role: 'user', text: '最近有什么待办事项？' },
  { id: 3, role: 'hermes', text: '我已经为您同步了本周的所有待办事项。注意到您周四下午有一个重要的设计评审，我已经预留了两个小时的专注时间。' },
])

const input = ref('')
const scrollEl = ref<HTMLDivElement | null>(null)
let nextId = 4

function scrollToBottom(): void {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

onMounted(scrollToBottom)

function send(): void {
  const text = input.value.trim()
  if (!text) return
  messages.value.push({ id: nextId++, role: 'user', text })
  input.value = ''
  scrollToBottom()
}
</script>

<template>
  <div class="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center p-4" @click.self="emit('close')">
    <!-- Panel (centered, leaving space for pet on right) -->
    <div class="glass-panel flex h-full max-h-[calc(100%-2rem)] w-full max-w-md flex-col rounded-xl shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-lg">pets</span>
          <span class="font-headline-md text-headline-md text-primary">Hermes</span>
        </div>
        <button
          class="cursor-pointer rounded-full p-1 text-on-surface-variant hover:text-primary transition-colors"
          @click="emit('close')"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Messages -->
      <div ref="scrollEl" class="flex-1 overflow-y-auto space-y-4 px-4 py-4">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'"
        >
          <div
            :class="[
              'max-w-[80%] px-4 py-3 shadow-lg',
              msg.role === 'user'
                ? 'glass-border bg-surface-container-high/80 backdrop-blur-xl rounded-xl rounded-tr-none text-on-surface text-body-lg'
                : 'hermes-accent-line glass-border bg-surface-container/60 backdrop-blur-xl rounded-xl rounded-tl-none text-on-surface text-body-lg',
            ]"
          >
            {{ msg.text }}
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="px-4 pb-4 pt-2">
        <div
          class="glass-border bg-surface-container-lowest/90 backdrop-blur-2xl rounded-full p-2 flex items-center gap-2 shadow-2xl focus-within:ring-2 ring-primary/20"
        >
          <input
            v-model="input"
            class="flex-grow bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 px-2 font-body-lg outline-none"
            placeholder="与 Hermes 交流..."
            @keyup.enter="send"
          />
          <div class="flex items-center gap-1 pr-1">
            <button
              class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-xl">mic</span>
            </button>
            <button
              class="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
              @click="send"
            >
              <span class="material-symbols-outlined text-xl">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
