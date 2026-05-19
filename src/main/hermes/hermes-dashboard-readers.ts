import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type {
  HermesMemoryFile,
  HermesMemorySection,
  HermesPluginSummary,
  HermesProfileDetail,
  HermesSkillCategory,
  HermesSkillSummary,
  HermesUsageSummary,
} from '@shared/types'

function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function safeJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function safeDirs(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => entry.name)
  } catch {
    return []
  }
}

function safeFiles(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
  } catch {
    return []
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

function formatModified(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleString() : ''
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function collapsePreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 160)
}

export function activeProfileNameFromBase(baseDir: string): string {
  const active = safeRead(join(baseDir, 'active_profile')).trim()
  return active || 'default'
}

export function resolveProfileDir(baseDir: string, profile: string): string {
  if (!profile || profile === 'default') return baseDir
  const dir = join(baseDir, 'profiles', profile)
  return existsSync(dir) ? dir : baseDir
}

function readDefaultModelFromDir(dir: string): string {
  const content = safeRead(join(dir, 'config.yaml'))
  const objectDefault = content.match(/^\s*default:\s*["']?([^"'\n#]+)["']?/m)?.[1]?.trim()
  if (objectDefault) return objectDefault
  return content.match(/^\s*model:\s*["']?([^"'\n#]+)["']?/m)?.[1]?.trim() || ''
}

export function readDefaultModelForProfile(baseDir: string, profile: string): string {
  return readDefaultModelFromDir(resolveProfileDir(baseDir, profile))
}

export function listProfileDetails(baseDir: string, cliProfiles: string[] = []): HermesProfileDetail[] {
  const active = activeProfileNameFromBase(baseDir)
  const diskProfiles = safeDirs(join(baseDir, 'profiles'))
  const names = unique(['default', ...cliProfiles, ...diskProfiles])
  names.sort((a, b) => {
    if (a === 'default') return -1
    if (b === 'default') return 1
    return a.localeCompare(b)
  })

  return names.map((name): HermesProfileDetail => {
    const path = resolveProfileDir(baseDir, name)
    return {
      name,
      active: name === active,
      path,
      configExists: existsSync(join(path, 'config.yaml')),
      defaultModel: readDefaultModelFromDir(path),
      kind: name === 'default' ? 'root' : 'profile',
    }
  })
}

function memoryPath(baseDir: string, profile: string, section: HermesMemorySection): string {
  const dir = resolveProfileDir(baseDir, profile)
  if (section === 'soul') return join(dir, 'SOUL.md')
  return join(dir, 'memories', section === 'memory' ? 'MEMORY.md' : 'USER.md')
}

export function listMemoryFiles(baseDir: string, profile: string): HermesMemoryFile[] {
  const defs: Array<{ section: HermesMemorySection; label: string }> = [
    { section: 'memory', label: '长期记忆' },
    { section: 'user', label: '用户画像' },
    { section: 'soul', label: '人格设定' },
  ]

  return defs.map(({ section, label }) => {
    const path = memoryPath(baseDir, profile, section)
    const content = safeRead(path)
    try {
      const stat = statSync(path)
      return {
        section,
        label,
        path,
        exists: true,
        size: formatSize(stat.size),
        modified: formatModified(stat.mtimeMs),
        preview: collapsePreview(content),
      }
    } catch {
      return {
        section,
        label,
        path,
        exists: false,
        size: '0B',
        modified: '',
        preview: '',
      }
    }
  })
}

