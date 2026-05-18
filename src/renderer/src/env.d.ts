import type { AgentRunEvent, AgentRunStarted, AgentSendRequest, MessagePart } from '@shared/types'

declare global {
  interface Conversation {
    id: string
    title: string
    createdAt: number
  }

  interface StoredMessage {
    id: number
    conversationId: string
    role: 'user' | 'hermes'
    text: string
    createdAt: number
    ast?: MessagePart[]
  }

  interface Window {
    hermes?: {
      window: {
        minimize: () => void
        close: () => void
        toggleAlwaysOnTop: () => void
      }
      chat: {
        open: (tab?: string) => void
        close: () => void
        setTab: (tab: string) => void
        onSetTab: (cb: (tab: string) => void) => () => void
      }
      agent: {
        check: () => Promise<boolean>
        send: (request: AgentSendRequest) => Promise<AgentRunStarted>
        abort: (sessionId: string, runId?: string) => Promise<boolean>
        onEvent: (cb: (event: AgentRunEvent) => void) => () => void
      }
      pet: {
        hide: () => void
        show: () => void
        setClickThrough: (enable: boolean) => void
        moveWindow: (x: number, y: number) => void
        getPosition: () => Promise<[number, number]>
        setParam: (id: string, value: number) => void
        setPartOpacity: (id: string, opacity: number) => void
        onSetParam: (cb: (id: string, value: number) => void) => () => void
        onSetPartOpacity: (cb: (id: string, opacity: number) => void) => () => void
        onMouseEnter: (cb: () => void) => () => void
        onMouseLeave: (cb: () => void) => () => void
      }
      contextMenu: {
        open: (screenX: number, screenY: number) => void
        onAction: (cb: (action: string) => void) => () => void
      }
      conversations: {
        list: () => Promise<Conversation[]>
        create: (title: string) => Promise<Conversation>
        rename: (id: string, title: string) => Promise<boolean>
        remove: (id: string) => Promise<boolean>
        getMessages: (conversationId: string, before?: number, limit?: number) => Promise<StoredMessage[]>
        addMessage: (conversationId: string, role: 'user' | 'hermes', text: string, ast?: MessagePart[]) => Promise<StoredMessage>
      }
    }
  }
}

export {}
