<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import { sendMessage, checkHealth, setHermesConfig, getHermesConfig, type ChatMessage } from '../api/hermes'
import InteractionPanel from '../components/InteractionPanel.vue'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

type Tab = 'chat' | 'settings' | 'interaction'

interface Message {
  id: number
  role: 'user' | 'hermes'
  text: string
  streaming?: boolean
  storedId?: number // ID from the persistent store, used for dedup
}

const activeTab = ref<Tab>((window.location.hash.slice(1) as Tab) || 'chat')

const messages = ref<Message[]>([])
const input = ref('')
const scrollEl = ref<HTMLDivElement | null>(null)
const isStreaming = ref(false)
const connectionStatus = ref<'checking' | 'connected' | 'disconnected'>('checking')
const conversations = ref<Conversation[]>([])
const historyOpen = ref(false)
const copyFeedbackId = ref<number | null>(null)
const oldestLoadedAt = ref<number | null>(null) // Timestamp of oldest loaded message for pagination
let nextId = 1
const currentConversationId = ref('')
let currentAbort: AbortController | null = null
let unsubSetTab: (() => void) | undefined
let isLoadingOlder = false

// --- Conversations ---

async function loadConversations(): Promise<void> {
  conversations.value = await window.hermes?.conversations?.list() ?? []
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const d = new Date(ts)
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dayGroup(ts: number): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86_400_000
  const week = today - 7 * 86_400_000
  if (ts >= today) return '今天'
  if (ts >= yesterday) return '昨天'
  if (ts >= week) return '过去 7 天'
  return '更早'
}

const groupedConversations = computed(() => {
  const groups: Record<string, Conversation[]> = {}
  for (const c of conversations.value) {
    const g = dayGroup(c.createdAt)
    ;(groups[g] ??= []).push(c)
  }
  return groups
})

const currentConversationTitle = computed(() => {
  if (!currentConversationId.value) return '新对话'
  return conversations.value.find(c => c.id === currentConversationId.value)?.title ?? '新对话'
})

function toggleHistory(): void {
  if (!historyOpen.value) loadConversations()
  historyOpen.value = !historyOpen.value
}

function newConversation(): void {
  currentConversationId.value = ''
  messages.value = []
  nextId = 1
  historyOpen.value = false
}

async function openConversation(id: string): Promise<void> {
  currentConversationId.value = id
  messages.value = []
  nextId = 1
  historyOpen.value = false
  oldestLoadedAt.value = null

  // Load stored messages for this conversation
  const stored = await window.hermes?.conversations?.getMessages(id) ?? []
  for (const m of stored) {
    messages.value.push({ id: nextId++, role: m.role, text: m.text, storedId: m.id })
    if (!oldestLoadedAt.value || m.createdAt < oldestLoadedAt.value) {
      oldestLoadedAt.value = m.createdAt
    }
  }
  scrollToBottom()
}

async function deleteConversation(id: string, e: Event): Promise<void> {
  e.stopPropagation()
  await window.hermes?.conversations?.remove(id)
  if (currentConversationId.value === id) newConversation()
  await loadConversations()
}

// --- Chat ---