function parseDisabledSkills(configContent: string): string[] {
  const inline = configContent.match(/^\s*disabled:\s*\[([^\]]*)\]/m)?.[1]
  if (inline) {
    return unique(inline.split(',').map(value => value.replace(/["']/g, '')))
  }

  const lines = configContent.split('\n')
  const disabled: string[] = []
  let inDisabled = false
  for (const line of lines) {
    if (/^\s*disabled:\s*$/.test(line)) {
      inDisabled = true
      continue
    }
    if (inDisabled && /^\S/.test(line)) break
    const item = line.match(/^\s*-\s*["']?([^"'\n#]+)["']?/)
    if (inDisabled && item?.[1]) disabled.push(item[1].trim())
  }
  return unique(disabled)
}

function readBundledManifest(skillsDir: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of safeRead(join(skillsDir, '.bundled_manifest')).split('\n')) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const name = line.slice(0, index).trim()
    const hash = line.slice(index + 1).trim()
    if (name && hash) out.set(name, hash)
  }
  return out
}

function readHubInstalledNames(skillsDir: string): Set<string> {
  const data = safeJson(join(skillsDir, '.hub', 'lock.json')) as { installed?: Record<string, unknown> } | null
  return new Set(Object.keys(data?.installed ?? {}))
}

function extractDescription(skillMd: string): string {
  const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/)
  const desc = frontmatter?.[1].match(/^\s*description:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim()
  if (desc) return desc

  const heading = skillMd.split('\n')
    .map(line => line.trim())
    .find(line => line && !line.startsWith('---'))
  return (heading || '').replace(/^#+\s*/, '').slice(0, 120)
}

function skillSource(name: string, bundledManifest: Map<string, string>, hubNames: Set<string>): HermesSkillSummary['source'] {
  if (bundledManifest.has(name)) return 'builtin'
  if (hubNames.has(name)) return 'hub'
  return 'local'
}

function skillSummary(
  category: string,
  name: string,
  skillMd: string,
  disabled: Set<string>,
  bundledManifest: Map<string, string>,
  hubNames: Set<string>,
): HermesSkillSummary {
  return {
    category,
    name,
    description: extractDescription(skillMd),
    enabled: !disabled.has(name),
    source: skillSource(name, bundledManifest, hubNames),
  }
}

export function listSkillCategories(baseDir: string, profile: string): HermesSkillCategory[] {
  const profileDir = resolveProfileDir(baseDir, profile)
  const skillsDir = join(profileDir, 'skills')
  const disabled = new Set(parseDisabledSkills(safeRead(join(profileDir, 'config.yaml'))))
  const bundledManifest = readBundledManifest(skillsDir)
  const hubNames = readHubInstalledNames(skillsDir)
  const categories: HermesSkillCategory[] = []
  const flatSkills: HermesSkillSummary[] = []

  for (const dirName of safeDirs(skillsDir)) {
    const dir = join(skillsDir, dirName)
    const skillMd = safeRead(join(dir, 'SKILL.md'))
    if (skillMd) {
      flatSkills.push(skillSummary('misc', dirName, skillMd, disabled, bundledManifest, hubNames))
      continue
    }

    const skills: HermesSkillSummary[] = []
    for (const childName of safeDirs(dir)) {
      const childMd = safeRead(join(dir, childName, 'SKILL.md'))
      if (childMd) {
        skills.push(skillSummary(dirName, childName, childMd, disabled, bundledManifest, hubNames))
      }
    }
    if (skills.length) {
      skills.sort((a, b) => a.name.localeCompare(b.name))
      categories.push({
        name: dirName,
        description: collapsePreview(safeRead(join(dir, 'DESCRIPTION.md'))),
        skills,
      })
    }
  }

  if (flatSkills.length) {
    flatSkills.sort((a, b) => a.name.localeCompare(b.name))
    categories.push({ name: 'misc', description: '未分组技能', skills: flatSkills })
  }

  return categories.sort((a, b) => a.name.localeCompare(b.name))
}

export function listPluginSummaries(baseDir: string, profile: string): HermesPluginSummary[] {
  const pluginsDir = join(resolveProfileDir(baseDir, profile), 'plugins')
  return safeDirs(pluginsDir).map((name): HermesPluginSummary => {
    const path = join(pluginsDir, name)
    let modified = ''
    try {
      modified = formatModified(statSync(path).mtimeMs)
    } catch {
      modified = ''
    }
    return {
      name,
      path,
      hasManifest: safeFiles(path).some(file => file === 'plugin.json' || file === 'manifest.json'),
      modified,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export function readUsageSummary(userDataPath: string): HermesUsageSummary {
  const data = safeJson(join(userDataPath, 'hermespet', 'conversations.json')) as {
    conversations?: unknown[]
    messages?: unknown[]
  } | null
  return {
    source: 'hermespet-local',
    available: false,
    conversations: Array.isArray(data?.conversations) ? data.conversations.length : 0,
    messages: Array.isArray(data?.messages) ? data.messages.length : 0,
    inputTokens: 0,
    outputTokens: 0,
    reason: 'HermesPet 当前未写入 token 用量；这里只显示本地会话和消息数量。',
  }
}
