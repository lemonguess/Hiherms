import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { BridgeClient } from './bridge-client'

function resolveExecutable(command: string): string | undefined {
  const trimmed = command.trim()
  if (!trimmed) return undefined
  if (isAbsolute(trimmed) || trimmed.includes('/') || trimmed.includes('\\')) {
    return existsSync(trimmed) ? resolve(trimmed) : undefined
  }
  try {
    const lookup = process.platform === 'win32'
      ? execFileSync('where.exe', [trimmed], { encoding: 'utf-8', windowsHide: true })
      : execFileSync('which', [trimmed], { encoding: 'utf-8' })
    return lookup.split(/\r?\n/).map(line => line.trim()).find(Boolean)
  } catch {
    return undefined
  }
}

function pythonFromHermesBin(): string | undefined {
  const hermesBin = resolveExecutable(process.env.HERMES_BIN || 'hermes')
  if (!hermesBin) return undefined
  try {
    const first = readFileSync(hermesBin, 'utf-8').split(/\r?\n/, 1)[0]
    const match = first.match(/^#!\s*(.+)$/)
    const raw = match?.[1]?.trim()
    if (!raw) return undefined
    const parts = raw.split(/\s+/)
    if (parts[0].endsWith('/env') && parts[1]) return resolveExecutable(parts[1])
    return existsSync(parts[0]) ? parts[0] : undefined
  } catch {
    return undefined
  }
}

function resolvePython(): string {
  const explicit = process.env.HERMESPET_BRIDGE_PYTHON || process.env.HERMES_AGENT_BRIDGE_PYTHON
  if (explicit) return explicit
  return pythonFromHermesBin()
    || resolveExecutable(process.platform === 'win32' ? 'python' : 'python3')
    || (process.platform === 'win32' ? 'python' : 'python3')
}

function bridgeScriptPath(): string {
  const resourcesPath = process.resourcesPath
  const candidates = [
    resolve(process.cwd(), 'src/main/hermes/hermespet_bridge.py'),
    resolve(process.cwd(), 'out/main/hermespet_bridge.py'),
    resourcesPath ? resolve(resourcesPath, 'hermespet_bridge.py') : '',
    resolve(dirname(process.execPath), 'hermespet_bridge.py'),
  ].filter(Boolean)

  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) throw new Error(`HermesPet bridge script not found. Tried: ${candidates.join(', ')}`)
  return found
}

export class HermesBridgeManager {
  readonly endpoint: string
  private child: ChildProcess | null = null
  private client: BridgeClient | null = null
  private starting: Promise<BridgeClient> | null = null

  constructor() {
    this.endpoint = process.platform === 'win32'
      ? 'tcp://127.0.0.1:18766'
      : `ipc:///tmp/hermespet-agent-bridge-${process.pid}.sock`
  }

  isAvailable(): boolean {
    try {
      return existsSync(bridgeScriptPath()) && Boolean(resolvePython())
    } catch {
      return false
    }
  }

  async start(): Promise<BridgeClient> {
    if (this.client && this.child && !this.child.killed) return this.client
    if (this.starting) return this.starting
    this.starting = this.startProcess()
    try {
      return await this.starting
    } finally {
      this.starting = null
    }
  }

  async stop(): Promise<void> {
    const child = this.child
    const client = this.client
    this.child = null
    this.client = null
    if (client) {
      try {
        await client.shutdown()
      } catch {
        // process may already be gone
      }
    }
    if (child && !child.killed) child.kill()
  }

  private async startProcess(): Promise<BridgeClient> {
    const script = bridgeScriptPath()
    const python = resolvePython()
    const child = spawn(python, [script, '--endpoint', this.endpoint], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HERMESPET_BRIDGE_ENDPOINT: this.endpoint,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child = child

    child.stderr?.on('data', chunk => {
      const text = String(chunk).trim()
      if (text) console.warn('[hermespet-bridge]', text)
    })
    child.once('exit', (code, signal) => {
      console.warn('[hermespet-bridge] exited', code, signal)
      if (this.child === child) this.child = null
      this.client = null
    })

    await new Promise<void>((resolveReady, rejectReady) => {
      let buffered = ''
      const timeout = setTimeout(() => {
        cleanup()
        rejectReady(new Error('HermesPet bridge did not become ready within 120000ms'))
      }, 120_000)

      const cleanup = (): void => {
        clearTimeout(timeout)
        child.off('exit', onExit)
        child.off('error', onError)
        child.stdout?.off('data', onStdout)
      }
      const onError = (err: Error): void => {
        cleanup()
        rejectReady(err)
      }
      const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        cleanup()
        rejectReady(new Error(`HermesPet bridge exited before ready code=${code} signal=${signal}`))
      }
      const onStdout = (chunk: Buffer): void => {
        buffered += chunk.toString('utf8')
        for (;;) {
          const newline = buffered.indexOf('\n')
          if (newline < 0) break
          const line = buffered.slice(0, newline).trim()
          buffered = buffered.slice(newline + 1)
          if (!line) continue
          try {
            const event = JSON.parse(line) as { event?: string }
            if (event.event === 'ready') {
              cleanup()
              resolveReady()
              return
            }
          } catch {
            console.log('[hermespet-bridge]', line)
          }
        }
      }

      child.once('error', onError)
      child.once('exit', onExit)
      child.stdout?.on('data', onStdout)
    })

    const client = new BridgeClient(this.endpoint)
    this.client = client
    return client
  }
}
