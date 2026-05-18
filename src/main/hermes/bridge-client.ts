import { createConnection, type Socket } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { URL } from 'node:url'
import type { AgentSendRequest } from '@shared/types'

export type BridgeRunStatus = 'running' | 'complete' | 'interrupted' | 'error'

export interface BridgeResponse {
  ok: boolean
  error?: string | null
  [key: string]: unknown
}

export interface BridgeChatStarted extends BridgeResponse {
  ok: true
  session_id: string
  run_id: string
  status: BridgeRunStatus
}

export interface BridgeOutput extends BridgeResponse {
  ok: true
  session_id: string
  run_id: string
  status: BridgeRunStatus
  delta: string
  output: string
  cursor: number
  events: Array<Record<string, unknown>>
  event_cursor: number
  done: boolean
  error?: string | null
}

export class BridgeClient {
  private lock: Promise<unknown> = Promise.resolve()

  constructor(
    readonly endpoint: string,
    readonly timeoutMs = 120_000,
  ) {}

  async chat(request: AgentSendRequest): Promise<BridgeChatStarted> {
    return this.request<BridgeChatStarted>({
      action: 'chat',
      session_id: request.sessionId,
      message: request.message,
      conversation_history: request.history ?? [],
      instructions: request.instructions ?? '',
      model: request.model ?? '',
      provider: request.provider ?? '',
    })
  }

  async getOutput(runId: string, cursor: number, eventCursor: number): Promise<BridgeOutput> {
    return this.request<BridgeOutput>({
      action: 'get_output',
      run_id: runId,
      cursor,
      event_cursor: eventCursor,
    }, 15_000)
  }

  async *streamOutput(runId: string): AsyncGenerator<BridgeOutput> {
    let cursor = 0
    let eventCursor = 0
    for (;;) {
      const chunk = await this.getOutput(runId, cursor, eventCursor)
      cursor = chunk.cursor
      eventCursor = chunk.event_cursor
      if (chunk.delta || chunk.done || chunk.events.length > 0) yield chunk
      if (chunk.done) return
      await delay(80)
    }
  }

  async interrupt(sessionId: string): Promise<BridgeResponse> {
    return this.request({ action: 'interrupt', session_id: sessionId }, 10_000)
  }

  async shutdown(): Promise<BridgeResponse> {
    return this.request({ action: 'shutdown' }, 5_000)
  }

  private async request<T extends BridgeResponse>(payload: Record<string, unknown>, timeoutMs = this.timeoutMs): Promise<T> {
    const run = async (): Promise<T> => {
      const socket = await this.connectSocket()
      try {
        socket.write(`${JSON.stringify(payload)}\n`)
        const raw = await this.readResponse(socket, timeoutMs)
        const response = JSON.parse(raw) as BridgeResponse
        if (!response.ok) throw new Error(response.error || 'Hermes bridge request failed')
        return response as T
      } finally {
        socket.end()
      }
    }

    const next = this.lock.then(run, run)
    this.lock = next.catch(() => undefined)
    return next
  }

  private connectSocket(): Promise<Socket> {
    return new Promise((resolveConnect, rejectConnect) => {
      let socket: Socket
      if (this.endpoint.startsWith('ipc://')) {
        socket = createConnection(this.endpoint.slice('ipc://'.length))
      } else if (this.endpoint.startsWith('tcp://')) {
        const url = new URL(this.endpoint)
        socket = createConnection({
          host: url.hostname || '127.0.0.1',
          port: Number(url.port),
        })
      } else {
        rejectConnect(new Error(`Unsupported Hermes bridge endpoint: ${this.endpoint}`))
        return
      }

      const cleanup = (): void => {
        socket.off('connect', onConnect)
        socket.off('error', onError)
      }
      const onConnect = (): void => {
        cleanup()
        resolveConnect(socket)
      }
      const onError = (err: Error): void => {
        cleanup()
        socket.destroy()
        rejectConnect(err)
      }

      socket.once('connect', onConnect)
      socket.once('error', onError)
    })
  }

  private readResponse(socket: Socket, timeoutMs: number): Promise<string> {
    return new Promise((resolveRead, rejectRead) => {
      let buffer = ''
      const timeout = setTimeout(() => {
        cleanup()
        socket.destroy()
        rejectRead(new Error(`Hermes bridge timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const cleanup = (): void => {
        clearTimeout(timeout)
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('end', onEnd)
        socket.off('close', onClose)
      }
      const finish = (line: string): void => {
        cleanup()
        resolveRead(line)
      }
      const onData = (chunk: Buffer): void => {
        buffer += chunk.toString('utf8')
        const newline = buffer.indexOf('\n')
        if (newline >= 0) finish(buffer.slice(0, newline))
      }
      const onError = (err: Error): void => {
        cleanup()
        rejectRead(err)
      }
      const onEnd = (): void => {
        const line = buffer.trim()
        if (line) finish(line)
      }
      const onClose = (): void => {
        if (!buffer.trim()) {
          cleanup()
          rejectRead(new Error('Hermes bridge socket closed without response'))
        }
      }

      socket.on('data', onData)
      socket.once('error', onError)
      socket.once('end', onEnd)
      socket.once('close', onClose)
    })
  }
}
