<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import { sendMessage, checkHealth, setHermesConfig, getHermesConfig, type ChatMessage } from '../api/hermes'
import InteractionPanel from '../components/InteractionPanel.vue'
import type { HermesDashboardDetails, HermesDashboardSummary, HermesGatewayStatus, MediaPart, MessagePart } from '@shared/types'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

type Tab =
  | 'chat'
  | 'history'
  | 'groupChat'
  | 'search'
  | 'relay'
  | 'jobs'
  | 'kanban'
  | 'channels'
  | 'skills'
  | 'plugins'
  | 'memory'
  | 'models'
  | 'logs'
  | 'usage'
  | 'skillsUsage'
  | 'gateways'
  | 'profiles'
  | 'settings'
  | 'interaction'

interface NavItem {
  id: Tab
  icon: string
  label: string
  beta?: boolean
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

interface Message {
  id: number
  role: 'user' | 'hermes'
  text: string
  streaming?: boolean
  storedId?: number // ID from the persistent store, used for dedup
  parts?: MessagePart[]
}

const activeTab = ref<Tab>((window.location.hash.slice(1) as Tab) || 'chat')

const messages = ref<Message[]>([])
const input = ref('')
const scrollEl = ref<HTMLDivElement | null>(null)
const isStreaming = ref(false)
const connectionStatus = ref<'checking' | 'connected' | 'disconnected'>('checking')
const conversations = ref<Conversation[]>([])
const historyOpen = ref(false)
const conversationQuery = ref('')
const conversationListCollapsed = ref(false)
const copyFeedbackId = ref<number | null>(null)
const oldestLoadedAt = ref<number | null>(null) // Timestamp of oldest loaded message for pagination
let nextId = 1
const currentConversationId = ref('')
let currentAbort: AbortController | null = null
let unsubSetTab: (() => void) | undefined
let isLoadingOlder = false
const pendingMedia = ref<MediaPart[]>([])
const fileInputEl = ref<HTMLInputElement | null>(null)
const dashboardSummary = ref<HermesDashboardSummary | null>(null)
const dashboardDetails = ref<HermesDashboardDetails | null>(null)
const dashboardLoading = ref(false)
const collapsedNavGroups = ref<Record<string, boolean>>({})

const navGroups: NavGroup[] = [
  {
    id: 'conversation',
    label: '对话',
    items: [
      { id: 'chat', icon: 'chat_bubble', label: '对话' },
      { id: 'history', icon: 'history', label: '历史' },
      { id: 'groupChat', icon: 'groups', label: '群聊', beta: true },
      { id: 'search', icon: 'search', label: '搜索' },
      { id: 'relay', icon: 'open_in_new', label: '中转站' },
    ],
  },
  {
    id: 'agent',
    label: '代理',
    items: [
      { id: 'jobs', icon: 'event_note', label: '任务' },
      { id: 'kanban', icon: 'view_kanban', label: '看板' },
      { id: 'channels', icon: 'hub', label: '频道' },
      { id: 'skills', icon: 'layers', label: '技能' },
      { id: 'plugins', icon: 'extension', label: '插件' },
      { id: 'memory', icon: 'psychology', label: '记忆' },
      { id: 'models', icon: 'neurology', label: '模型' },
    ],
  },
  {
    id: 'monitoring',
    label: '监控',
    items: [
      { id: 'logs', icon: 'article', label: '日志' },
      { id: 'usage', icon: 'bar_chart', label: '用量' },
      { id: 'skillsUsage', icon: 'monitoring', label: '技能用量' },
    ],
  },
  {
    id: 'system',
    label: '系统',
    items: [
      { id: 'gateways', icon: 'dns', label: '网关' },
      { id: 'profiles', icon: 'person', label: '用户' },
      { id: 'interaction', icon: 'touch_app', label: '交互模式' },
      { id: 'settings', icon: 'settings', label: '设置' },
    ],
  },
]

const moduleMeta = computed(() => {
  const all = navGroups.flatMap(group => group.items)
  return all.find(item => item.id === activeTab.value) ?? all[0]
})

const activeModuleInfo = computed(() => {
  return dashboardSummary.value?.modules.find(module => module.id === activeTab.value)
})

const skillTotal = computed(() => {
  return dashboardDetails.value?.skills.reduce((sum, category) => sum + category.skills.length, 0) ?? 0
})

const enabledSkillTotal = computed(() => {
  return dashboardDetails.value?.skills.reduce(
    (sum, category) => sum + category.skills.filter(skill => skill.enabled).length,
    0,
  ) ?? 0
})

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
  const query = conversationQuery.value.trim().toLowerCase()
  const list = query
    ? conversations.value.filter(c => c.title.toLowerCase().includes(query))
    : conversations.value
  for (const c of list) {
    const g = dayGroup(c.createdAt)
    ;(groups[g] ??= []).push(c)
  }
  return groups
})

