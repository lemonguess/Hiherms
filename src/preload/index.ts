import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'

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
}

const api = {
  window: {
    minimize: () => ipcRenderer.send(IPC.Window.Minimize),
    close: () => ipcRenderer.send(IPC.Window.Close),
    toggleAlwaysOnTop: () => ipcRenderer.send(IPC.Window.ToggleAlwaysOnTop),
  },
  chat: {
    open: (tab?: string) => ipcRenderer.send(IPC.Chat.Open, tab),
    close: () => ipcRenderer.send(IPC.Chat.Close),
    setTab: (tab: string) => ipcRenderer.send(IPC.Chat.SetTab, tab),
    onSetTab: (cb: (tab: string) => void) => {
      const handler = (_e: unknown, tab: string): void => cb(tab)
      ipcRenderer.on(IPC.Chat.SetTab, handler)
      return () => { ipcRenderer.removeListener(IPC.Chat.SetTab, handler) }
    },
  },
  pet: {
    hide: () => ipcRenderer.send(IPC.Pet.Hide),
    show: () => ipcRenderer.send(IPC.Pet.Show),
    setClickThrough: (enable: boolean) => ipcRenderer.send(IPC.Pet.SetClickThrough, enable),
    moveWindow: (x: number, y: number) => ipcRenderer.send(IPC.Pet.MoveWindow, x, y),
    getPosition: (): Promise<[number, number]> => ipcRenderer.invoke(IPC.Pet.GetPosition),
    setParam: (id: string, value: number) => ipcRenderer.send(IPC.Pet.SetParam, id, value),
    setPartOpacity: (id: string, opacity: number) => ipcRenderer.send(IPC.Pet.SetPartOpacity, id, opacity),
    onSetParam: (cb: (id: string, value: number) => void) => {
      const handler = (_e: unknown, id: string, value: number): void => cb(id, value)
      ipcRenderer.on(IPC.Pet.SetParam, handler)
      return () => { ipcRenderer.removeListener(IPC.Pet.SetParam, handler) }
    },
    onSetPartOpacity: (cb: (id: string, opacity: number) => void) => {
      const handler = (_e: unknown, id: string, opacity: number): void => cb(id, opacity)
      ipcRenderer.on(IPC.Pet.SetPartOpacity, handler)
      return () => { ipcRenderer.removeListener(IPC.Pet.SetPartOpacity, handler) }
    },
    onMouseEnter: (cb: () => void) => {
      const handler = (): void => cb()
      ipcRenderer.on(IPC.Pet.MouseEnter, handler)
      return () => { ipcRenderer.removeListener(IPC.Pet.MouseEnter, handler) }
    },
    onMouseLeave: (cb: () => void) => {
      const handler = (): void => cb()
      ipcRenderer.on(IPC.Pet.MouseLeave, handler)
      return () => { ipcRenderer.removeListener(IPC.Pet.MouseLeave, handler) }
    },
  },
  contextMenu: {
    open: (screenX: number, screenY: number) => ipcRenderer.send(IPC.ContextMenu.Open, screenX, screenY),
    onAction: (cb: (action: string) => void) => {
      const handler = (_e: unknown, action: string): void => cb(action)
      ipcRenderer.on(IPC.ContextMenu.Action, handler)
      return () => { ipcRenderer.removeListener(IPC.ContextMenu.Action, handler) }
    },
  },
  conversations: {
    list: (): Promise<Conversation[]> => ipcRenderer.invoke(IPC.Conversations.List),
    create: (title: string): Promise<Conversation> => ipcRenderer.invoke(IPC.Conversations.Create, title),
    rename: (id: string, title: string): Promise<boolean> => ipcRenderer.invoke(IPC.Conversations.Rename, id, title),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.Conversations.Remove, id),
    getMessages: (conversationId: string, before?: number, limit?: number): Promise<StoredMessage[]> =>
      ipcRenderer.invoke(IPC.Conversations.GetMessages, conversationId, before, limit),
    addMessage: (conversationId: string, role: 'user' | 'hermes', text: string): Promise<StoredMessage> =>
      ipcRenderer.invoke(IPC.Conversations.AddMessage, conversationId, role, text),
  },
}

contextBridge.exposeInMainWorld('hermes', api)

export type HermesBridge = typeof api
