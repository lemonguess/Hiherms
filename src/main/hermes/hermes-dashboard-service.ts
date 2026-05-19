import { ipcMain } from 'electron'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { IPC } from '@shared/ipc-channels'
import type {
  HermesDashboardDetails,
  HermesDashboardModule,
  HermesDashboardSummary,
  HermesGatewayRow,
  HermesLogFile,
  HermesModelGroup,
} from '@shared/types'
import { checkHermesCliAvailable, gatewayStatus, listHermesProfiles } from './hermes-cli'
import {
  listMemoryFiles,
  listPluginSummaries,
  listProfileDetails,
  listSkillCategories,
  readDefaultModelForProfile,
  readUsageSummary,
  resolveProfileDir,
} from './hermes-dashboard-readers'

function hermesBaseDir(): string {
  return process.env.HERMES_HOME || join(homedir(), '.hermes')
}

function activeProfileName(): string {
  try {
    const raw = readFileSync(join(hermesBaseDir(), 'active_profile'), 'utf-8').trim()
    return raw || 'default'
  } catch {
    return 'default'
  }
}

function profileDir(profile: string): string {
  return resolveProfileDir(hermesBaseDir(), profile)
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function readDefaultModel(profile: string): string {
  return readDefaultModelForProfile(hermesBaseDir(), profile)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function modelsFromAuth(profile: string): HermesModelGroup[] {
  const auth = readJson(join(profileDir(profile), 'auth.json')) as Record<string, unknown> | null
  const currentModel = readDefaultModel(profile)
  const groups: HermesModelGroup[] = []
  const providers = auth?.providers && typeof auth.providers === 'object' ? auth.providers : {}
  const credentialPool = auth?.credential_pool && typeof auth.credential_pool === 'object' ? auth.credential_pool : {}

  for (const [provider, raw] of Object.entries(providers)) {
    const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const models = unique([
      ...(Array.isArray(data.models) ? data.models.map(String) : []),
      ...(typeof data.model === 'string' ? [data.model] : []),
    ])
    groups.push({
      provider,
      label: provider,
      models,
      current: !!currentModel && models.includes(currentModel),
    })
  }

  for (const [provider, raw] of Object.entries(credentialPool)) {
    if (groups.some(group => group.provider === provider)) continue
    const entries = Array.isArray(raw) ? raw : []
    const models = unique(entries.flatMap(entry => {
      if (!entry || typeof entry !== 'object') return []
      const data = entry as Record<string, unknown>
      if (Array.isArray(data.models)) return data.models.map(String)
      return typeof data.model === 'string' ? [data.model] : []
    }))
    groups.push({
      provider,
      label: provider,
      models,
      current: !!currentModel && models.includes(currentModel),
    })
  }

  if (groups.length === 0 && currentModel) {
    groups.push({ provider: 'config', label: 'config.yaml', models: [currentModel], current: true })
  }

  return groups
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

function listLogFilesForProfile(profile: string, userDataPath: string): HermesLogFile[] {
  const dirs = [
    join(profileDir(profile), 'logs'),
    join(hermesBaseDir(), 'logs'),
    join(userDataPath, 'hermespet', 'logs'),
  ]
  const out: HermesLogFile[] = []
  const seen = new Set<string>()

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (seen.has(path)) continue
      seen.add(path)
      try {
        const stat = statSync(path)
        if (!stat.isFile()) continue
        out.push({
          name: basename(path),
          path,
          size: formatSize(stat.size),
          modified: stat.mtime.toLocaleString(),
        })
      } catch {
        // ignore disappearing log files
      }
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function dashboardModules(): HermesDashboardModule[] {
  return [
    { id: 'chat', label: '对话', status: 'available', detail: '本地 Bridge 对话与图片附件已接入' },
    { id: 'history', label: '历史', status: 'available', detail: '读取 HermesPet 本地会话记录' },
    { id: 'groupChat', label: '群聊', status: 'planned', detail: 'Hermes group-chat socket 尚未映射到桌宠 IPC' },
    { id: 'search', label: '搜索', status: 'planned', detail: '待接入会话全文索引' },
    { id: 'relay', label: '中转站', status: 'planned', detail: '待接入上游 relay / proxy 配置' },
    { id: 'jobs', label: '任务', status: 'planned', detail: '待接入 hermes-web-ui jobs controller 对应能力' },
    { id: 'kanban', label: '看板', status: 'planned', detail: '待接入 Hermes kanban service' },
    { id: 'channels', label: '频道', status: 'planned', detail: '待接入平台 channel 配置' },
    { id: 'gateways', label: '网关', status: 'partial', detail: '支持 profile 级 status/start/stop/restart' },
    { id: 'models', label: '模型', status: 'partial', detail: '从 Hermes profile auth/config 只读发现模型' },
    { id: 'logs', label: '日志', status: 'partial', detail: '从 Hermes profile 日志目录只读列出文件' },
    { id: 'usage', label: '用量', status: 'partial', detail: '显示本地会话规模；token 用量等待 Hermes usage store 接入' },
    { id: 'skillsUsage', label: '技能用量', status: 'partial', detail: '显示技能清单规模；调用统计等待 Hermes skill usage DB 接入' },
    { id: 'skills', label: '技能', status: 'available', detail: '扫描当前 profile skills 目录，按 category 展示' },
    { id: 'plugins', label: '插件', status: 'partial', detail: '扫描当前 profile plugins 目录，展示本地插件概况' },
    { id: 'memory', label: '记忆', status: 'available', detail: '读取当前 profile MEMORY / USER / SOUL 文件状态' },
    { id: 'profiles', label: '用户', status: 'available', detail: '读取 Hermes active_profile 与 profiles 目录' },
  ]
}

async function gatewayRows(activeProfile: string, profiles: string[], cliAvailable: boolean): Promise<HermesGatewayRow[]> {
  const rows: HermesGatewayRow[] = []
  for (const profile of unique(['default', ...profiles])) {
    if (!cliAvailable || profile !== activeProfile) {
      rows.push({ profile, active: profile === activeProfile, running: null, status: 'unknown' })
      continue
    }

    try {
      const { running, raw } = await gatewayStatus(profile)
      rows.push({
        profile,
        active: true,
        running,
        status: running ? 'running' : 'stopped',
        raw,
      })
    } catch {
      rows.push({ profile, active: true, running: null, status: 'unknown' })
    }
  }
  return rows
}

export class HermesDashboardService {
  constructor(private readonly userDataPath: string) {}

  register(): void {
    ipcMain.handle(IPC.HermesDashboard.Models, async (): Promise<HermesModelGroup[]> => {
      return modelsFromAuth(activeProfileName())
    })
    ipcMain.handle(IPC.HermesDashboard.Logs, async (): Promise<HermesLogFile[]> => {
      return listLogFilesForProfile(activeProfileName(), this.userDataPath)
    })
    ipcMain.handle(IPC.HermesDashboard.Details, async (): Promise<HermesDashboardDetails> => {
      const activeProfile = activeProfileName()
      const cliAvailable = await checkHermesCliAvailable()
      const { profiles } = cliAvailable ? await listHermesProfiles() : { profiles: ['default'] }
      return {
        profiles: listProfileDetails(hermesBaseDir(), profiles),
        gateways: await gatewayRows(activeProfile, profiles, cliAvailable),
        skills: listSkillCategories(hermesBaseDir(), activeProfile),
        plugins: listPluginSummaries(hermesBaseDir(), activeProfile),
        memory: listMemoryFiles(hermesBaseDir(), activeProfile),
        usage: readUsageSummary(this.userDataPath),
      }
    })
    ipcMain.handle(IPC.HermesDashboard.Summary, async (): Promise<HermesDashboardSummary> => {
      const activeProfile = activeProfileName()
      const cliAvailable = await checkHermesCliAvailable()
      const { profiles } = await listHermesProfiles()
      let gateway = null
      if (cliAvailable) {
        try {
          const { running, raw } = await gatewayStatus(activeProfile)
          gateway = { profile: activeProfile, running, raw }
        } catch {
          gateway = null
        }
      }
      return {
        cliAvailable,
        activeProfile,
        profiles,
        gateway,
        models: modelsFromAuth(activeProfile),
        logs: listLogFilesForProfile(activeProfile, this.userDataPath),
        modules: dashboardModules(),
      }
    })
  }
}