const currentConversationTitle = computed(() => {
  if (!currentConversationId.value) return '新对话'
  return conversations.value.find(c => c.id === currentConversationId.value)?.title ?? '新对话'
})

function newConversation(): void {
  currentConversationId.value = ''
  messages.value = []
  nextId = 1
  historyOpen.value = false
  pendingMedia.value = []
}

async function ensureConversationId(): Promise<string | null> {
  if (currentConversationId.value) return currentConversationId.value
  const hint = input.value.trim()
  const title = hint ? (hint.length > 30 ? hint.slice(0, 30) + '…' : hint) : '新对话'
  const conv = await window.hermes?.conversations?.create(title)
  if (!conv) return null
  currentConversationId.value = conv.id
  await loadConversations()
  return conv.id
}

async function openConversation(id: string): Promise<void> {
  currentConversationId.value = id
  messages.value = []
  nextId = 1
  historyOpen.value = false
  oldestLoadedAt.value = null
  pendingMedia.value = []

  // Load stored messages for this conversation
  const stored = await window.hermes?.conversations?.getMessages(id) ?? []
  for (const m of stored) {
    messages.value.push({ id: nextId++, role: m.role, text: m.text, storedId: m.id, parts: m.ast })
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

function toggleNavGroup(id: string): void {
  collapsedNavGroups.value = {
    ...collapsedNavGroups.value,
    [id]: !collapsedNavGroups.value[id],
  }
}

function isNavGroupCollapsed(id: string): boolean {
  return !!collapsedNavGroups.value[id]
}

async function loadDashboardSummary(): Promise<void> {
  dashboardLoading.value = true
  try {
    const dashboard = window.hermes?.dashboard
    if (!dashboard) {
      dashboardSummary.value = null
      dashboardDetails.value = null
      return
    }
    const [summary, details] = await Promise.all([
      dashboard.summary(),
      dashboard.details(),
    ])
    dashboardSummary.value = summary
    dashboardDetails.value = details
  } finally {
    dashboardLoading.value = false
  }
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
      .map(m => ({ id: nextId++, role: m.role, text: m.text, storedId: m.id, parts: m.ast }))
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
    switchTab(tab as Tab)
  })
  checkConnection()
  loadConversations()
  if (!['chat', 'settings', 'interaction'].includes(activeTab.value)) loadDashboardSummary()
  if (activeTab.value === 'settings') initHermesCliPanel()
})

onBeforeUnmount(() => {
  unsubSetTab?.()
  currentAbort?.abort()
})

function switchTab(tab: Tab): void {
  activeTab.value = tab
  historyOpen.value = false
  if (tab === 'chat') scrollToBottom()
  if (tab === 'settings' || tab === 'gateways') initHermesCliPanel()
  if (!['chat', 'settings', 'interaction'].includes(tab)) loadDashboardSummary()
}

// Close history dropdown when clicking outside
function onMainClick(): void {
  if (historyOpen.value) historyOpen.value = false
}

function openFilePicker(): void {
  fileInputEl.value?.click()
}

async function onFilesPicked(e: Event): Promise<void> {
  const el = e.target as HTMLInputElement | null
  const files = el?.files ? Array.from(el.files) : []
  if (!files.length) return
  const convId = await ensureConversationId()
  if (!convId) return

  for (const f of files) {
    const sourcePath = window.hermes?.media?.filePath(f)
    if (!sourcePath) continue
    const res = await window.hermes?.media?.import({ conversationId: convId, sourcePath })
    const part = res?.part
    if (part?.kind === 'media') pendingMedia.value = [...pendingMedia.value, part]
  }

  if (el) el.value = ''
}

function renderMessageForContext(msg: Message): string {
  const text = msg.text || ''
  const media = (msg.parts ?? []).filter(p => p.kind === 'media') as MediaPart[]
  if (!media.length) return text
  const lines = media.map(m => `(Attachment: ${m.type} ${m.src})`).join('\n')
  return text ? `${text}\n${lines}` : lines
}