function scrollToBottom(): void {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

function updateMessage(id: number, updater: (msg: Message) => Message): Message | null {
  const index = messages.value.findIndex(m => m.id === id)
  if (index === -1) return null
  const next = updater(messages.value[index])
  messages.value[index] = next
  return next
}

async function checkConnection(): Promise<void> {
  connectionStatus.value = 'checking'
  const ok = await checkHealth()
  connectionStatus.value = ok ? 'connected' : 'disconnected'
}

async function loadOlderMessages(): Promise<void> {
  if (!currentConversationId.value || isLoadingOlder || !oldestLoadedAt.value) return
  isLoadingOlder = true
  const stored = await window.hermes?.conversations?.getMessages(currentConversationId.value, oldestLoadedAt.value, 10) ?? []
  if (stored.length > 0) {
    // Deduplicate: skip messages whose storedId is already displayed
    const existingIds = new Set(messages.value.map(m => m.storedId).filter(Boolean))
    const prepend: Message[] = stored
      .filter(m => !existingIds.has(m.id))
      .map(m => ({ id: nextId++, role: m.role, text: m.text, storedId: m.id }))
    if (prepend.length > 0) {
      messages.value = [...prepend, ...messages.value]
      oldestLoadedAt.value = stored[0].createdAt
    }
  }
  isLoadingOlder = false
}

function onScroll(): void {
  if (!scrollEl.value) return
  if (scrollEl.value.scrollTop < 60) {
    loadOlderMessages()
  }
}

onMounted(() => {
  scrollToBottom()
  unsubSetTab = window.hermes?.chat?.onSetTab((tab: string) => {
    activeTab.value = tab as Tab
    if (tab === 'chat') scrollToBottom()
  })
  checkConnection()
  loadConversations()
})

onBeforeUnmount(() => {
  unsubSetTab?.()
  currentAbort?.abort()
})

function switchTab(tab: Tab): void {
  activeTab.value = tab
  historyOpen.value = false
  if (tab === 'chat') scrollToBottom()
}

// Close history dropdown when clicking outside
function onMainClick(): void {
  if (historyOpen.value) historyOpen.value = false
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || isStreaming.value) return

  // 首次消息自动创建会话
  if (!currentConversationId.value) {
    const title = text.length > 30 ? text.slice(0, 30) + '…' : text
    const conv = await window.hermes?.conversations?.create(title)
    if (conv) {
      currentConversationId.value = conv.id
      await loadConversations()
    }
  }

  const convId = currentConversationId.value

  // Store user message
  const stored = await window.hermes?.conversations?.addMessage(convId, 'user', text)

  messages.value.push({ id: nextId++, role: 'user', text, storedId: stored?.id })
  input.value = ''

  const hermesMsgId = nextId++
  const hermesMsg: Message = { id: hermesMsgId, role: 'hermes', text: '', streaming: true }
  messages.value.push(hermesMsg)
  scrollToBottom()

  isStreaming.value = true

  // Build messages array from history for API context
  const apiMessages: ChatMessage[] = messages.value
    .filter(m => m.text) // skip empty streaming placeholders
    .map(m => ({ role: m.role === 'hermes' ? 'assistant' : 'user', content: m.text }))

  currentAbort = sendMessage({
    messages: apiMessages,
    onDelta(delta) {
      updateMessage(hermesMsgId, msg => ({ ...msg, text: msg.text + delta }))
      scrollToBottom()
    },
    async onDone(fullText) {
      const doneMsg = updateMessage(hermesMsgId, msg => ({
        ...msg,
        text: fullText || msg.text,
        streaming: false,
      }))
      isStreaming.value = false
      currentAbort = null
      if (convId && doneMsg) {
        const stored = await window.hermes?.conversations?.addMessage(convId, 'hermes', doneMsg.text)
        updateMessage(hermesMsgId, msg => ({ ...msg, storedId: stored?.id }))
      }
      scrollToBottom()
    },
    onError(err) {
      updateMessage(hermesMsgId, msg => ({
        ...msg,
        text: `Error: ${err.message}`,
        streaming: false,
      }))
      isStreaming.value = false
      currentAbort = null
      connectionStatus.value = 'disconnected'
    },
  })
}

function stopStreaming(): void {
  currentAbort?.abort()
  currentAbort = null
  isStreaming.value = false
  const last = messages.value[messages.value.length - 1]
  if (last?.streaming) last.streaming = false
}

function close(): void {
  window.hermes?.chat?.close()
}

function copyMessage(msgId: number, text: string): void {
  navigator.clipboard.writeText(text)
  copyFeedbackId.value = msgId
  setTimeout(() => {
    if (copyFeedbackId.value === msgId) copyFeedbackId.value = null
  }, 2000)
}

function speakMessage(text: string): void {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)
}

function renderMd(text: string): string {
  return md.render(text)
}

// --- Settings ---
const hermesConfig = getHermesConfig()
const baseUrl = ref(hermesConfig.baseUrl)
const apiKey = ref(hermesConfig.apiKey)
const language = ref('zh-CN')
const timeout = ref(30)
const ttsEngine = ref('azure')
const ttsUrl = ref('https://eastasia.tts.speech.microsoft.com/')
const pitch = ref(1.2)
const speed = ref(1.0)
const showApiKey = ref(false)

