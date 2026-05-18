import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { AgentRunEvent, AgentRunStarted, AgentSendRequest } from '@shared/types'
import { HermesBridgeManager } from './bridge-manager'

const HERMESPET_SYSTEM_PROMPT = `You are HermesPet Desktop Assistant.

You may output HermesPet Runtime Protocol tags:
<speech tone="soft" speed="1.0" emotion="happy">text for TTS</speech>
<emotion value="happy" intensity="0.8" />
<motion action="wave" />
<media type="image" src="..." />
<tool name="..." status="running" />
<status state="thinking" detail="..." />

Rules:
1. Put user-visible chat text as plain text outside protocol tags.
2. Do not explain protocol tags.
3. Protocol tags are runtime intents. HermesPet executes them.
4. Keep responses natural and concise.`

export class HermesBridgeService {
  private readonly manager = new HermesBridgeManager()
  private readonly activeRuns = new Map<string, string>()

  register(): void {
    ipcMain.handle(IPC.Agent.Check, () => this.manager.isAvailable())
    ipcMain.handle(IPC.Agent.Send, async (event, request: AgentSendRequest): Promise<AgentRunStarted> => {
      return this.send(event.sender, request)
    })
    ipcMain.handle(IPC.Agent.Abort, async (_event, sessionId: string, runId?: string): Promise<boolean> => {
      return this.abort(sessionId, runId)
    })
  }

  async stop(): Promise<void> {
    await this.manager.stop()
  }

  private async send(webContents: WebContents, request: AgentSendRequest): Promise<AgentRunStarted> {
    if (!request.sessionId) throw new Error('sessionId is required')
    if (!request.message.trim()) throw new Error('message is required')

    const client = await this.manager.start()
    const instructions = request.instructions
      ? `${HERMESPET_SYSTEM_PROMPT}\n\n${request.instructions}`
      : HERMESPET_SYSTEM_PROMPT
    const started = await client.chat({ ...request, instructions })
    this.activeRuns.set(started.run_id, request.sessionId)
    void this.pumpRun(webContents, started.run_id, request.sessionId)
    return { sessionId: request.sessionId, runId: started.run_id }
  }

  private async abort(sessionId: string, runId?: string): Promise<boolean> {
    try {
      const client = await this.manager.start()
      await client.interrupt(sessionId)
      if (runId) this.activeRuns.delete(runId)
      return true
    } catch (err) {
      console.warn('[HermesBridgeService] abort failed', err)
      return false
    }
  }

  private async pumpRun(webContents: WebContents, runId: string, sessionId: string): Promise<void> {
    try {
      const client = await this.manager.start()
      for await (const chunk of client.streamOutput(runId)) {
        if (webContents.isDestroyed()) break
        for (const event of chunk.events) {
          this.emit(webContents, { type: 'runtime-event', sessionId, runId, event })
        }
        if (chunk.delta) {
          this.emit(webContents, { type: 'delta', sessionId, runId, delta: chunk.delta })
        }
        if (chunk.done) {
          if (chunk.status === 'error') {
            this.emit(webContents, {
              type: 'error',
              sessionId,
              runId,
              error: chunk.error || 'Hermes bridge run failed',
            })
          } else {
            this.emit(webContents, { type: 'done', sessionId, runId, fullText: chunk.output })
          }
          break
        }
      }
    } catch (err) {
      this.emit(webContents, {
        type: 'error',
        sessionId,
        runId,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      this.activeRuns.delete(runId)
    }
  }

  private emit(webContents: WebContents, event: AgentRunEvent): void {
    if (!webContents.isDestroyed()) webContents.send(IPC.Agent.Event, event)
  }
}