function mediaParts(parts?: MessagePart[]): MediaPart[] {
  return (parts ?? []).filter(p => p.kind === 'media') as MediaPart[]
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if ((!text && pendingMedia.value.length === 0) || isStreaming.value) return

  // 首次消息自动创建会话
  const ensured = await ensureConversationId()
  if (!ensured) return

  const convId = currentConversationId.value

  // Store user message
  const userParts: MessagePart[] = pendingMedia.value.length ? [...pendingMedia.value] : []
  const stored = await window.hermes?.conversations?.addMessage(convId, 'user', text, userParts.length ? userParts : undefined)

  messages.value.push({ id: nextId++, role: 'user', text, storedId: stored?.id, parts: userParts })
  input.value = ''
  pendingMedia.value = []

  const hermesMsgId = nextId++
  const hermesMsg: Message = { id: hermesMsgId, role: 'hermes', text: '', streaming: true }
  messages.value.push(hermesMsg)
  scrollToBottom()

  isStreaming.value = true

  // Build messages array from history for bridge context
  const apiMessages: ChatMessage[] = messages.value
    .filter(m => m.text || (m.parts?.length ?? 0) > 0)
    .map(m => ({ role: m.role === 'hermes' ? 'assistant' : 'user', content: renderMessageForContext(m) }))

  currentAbort = sendMessage({
    sessionId: convId,
    messages: apiMessages,
    onDelta(delta) {
      updateMessage(hermesMsgId, msg => ({ ...msg, text: msg.text + delta }))
      scrollToBottom()
    },
    async onDone(fullText, parts) {
      const doneMsg = updateMessage(hermesMsgId, msg => ({
        ...msg,
        text: fullText || msg.text,
        parts,
        streaming: false,
      }))
      isStreaming.value = false
      currentAbort = null
      if (convId && doneMsg) {
        const stored = await window.hermes?.conversations?.addMessage(convId, 'hermes', doneMsg.text, parts)
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
  baseUrl.value = 'Hermes Agent Bridge'
  apiKey.value = 'local-ipc'
  applySettings()
}

const hermesCliAvailable = ref<'checking' | 'available' | 'missing'>('checking')
const hermesProfiles = ref<string[]>([])
const hermesProfile = ref('default')
const gatewayStatus = ref<HermesGatewayStatus | null>(null)
const gatewayBusy = ref(false)
const gatewayMessage = ref('')

async function refreshHermesCli(): Promise<void> {
  hermesCliAvailable.value = 'checking'
  const ok = await window.hermes?.hermesCli?.check() ?? false
  hermesCliAvailable.value = ok ? 'available' : 'missing'
  if (!ok) return

  hermesProfiles.value = await window.hermes?.hermesCli?.listProfiles() ?? ['default']
  if (!hermesProfiles.value.includes(hermesProfile.value)) {
    hermesProfile.value = hermesProfiles.value[0] || 'default'
  }
}

async function refreshGatewayStatus(): Promise<void> {
  if (hermesCliAvailable.value !== 'available') return
  gatewayStatus.value = await window.hermes?.hermesCli?.gatewayStatus(hermesProfile.value) ?? null
}

async function startGateway(): Promise<void> {
  if (gatewayBusy.value) return
  gatewayBusy.value = true
  gatewayMessage.value = ''
  const res = await window.hermes?.hermesCli?.gatewayStart(hermesProfile.value)
  gatewayMessage.value = res?.ok ? '已触发启动' : (res?.stderr || '启动失败')
  await refreshGatewayStatus()
  gatewayBusy.value = false
}

async function stopGateway(): Promise<void> {
  if (gatewayBusy.value) return
  gatewayBusy.value = true
  gatewayMessage.value = ''
  const res = await window.hermes?.hermesCli?.gatewayStop(hermesProfile.value)
  gatewayMessage.value = res?.ok ? '已触发停止' : (res?.stderr || '停止失败')
  await refreshGatewayStatus()
  gatewayBusy.value = false
}

async function restartGateway(): Promise<void> {
  if (gatewayBusy.value) return
  gatewayBusy.value = true
  gatewayMessage.value = ''
  const res = await window.hermes?.hermesCli?.gatewayRestart(hermesProfile.value)
  gatewayMessage.value = res?.ok ? '已触发重启' : (res?.stderr || '重启失败')
  await refreshGatewayStatus()
  gatewayBusy.value = false
}

async function initHermesCliPanel(): Promise<void> {
  await refreshHermesCli()
  await refreshGatewayStatus()
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
      <nav class="custom-scrollbar flex flex-grow flex-col gap-2 overflow-y-auto px-2">
        <section v-for="group in navGroups" :key="group.id" class="flex flex-col gap-1">
          <button
            class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-2 font-label-caps text-label-caps text-on-surface-variant/75 transition-all hover:bg-surface-variant/30 hover:text-on-surface"
            @click="toggleNavGroup(group.id)"
          >
            <span>{{ group.label }}</span>
            <span
              :class="[
                'material-symbols-outlined text-[16px] transition-transform',
                isNavGroupCollapsed(group.id) ? '-rotate-90' : '',
              ]"
            >expand_more</span>
          </button>
          <div v-show="!isNavGroupCollapsed(group.id)" class="flex flex-col gap-1">
            <button
              v-for="item in group.items"
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
                {{ item.label }}<span v-if="item.beta" class="ml-1 text-[10px] text-on-surface-variant">(beta)</span>
              </span>
            </button>
          </div>
        </section>
      </nav>

      <!-- Footer -->
      <div class="mt-auto border-t border-outline-variant/10 px-4 pt-4">
        <div class="mb-3 space-y-2 rounded-xl bg-surface-container-low/45 p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant">Profile</span>
            <span class="truncate font-mono-status text-mono-status text-on-surface">{{ dashboardSummary?.activeProfile || hermesProfile }}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-label-caps text-label-caps text-on-surface-variant">Bridge</span>
            <span :class="['font-mono-status text-mono-status', connectionStatus === 'connected' ? 'text-primary' : 'text-error']">
              {{ connectionStatus === 'connected' ? 'online' : 'offline' }}
            </span>
          </div>
        </div>
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
        <div class="flex flex-1 overflow-hidden">
          <aside
            :class="[
              'flex flex-col border-r border-outline-variant/15 bg-surface/40 backdrop-blur-2xl transition-all duration-200',
              conversationListCollapsed ? 'w-14' : 'w-80',
            ]"
          >
            <div class="flex items-center justify-between px-5 pt-5 pb-4">
              <div v-if="!conversationListCollapsed" class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-primary">forum</span>
                <span class="font-body-sm font-semibold text-on-surface">对话</span>
              </div>
              <button
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
                :aria-label="conversationListCollapsed ? '展开会话列表' : '收起会话列表'"
                :title="conversationListCollapsed ? '展开会话列表' : '收起会话列表'"
                @click="conversationListCollapsed = !conversationListCollapsed"
              >
                <span class="material-symbols-outlined text-[18px]">
                  {{ conversationListCollapsed ? 'chevron_right' : 'chevron_left' }}
                </span>
              </button>
              <button
                v-if="!conversationListCollapsed"
                class="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
                @click="newConversation"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
                <span class="font-body-sm">新建</span>
              </button>
            </div>
            <div v-if="conversationListCollapsed" class="flex flex-col items-center gap-3 px-2 pb-4">
              <button
                class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
                title="新建对话"
                @click="newConversation"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>
            <div v-if="!conversationListCollapsed" class="px-5 pb-4">
              <input
                v-model="conversationQuery"
                class="glass-border w-full rounded-xl bg-surface-container-highest/60 px-4 py-3 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="搜索对话..."
              />
            </div>
            <div v-if="!conversationListCollapsed" class="custom-scrollbar flex-1 overflow-y-auto px-2 pb-6">
              <template v-if="conversations.length === 0">
                <p class="px-4 py-6 text-center font-body-sm text-on-surface-variant">暂无对话记录</p>
              </template>
              <template v-for="(items, group) in groupedConversations" :key="group">
                <div class="px-4 pt-3 pb-2">
                  <span class="font-label-caps text-label-caps text-primary/60">{{ group }}</span>
                </div>
                <div
                  v-for="item in items"
                  :key="item.id"
                  :class="[
                    'group flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 transition-all hover:bg-surface-variant/35',
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
          </aside>

          <section class="relative flex flex-1 flex-col overflow-hidden" @click="onMainClick">
            <header class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-8 backdrop-blur-xl">
              <div class="flex items-center gap-3">
                <span
                  :class="[
                    'h-2.5 w-2.5 rounded-full',
                    connectionStatus === 'connected' ? 'bg-primary animate-pulse' :
                    connectionStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
                    'bg-error',
                  ]"
                />
                <span class="font-body-sm font-semibold text-on-surface">{{ currentConversationTitle }}</span>
              </div>
              <button
                class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
                @click="switchTab('settings')"
              >
                <span class="material-symbols-outlined text-[18px]">settings</span>
                <span class="font-body-sm">设置</span>
              </button>
            </header>

            <div ref="scrollEl" class="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-12 pb-28 pt-6" @scroll="onScroll">
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
                      <div v-if="msg.text">{{ msg.text }}</div>
                      <div v-if="mediaParts(msg.parts).length" class="mt-3 grid grid-cols-2 gap-3">
                        <template v-for="m in mediaParts(msg.parts)" :key="m.src">
                          <img v-if="m.type === 'image'" :src="m.src" class="glass-border max-h-48 w-full rounded-xl object-cover" />
                          <a v-else :href="m.src" class="glass-border rounded-xl bg-surface-container-low/40 px-3 py-2 font-body-sm text-on-surface-variant hover:text-on-surface">
                            {{ m.type }}
                          </a>
                        </template>
                      </div>
                    </template>
                    <template v-else>
                      <div v-if="msg.text" class="markdown-body" v-html="renderMd(msg.text)"></div>
                      <div v-if="mediaParts(msg.parts).length" class="mt-3 grid grid-cols-2 gap-3">
                        <template v-for="m in mediaParts(msg.parts)" :key="m.src">
                          <img v-if="m.type === 'image'" :src="m.src" class="glass-border max-h-64 w-full rounded-xl object-cover" />
                          <a v-else :href="m.src" class="glass-border rounded-xl bg-surface-container-low/40 px-3 py-2 font-body-sm text-on-surface-variant hover:text-on-surface">
                            {{ m.type }}
                          </a>
                        </template>
                      </div>
                      <div v-if="msg.streaming && msg.text" class="ml-1 inline-block animate-pulse">▍</div>
                      <div v-if="msg.streaming && !msg.text" class="flex items-center gap-1 py-1">
                        <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]"></span>
                        <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]"></span>
                        <span class="inline-block h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]"></span>
                      </div>
                    </template>
                  </div>
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
              <input ref="fileInputEl" type="file" accept="image/*" multiple class="hidden" @change="onFilesPicked" />
              <div v-if="pendingMedia.length" class="mb-3 flex flex-wrap gap-3 rounded-2xl bg-surface-container/60 p-3 backdrop-blur-xl">
                <div v-for="m in pendingMedia" :key="m.src" class="relative">
                  <img v-if="m.type === 'image'" :src="m.src" class="glass-border h-20 w-20 rounded-xl object-cover" />
                  <div v-else class="glass-border flex h-20 w-20 items-center justify-center rounded-xl bg-surface-container-low/40 font-body-xs text-on-surface-variant">
                    {{ m.type }}
                  </div>
                </div>
              </div>
              <div
                class="glass-border flex items-center gap-2 rounded-full bg-surface-container-lowest/90 p-2 shadow-2xl backdrop-blur-2xl focus-within:ring-2 focus-within:ring-primary/20"
              >
                <button class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary" @click="newConversation">
                  <span class="material-symbols-outlined">add_circle</span>
                </button>
                <button class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary" :disabled="isStreaming" @click="openFilePicker">
                  <span class="material-symbols-outlined">attach_file</span>
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
                    :disabled="!input.trim() && pendingMedia.length === 0"
                    @click="send"
                  >
                    <span class="material-symbols-outlined">send</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <!-- ===== Settings Tab ===== -->
      <template v-else-if="activeTab === 'settings'">
        <header class="sticky top-0 z-10 flex h-16 items-center justify-between bg-surface/70 px-8 backdrop-blur-xl">
          <div>
            <h2 class="font-headline-lg text-headline-lg text-primary">Hermes 配置</h2>
            <p class="font-body-sm text-on-surface-variant opacity-80">本地 Hermes Agent Bridge 与桌宠交互行为</p>
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
                <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">Bridge Mode</label>
                <input v-model="baseUrl" class="glass-border w-full rounded-lg bg-surface-container-highest px-4 py-3 font-body-lg text-on-surface outline-none focus:ring-1 focus:ring-primary/50" placeholder="Hermes Agent Bridge" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">Local Auth</label>
                <div class="relative">
                  <input v-model="apiKey" :type="showApiKey ? 'text' : 'password'" class="glass-border w-full rounded-lg bg-surface-container-highest px-4 py-3 pr-10 font-body-lg text-on-surface outline-none focus:ring-1 focus:ring-primary/50" placeholder="local-ipc" />
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

          <section class="glass-panel flex flex-col gap-8 rounded-xl p-8 shadow-2xl">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-3xl text-primary">terminal</span>
                <h2 class="font-headline-md text-headline-md">Hermes CLI 托管</h2>
              </div>
              <div class="flex items-center gap-2">
                <span
                  :class="[
                    'h-2.5 w-2.5 rounded-full',
                    hermesCliAvailable === 'available' ? 'bg-primary animate-pulse' :
                    hermesCliAvailable === 'checking' ? 'bg-yellow-400 animate-pulse' :
                    'bg-error',
                  ]"
                />
                <span class="font-mono-status text-mono-status text-on-surface-variant">
                  {{ hermesCliAvailable === 'available' ? 'CLI 可用' : hermesCliAvailable === 'checking' ? '检测中...' : '未检测到 hermes' }}
                </span>
              </div>
            </div>

            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-6">
                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">Profile</label>
                  <select
                    v-model="hermesProfile"
                    :disabled="hermesCliAvailable !== 'available' || gatewayBusy"
                    class="glass-border appearance-none rounded-lg bg-surface-container-highest px-4 py-3 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
                    @change="refreshGatewayStatus"
                  >
                    <option v-for="p in hermesProfiles" :key="p" :value="p">{{ p }}</option>
                  </select>
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant px-1">Gateway</label>
                  <div class="glass-border flex items-center justify-between rounded-lg bg-surface-container-highest px-4 py-3">
                    <span class="font-body-sm text-on-surface">
                      {{ gatewayStatus?.running ? '运行中' : '未运行' }}
                    </span>
                    <button
                      class="rounded-lg px-3 py-1 font-body-xs text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface disabled:opacity-60"
                      :disabled="hermesCliAvailable !== 'available' || gatewayBusy"
                      @click="refreshGatewayStatus"
                    >
                      刷新
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-3">
                <button
                  class="rounded-xl bg-primary px-6 py-3 font-body-sm font-semibold text-on-primary shadow-xl shadow-primary/30 transition-all hover:bg-primary-fixed-dim active:scale-95 disabled:opacity-60"
                  :disabled="hermesCliAvailable !== 'available' || gatewayBusy"
                  @click="startGateway"
                >
                  启动
                </button>
                <button
                  class="rounded-xl border border-outline-variant/40 px-6 py-3 font-body-sm font-semibold text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface active:scale-95 disabled:opacity-60"
                  :disabled="hermesCliAvailable !== 'available' || gatewayBusy"
                  @click="stopGateway"
                >
                  停止
                </button>
                <button
                  class="rounded-xl border border-outline-variant/40 px-6 py-3 font-body-sm font-semibold text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface active:scale-95 disabled:opacity-60"
                  :disabled="hermesCliAvailable !== 'available' || gatewayBusy"
                  @click="restartGateway"
                >
                  重启
                </button>
              </div>

              <div v-if="gatewayMessage" class="glass-border rounded-lg bg-surface-container-high/60 px-4 py-3 font-body-sm text-on-surface-variant">
                {{ gatewayMessage }}
              </div>

              <details v-if="gatewayStatus?.raw?.stdout || gatewayStatus?.raw?.stderr" class="glass-border rounded-lg bg-surface-container-low/40 px-4 py-3">
                <summary class="cursor-pointer font-body-sm text-on-surface-variant">查看 CLI 输出</summary>
                <pre class="mt-3 whitespace-pre-wrap break-words font-mono-status text-mono-status text-on-surface-variant">{{ gatewayStatus?.raw?.stdout || gatewayStatus?.raw?.stderr }}</pre>
              </details>
            </div>
          </section>

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
                  {{ baseUrl }} | {{ connectionStatus === 'connected' ? 'Bridge 就绪' : '请检查 Hermes Agent 是否启动' }}
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

      <!-- ===== Hermes Web UI Parity Modules ===== -->
      <template v-else>
        <header class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant/10 bg-surface/70 px-8 backdrop-blur-xl">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl text-primary">{{ moduleMeta.icon }}</span>
            <div>
              <h2 class="font-headline-lg text-headline-lg text-primary">{{ moduleMeta.label }}</h2>
              <p class="font-body-sm text-on-surface-variant opacity-80">
                {{ activeModuleInfo?.detail || '按 hermes-web-ui 模块边界预留，后端能力逐步接入。' }}
              </p>
            </div>
          </div>
          <button
            class="glass-border flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 font-body-sm text-on-surface-variant transition-all hover:bg-surface-variant/40 hover:text-on-surface"
            :disabled="dashboardLoading"
            @click="loadDashboardSummary"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            刷新
          </button>
        </header>

        <div class="custom-scrollbar flex-1 overflow-y-auto px-8 pb-24 pt-6">
          <div class="grid grid-cols-3 gap-4">
            <section class="glass-panel rounded-xl p-5">
              <p class="font-label-caps text-label-caps text-on-surface-variant">Profile</p>
              <p class="mt-2 truncate font-headline-md text-headline-md text-on-surface">
                {{ dashboardSummary?.activeProfile || hermesProfile }}
              </p>
            </section>
            <section class="glass-panel rounded-xl p-5">
              <p class="font-label-caps text-label-caps text-on-surface-variant">Gateway</p>
              <p :class="['mt-2 font-headline-md text-headline-md', dashboardSummary?.gateway?.running ? 'text-primary' : 'text-error']">
                {{ dashboardSummary?.gateway?.running ? '运行中' : '未运行' }}
              </p>
            </section>
            <section class="glass-panel rounded-xl p-5">
              <p class="font-label-caps text-label-caps text-on-surface-variant">CLI</p>
              <p :class="['mt-2 font-headline-md text-headline-md', dashboardSummary?.cliAvailable ? 'text-primary' : 'text-error']">
                {{ dashboardSummary?.cliAvailable ? '可用' : '未检测到' }}
              </p>
            </section>
          </div>

          <section v-if="activeTab === 'gateways'" class="glass-panel mt-6 rounded-xl p-6">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div>
                <h3 class="font-headline-md text-headline-md text-on-surface">Gateway 托管</h3>
                <p class="font-body-sm text-on-surface-variant">复用 main 侧 Hermes CLI service，等价于 hermes-web-ui 的 gateway controller/service 边界。</p>
              </div>
              <span :class="['rounded-full px-3 py-1 font-mono-status text-mono-status', gatewayStatus?.running ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error']">
                {{ gatewayStatus?.running ? 'running' : 'stopped' }}
              </span>
            </div>
            <div class="mt-5 grid grid-cols-2 gap-6">
              <div class="flex flex-col gap-2">
                <label class="font-label-caps text-label-caps text-on-surface-variant">Profile</label>
                <select
                  v-model="hermesProfile"
                  :disabled="hermesCliAvailable !== 'available' || gatewayBusy"
                  class="glass-border appearance-none rounded-lg bg-surface-container-highest px-4 py-3 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
                  @change="refreshGatewayStatus"
                >
                  <option v-for="p in hermesProfiles" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="flex items-end gap-3">
                <button class="rounded-xl bg-primary px-6 py-3 font-body-sm font-semibold text-on-primary shadow-xl shadow-primary/30 disabled:opacity-60" :disabled="hermesCliAvailable !== 'available' || gatewayBusy" @click="startGateway">启动</button>
                <button class="rounded-xl border border-outline-variant/40 px-6 py-3 font-body-sm font-semibold text-on-surface-variant hover:bg-surface-variant/40 disabled:opacity-60" :disabled="hermesCliAvailable !== 'available' || gatewayBusy" @click="stopGateway">停止</button>
                <button class="rounded-xl border border-outline-variant/40 px-6 py-3 font-body-sm font-semibold text-on-surface-variant hover:bg-surface-variant/40 disabled:opacity-60" :disabled="hermesCliAvailable !== 'available' || gatewayBusy" @click="restartGateway">重启</button>
              </div>
            </div>
            <p v-if="gatewayMessage" class="mt-4 rounded-lg bg-surface-container-high/60 px-4 py-3 font-body-sm text-on-surface-variant">{{ gatewayMessage }}</p>
          </section>

          <section v-else-if="activeTab === 'models'" class="glass-panel mt-6 rounded-xl p-6">
            <h3 class="font-headline-md text-headline-md text-on-surface">模型分组</h3>
            <div class="mt-5 grid gap-3">
              <div v-for="group in dashboardSummary?.models || []" :key="group.provider" class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <div class="flex items-center justify-between">
                  <span class="font-body-sm font-semibold text-on-surface">{{ group.label }}</span>
                  <span class="font-mono-status text-mono-status text-on-surface-variant">{{ group.models.length }} models</span>
                </div>
                <p class="mt-2 break-words font-mono-status text-mono-status text-on-surface-variant">
                  {{ group.models.slice(0, 8).join(', ') || '当前 profile 未暴露模型列表' }}
                </p>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'logs'" class="glass-panel mt-6 rounded-xl p-6">
            <h3 class="font-headline-md text-headline-md text-on-surface">日志文件</h3>
            <div class="mt-5 grid gap-3">
              <div v-for="log in dashboardSummary?.logs || []" :key="log.path" class="glass-border grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl bg-surface-container-low/40 p-4">
                <span class="truncate font-body-sm text-on-surface">{{ log.name }}</span>
                <span class="font-mono-status text-mono-status text-on-surface-variant">{{ log.size }}</span>
                <span class="font-mono-status text-mono-status text-on-surface-variant">{{ log.modified }}</span>
              </div>
              <p v-if="!dashboardSummary?.logs?.length" class="font-body-sm text-on-surface-variant">未找到 Hermes 日志文件。</p>
            </div>
          </section>

          <section v-else-if="activeTab === 'profiles'" class="glass-panel mt-6 rounded-xl p-6">
            <h3 class="font-headline-md text-headline-md text-on-surface">Profile / 用户</h3>
            <div class="mt-5 grid gap-3">
              <div
                v-for="profile in dashboardDetails?.profiles || []"
                :key="profile.name"
                class="glass-border grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-xl bg-surface-container-low/40 p-4"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-body-sm font-semibold text-on-surface">{{ profile.name }}</span>
                    <span v-if="profile.active" class="rounded-full bg-primary/10 px-2 py-0.5 font-mono-status text-mono-status text-primary">active</span>
                    <span class="rounded-full bg-surface-variant/40 px-2 py-0.5 font-mono-status text-mono-status text-on-surface-variant">{{ profile.kind }}</span>
                  </div>
                  <p class="mt-2 truncate font-mono-status text-mono-status text-on-surface-variant">{{ profile.path }}</p>
                </div>
                <div class="text-right">
                  <p class="font-mono-status text-mono-status text-on-surface-variant">model</p>
                  <p class="max-w-60 truncate font-body-sm text-on-surface">{{ profile.defaultModel || '未配置' }}</p>
                </div>
              </div>
              <p v-if="!dashboardDetails?.profiles?.length" class="font-body-sm text-on-surface-variant">未找到 Hermes profile。</p>
            </div>
          </section>

          <section v-else-if="activeTab === 'skills'" class="glass-panel mt-6 rounded-xl p-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-headline-md text-headline-md text-on-surface">技能目录</h3>
                <p class="font-body-sm text-on-surface-variant">当前启用 {{ enabledSkillTotal }} / {{ skillTotal }} 个技能。</p>
              </div>
            </div>
            <div class="mt-5 grid gap-4">
              <div v-for="category in dashboardDetails?.skills || []" :key="category.name" class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <div class="flex items-center justify-between">
                  <span class="font-body-sm font-semibold text-on-surface">{{ category.name }}</span>
                  <span class="font-mono-status text-mono-status text-on-surface-variant">{{ category.skills.length }} skills</span>
                </div>
                <p v-if="category.description" class="mt-1 font-body-xs text-on-surface-variant">{{ category.description }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="skill in category.skills.slice(0, 16)"
                    :key="skill.name"
                    :class="[
                      'rounded-full px-3 py-1 font-mono-status text-mono-status',
                      skill.enabled ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error',
                    ]"
                    :title="skill.description"
                  >
                    {{ skill.name }} · {{ skill.source }}
                  </span>
                </div>
              </div>
              <p v-if="!dashboardDetails?.skills?.length" class="font-body-sm text-on-surface-variant">当前 profile 没有扫描到 skills 目录。</p>
            </div>
          </section>

          <section v-else-if="activeTab === 'plugins'" class="glass-panel mt-6 rounded-xl p-6">
            <h3 class="font-headline-md text-headline-md text-on-surface">插件目录</h3>
            <div class="mt-5 grid gap-3">
              <div v-for="plugin in dashboardDetails?.plugins || []" :key="plugin.path" class="glass-border grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl bg-surface-container-low/40 p-4">
                <span class="truncate font-body-sm text-on-surface">{{ plugin.name }}</span>
                <span :class="['font-mono-status text-mono-status', plugin.hasManifest ? 'text-primary' : 'text-on-surface-variant']">
                  {{ plugin.hasManifest ? 'manifest' : 'folder' }}
                </span>
                <span class="font-mono-status text-mono-status text-on-surface-variant">{{ plugin.modified || '未知' }}</span>
              </div>
              <p v-if="!dashboardDetails?.plugins?.length" class="font-body-sm text-on-surface-variant">当前 profile 没有扫描到 plugins 目录。</p>
            </div>
          </section>

          <section v-else-if="activeTab === 'memory'" class="glass-panel mt-6 rounded-xl p-6">
            <h3 class="font-headline-md text-headline-md text-on-surface">记忆文件</h3>
            <div class="mt-5 grid gap-3">
              <div v-for="file in dashboardDetails?.memory || []" :key="file.section" class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <span class="font-body-sm font-semibold text-on-surface">{{ file.label }}</span>
                    <p class="mt-1 truncate font-mono-status text-mono-status text-on-surface-variant">{{ file.path }}</p>
                  </div>
                  <span :class="['rounded-full px-3 py-1 font-mono-status text-mono-status', file.exists ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error']">
                    {{ file.exists ? file.size : 'missing' }}
                  </span>
                </div>
                <p v-if="file.preview" class="mt-3 line-clamp-2 font-body-sm text-on-surface-variant">{{ file.preview }}</p>
                <p v-else class="mt-3 font-body-sm text-on-surface-variant">{{ file.exists ? '文件为空。' : '文件不存在。' }}</p>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'usage' || activeTab === 'skillsUsage'" class="glass-panel mt-6 rounded-xl p-6">
            <h3 class="font-headline-md text-headline-md text-on-surface">{{ moduleMeta.label }}</h3>
            <div class="mt-5 grid grid-cols-4 gap-4">
              <div class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <p class="font-label-caps text-label-caps text-on-surface-variant">Conversations</p>
                <p class="mt-2 font-headline-md text-headline-md text-on-surface">{{ dashboardDetails?.usage.conversations ?? 0 }}</p>
              </div>
              <div class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <p class="font-label-caps text-label-caps text-on-surface-variant">Messages</p>
                <p class="mt-2 font-headline-md text-headline-md text-on-surface">{{ dashboardDetails?.usage.messages ?? 0 }}</p>
              </div>
              <div class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <p class="font-label-caps text-label-caps text-on-surface-variant">Input Tokens</p>
                <p class="mt-2 font-headline-md text-headline-md text-on-surface">{{ dashboardDetails?.usage.inputTokens ?? 0 }}</p>
              </div>
              <div class="glass-border rounded-xl bg-surface-container-low/40 p-4">
                <p class="font-label-caps text-label-caps text-on-surface-variant">Output Tokens</p>
                <p class="mt-2 font-headline-md text-headline-md text-on-surface">{{ dashboardDetails?.usage.outputTokens ?? 0 }}</p>
              </div>
            </div>
            <p class="mt-4 rounded-lg bg-surface-container-high/60 px-4 py-3 font-body-sm text-on-surface-variant">
              {{ dashboardDetails?.usage.reason || '等待后端数据。' }}
            </p>
          </section>

          <section v-else class="glass-panel mt-6 rounded-xl p-6">
            <div class="flex items-start gap-4">
              <span class="material-symbols-outlined text-3xl text-primary/80">{{ moduleMeta.icon }}</span>
              <div>
                <h3 class="font-headline-md text-headline-md text-on-surface">{{ moduleMeta.label }}</h3>
                <p class="mt-2 font-body-sm text-on-surface-variant">
                  {{ activeModuleInfo?.detail || '该模块已在导航中补齐，后端会按 hermes-web-ui 对应 controller/service 分批接入。' }}
                </p>
                <p class="mt-4 font-mono-status text-mono-status text-on-surface-variant">
                  状态：{{ activeModuleInfo?.status || 'planned' }}
                </p>
              </div>
            </div>
          </section>
        </div>
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