function applySettings(): void {
  setHermesConfig({ baseUrl: baseUrl.value, apiKey: apiKey.value })
  checkConnection()
}

function resetSettings(): void {
  baseUrl.value = 'http://127.0.0.1:8642/v1'
  apiKey.value = 'hermespet-local-dev'
  applySettings()
}
</script>

<template>
  <div class="flex h-screen w-full">
    <!-- Sidebar -->
    <aside
      class="flex w-60 flex-col rounded-r-xl border-r border-outline-variant/20 bg-surface-container/70 py-6 backdrop-blur-2xl shadow-xl"
    >
      <!-- Logo -->
      <div class="mb-6 flex flex-col items-center gap-2 px-6">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary-container/20"
        >
          <span
            class="material-symbols-outlined text-3xl text-primary"
            style="font-variation-settings: 'FILL' 1"
            >pets</span
          >
        </div>
        <div class="text-center">
          <h1 class="font-headline-md text-headline-md text-primary">HermesPet</h1>
          <p class="font-mono-status text-mono-status text-on-surface-variant opacity-70">
            V0.1.0 Online
          </p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex flex-grow flex-col gap-1 px-2">
        <button
          v-for="item in ([{ id: 'chat', icon: 'chat_bubble', label: '当前会话' }, { id: 'interaction', icon: 'touch_app', label: '交互模式' }, { id: 'settings', icon: 'settings', label: '系统设置' }] as const)"
          :key="item.id"
          :class="[
            'flex cursor-pointer items-center gap-3 px-4 py-3 transition-all',
            activeTab === item.id
              ? 'active-tab-glow border-l-4 border-primary bg-secondary-container/50 text-primary'
              : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface',
          ]"
          @click="switchTab(item.id)"
        >
          <span class="material-symbols-outlined" :style="activeTab === item.id ? 'font-variation-settings: FILL 1' : ''">
            {{ item.icon }}
          </span>
          <span class="font-body-sm text-body-sm">
            {{ item.label }}
          </span>
        </button>
      </nav>

      <!-- Footer -->
      <div class="mt-auto border-t border-outline-variant/10 px-4 pt-4">
        <button
          class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
          @click="close"
        >
          <span class="material-symbols-outlined">close</span>
          <span class="font-body-sm text-body-sm">关闭窗口</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="relative flex flex-1 flex-col overflow-hidden">
      <!-- ===== Chat Tab ===== -->
      <template v-if="activeTab === 'chat'">
        <header class="sticky top-0 z-20 flex h-12 items-center justify-between bg-surface/70 px-8 backdrop-blur-xl">
          <!-- History dropdown -->
          <div class="relative">
            <button
              class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
              @click="toggleHistory"
            >
              <span class="material-symbols-outlined text-[18px]">history</span>
              <span class="font-body-sm max-w-[180px] truncate">{{ currentConversationTitle }}</span>
              <span class="material-symbols-outlined text-[16px] transition-transform" :class="{ 'rotate-180': historyOpen }">expand_more</span>
            </button>

            <!-- Dropdown panel -->
            <div
              v-if="historyOpen"
              class="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-high/95 shadow-2xl backdrop-blur-3xl"
              @click.stop
            >
              <!-- New conversation button -->
              <button
                class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-primary transition-all hover:bg-primary/10"
                @click="newConversation"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
                <span class="font-body-sm">新对话</span>
              </button>
              <div class="mx-3 h-px bg-outline-variant/20"></div>

              <!-- Conversation groups -->
              <template v-if="conversations.length === 0">
                <p class="px-4 py-6 text-center font-body-sm text-on-surface-variant">暂无对话记录</p>
              </template>
              <template v-for="(items, group) in groupedConversations" :key="group">
                <div class="px-4 pt-3 pb-1">
                  <span class="font-label-caps text-label-caps text-primary/60">{{ group }}</span>
                </div>
                <div
                  v-for="item in items"
                  :key="item.id"
                  :class="[
                    'group flex cursor-pointer items-center justify-between px-4 py-2.5 transition-all hover:bg-surface-variant/40',
                    item.id === currentConversationId ? 'bg-primary-container/10' : '',
                  ]"
                  @click="openConversation(item.id)"
                >
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate font-body-sm font-medium text-on-surface">{{ item.title }}</h3>
                    <p class="font-body-xs text-[11px] text-on-surface-variant">{{ formatTime(item.createdAt) }}</p>
                  </div>
                  <button
                    class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-outline-variant opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100"
                    @click="deleteConversation(item.id, $event)"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </template>
            </div>
          </div>

          <button
            class="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
            @click="newConversation"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span class="font-body-sm">新对话</span>
          </button>
        </header>
        <div ref="scrollEl" class="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-12 pb-28 pt-4" @scroll="onScroll" @click="onMainClick">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'"
          >
            <div>
              <div
                :class="[
                  'w-fit max-w-[85%] select-text px-4 py-3 shadow-lg',
                  msg.role === 'user'
                    ? 'glass-border rounded-xl rounded-tr-none bg-surface-container-high/80 font-body-lg text-body-lg text-on-surface backdrop-blur-xl'
                    : 'hermes-accent-line glass-border rounded-xl rounded-tl-none bg-surface-container/60 font-body-lg text-body-lg text-on-surface backdrop-blur-xl',
                ]"
              >
                <template v-if="msg.role === 'user'">
                  {{ msg.text }}
                </template>
                <template v-else>
                  <div v-if="msg.text" class="markdown-body" v-html="renderMd(msg.text)"></div>
                  <div v-if="msg.streaming && msg.text" class="ml-1 inline-block animate-pulse">▍</div>
                  <div v-if="msg.streaming && !msg.text" class="flex items-center gap-1 py-1">
                    <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]"></span>
                    <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]"></span>
                    <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]"></span>
                  </div>
                </template>
              </div>
              <!-- Action buttons: below the bubble, left-aligned for hermes -->
              <div v-if="msg.role === 'hermes' && !msg.streaming && msg.text" class="mt-1.5 flex gap-2">
                <button
                  :class="[
                    'glass-border flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 font-label-caps text-label-caps transition-all hover:bg-surface-variant/40',
                    copyFeedbackId === msg.id ? 'text-primary' : 'text-on-surface-variant',
                  ]"
                  @click="copyMessage(msg.id, msg.text)"
                >
                  <span class="material-symbols-outlined text-[14px]">
                    {{ copyFeedbackId === msg.id ? 'check' : 'content_copy' }}
                  </span>
                  {{ copyFeedbackId === msg.id ? '已复制' : '复制' }}
                </button>
                <button
                  class="glass-border flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 font-label-caps text-label-caps text-on-surface-variant transition-all hover:bg-surface-variant/40"
                  @click="speakMessage(msg.text)"
                >
                  <span class="material-symbols-outlined text-[14px]">volume_up</span>
                  播报
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute bottom-6 left-1/2 w-full max-w-3xl -translate-x-1/2 px-6">
          <div
            class="glass-border flex items-center gap-2 rounded-full bg-surface-container-lowest/90 p-2 shadow-2xl backdrop-blur-2xl focus-within:ring-2 focus-within:ring-primary/20"
          >
            <button class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary" @click="newConversation">
              <span class="material-symbols-outlined">add_circle</span>
            </button>
            <input
              v-model="input"
              :disabled="isStreaming"
              class="flex-grow border-none bg-transparent px-2 font-body-lg text-on-surface outline-none placeholder:text-on-surface-variant/50 focus:ring-0 disabled:opacity-50"
              placeholder="与 Hermes 交流..."
              @keyup.enter="send"
            />
            <div class="flex items-center gap-1 pr-1">
              <button class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary">
                <span class="material-symbols-outlined">mic</span>
              </button>
              <button
                v-if="isStreaming"
                class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-error text-on-error shadow-lg transition-all active:scale-95"
                @click="stopStreaming"
              >
                <span class="material-symbols-outlined">stop</span>
              </button>
              <button
                v-else
                class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-all active:scale-95"
                :disabled="!input.trim()"
                @click="send"
              >
                <span class="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== Settings Tab ===== -->
      <template v-else-if="activeTab === 'settings'">
        <header class="sticky top-0 z-10 flex h-16 items-center justify-between bg-surface/70 px-8 backdrop-blur-xl">
          <div>
            <h2 class="font-headline-lg text-headline-lg text-primary">Hermes 配置</h2>
            <p class="font-body-sm text-on-surface-variant opacity-80">自定义您的 AI 伴侣性能参数与交互行为</p>
          </div>
        </header>
        <div class="flex-1 space-y-8 overflow-y-auto px-8 pb-32 pt-2">
          <!-- LLM Config -->
          <section class="glass-panel flex flex-col gap-8 rounded-xl p-8 shadow-2xl">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-3xl text-primary">hub</span>
                <h2 class="font-headline-md text-headline-md">Hermes Agent 连接</h2>
              </div>
              <div class="flex items-center gap-2">
                <span
                  :class="[
                    'h-2.5 w-2.5 rounded-full',
                    connectionStatus === 'connected' ? 'bg-primary animate-pulse' :
                    connectionStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
                    'bg-error',
                  ]"
                />
                <span class="font-mono-status text-mono-status text-on-surface-variant">
                  {{ connectionStatus === 'connected' ? '已连接' : connectionStatus === 'checking' ? '检测中...' : '未连接' }}
                </span>
              </div>
            </div>
            <div class="space-y-6">
              <div class="flex flex-col gap-2">
                <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">Base URL</label>
                <input v-model="baseUrl" class="glass-border w-full rounded-lg bg-surface-container-highest px-4 py-3 font-body-lg text-on-surface outline-none focus:ring-1 focus:ring-primary/50" placeholder="请输入接口地址" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">API Key</label>
                <div class="relative">
                  <input v-model="apiKey" :type="showApiKey ? 'text' : 'password'" class="glass-border w-full rounded-lg bg-surface-container-highest px-4 py-3 pr-10 font-body-lg text-on-surface outline-none focus:ring-1 focus:ring-primary/50" placeholder="请输入授权密钥" />
                  <span class="material-symbols-outlined absolute right-3 top-3 cursor-pointer text-on-surface-variant hover:text-primary" @click="showApiKey = !showApiKey">
                    {{ showApiKey ? 'visibility_off' : 'visibility' }}
                  </span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-6">
                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">语言选择</label>
                  <select v-model="language" class="glass-border appearance-none rounded-lg bg-surface-container-highest px-4 py-3 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/50">
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English (US)</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">响应超时 (s)</label>
                  <input v-model.number="timeout" type="number" class="glass-border rounded-lg bg-surface-container-highest px-4 py-3 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              </div>
            </div>
          </section>

          <!-- Voice Config -->
          <section class="glass-panel flex flex-col gap-8 rounded-xl p-8 shadow-2xl">
            <div class="flex items-center gap-3 border-b border-outline-variant/20 pb-4">
              <span class="material-symbols-outlined text-3xl text-primary">settings_voice</span>
              <h2 class="font-headline-md text-headline-md">语音设置</h2>
            </div>
            <div class="grid grid-cols-2 gap-10">
              <div class="space-y-6">
                <div class="flex flex-col gap-3">
                  <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">TTS 引擎</label>
                  <div class="flex flex-col gap-3">
                    <label v-for="engine in ([{v:'azure',l:'Microsoft Azure (推荐)'},{v:'openai',l:'OpenAI TTS'},{v:'custom',l:'自定义 (Custom)'}])" :key="engine.v"
                      :class="['glass-border flex cursor-pointer items-center gap-3 rounded-lg border-l-4 p-4 transition-all hover:bg-surface-variant/40', ttsEngine === engine.v ? 'border-primary bg-surface-container-low' : 'border-transparent bg-surface-container-low']">
                      <input v-model="ttsEngine" :value="engine.v" type="radio" class="h-5 w-5 border-outline bg-transparent text-primary focus:ring-primary" />
                      <span class="font-body-sm font-medium">{{ engine.l }}</span>
                    </label>
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">TTS Base URL</label>
                  <input v-model="ttsUrl" class="glass-border rounded-lg bg-surface-container-highest px-4 py-3 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/50" placeholder="请输入语音服务接口地址" />
                </div>
              </div>
              <div class="flex flex-col justify-between space-y-8">
                <div class="space-y-8">
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">音调 (Pitch)</label>
                      <span class="rounded bg-primary/10 px-2 py-0.5 font-mono-status text-mono-status text-primary">{{ pitch.toFixed(1) }}x</span>
                    </div>
                    <input v-model.number="pitch" type="range" min="0.5" max="2.0" step="0.1" class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-highest accent-primary" />
                  </div>
                  <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                      <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">语速 (Speed)</label>
                      <span class="rounded bg-primary/10 px-2 py-0.5 font-mono-status text-mono-status text-primary">{{ speed.toFixed(1) }}x</span>
                    </div>
                    <input v-model.number="speed" type="range" min="0.5" max="2.0" step="0.1" class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-highest accent-primary" />
                  </div>
                </div>
                <button class="glass-border group flex items-center justify-center gap-3 rounded-xl border-2 border-primary/20 px-6 py-4 font-medium text-primary transition-all hover:bg-primary/10 active:scale-95">
                  <span class="material-symbols-outlined text-2xl group-hover:animate-pulse">play_circle</span>
                  <span class="font-body-sm">测试语音效果</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Status Bar -->
          <section class="glass-panel flex flex-col items-center justify-between gap-6 rounded-xl border-primary/20 bg-primary/5 p-6 shadow-2xl md:flex-row">
            <div class="flex items-center gap-5">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <span
                  :class="['material-symbols-outlined text-3xl', connectionStatus === 'connected' ? 'text-primary' : 'text-error']"
                  style="font-variation-settings: 'FILL' 1"
                >{{ connectionStatus === 'connected' ? 'check_circle' : 'error' }}</span>
              </div>
              <div>
                <p class="font-headline-md font-semibold" :class="connectionStatus === 'connected' ? 'text-primary' : 'text-error'">
                  {{ connectionStatus === 'connected' ? 'Hermes Agent 已连接' : 'Hermes Agent 未连接' }}
                </p>
                <p class="font-mono-status text-mono-status text-on-surface-variant opacity-80">
                  {{ baseUrl }} | {{ connectionStatus === 'connected' ? 'API 就绪' : '请检查 Hermes Agent 是否启动' }}
                </p>
              </div>
            </div>
            <div class="flex w-full gap-4 md:w-auto">
              <button class="flex-1 rounded-xl border border-outline-variant/40 px-8 py-3 font-body-sm font-semibold text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface active:scale-95 md:flex-none" @click="resetSettings">重置默认</button>
              <button class="flex-1 rounded-xl bg-primary px-10 py-3 font-body-sm font-semibold text-on-primary shadow-xl shadow-primary/30 transition-all hover:bg-primary-fixed-dim active:scale-95 md:flex-none" @click="applySettings">保存并应用</button>
            </div>
          </section>
        </div>
      </template>

      <!-- ===== Interaction Tab ===== -->
      <template v-else-if="activeTab === 'interaction'">
        <InteractionPanel />
      </template>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.markdown-body :deep(p) {
  margin: 0 0 0.5em;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(code) {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.15em 0.4em;
  font-size: 0.9em;
  font-family: 'JetBrains Mono', monospace;
}
.markdown-body :deep(pre) {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75em 1em;
  margin: 0.5em 0;
  overflow-x: auto;
}
.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.25em 0;
}
.markdown-body :deep(li) {
  margin: 0.15em 0;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid rgba(0, 218, 243, 0.4);
  padding-left: 0.75em;
  margin: 0.5em 0;
  opacity: 0.85;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 0.5em 0 0.25em;
  font-weight: 600;
}
.markdown-body :deep(a) {
  color: #00daf3;
  text-decoration: underline;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.3em 0.6em;
}
.markdown-body :deep(th) {
  background: rgba(255, 255, 255, 0.05);
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 0.75em 0;
}
</style>
