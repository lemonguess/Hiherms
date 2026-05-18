import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { createMainWindow, createChatWindow, createContextMenuWindow } from './window'
import { ConversationStore } from './store'

let mainWindow: BrowserWindow | null = null
let chatWindow: BrowserWindow | null = null
let contextMenuWindow: BrowserWindow | null = null
let store: ConversationStore | null = null

function openChat(tab?: string): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.focus()
    if (tab) chatWindow.webContents.send(IPC.Chat.SetTab, tab)
    return
  }
  if (!mainWindow) return
  chatWindow = createChatWindow(mainWindow, tab)
  chatWindow.on('closed', () => { chatWindow = null })
}

function closeContextMenu(): void {
  if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
    contextMenuWindow.close()
  }
  contextMenuWindow = null
}

function registerIpc(): void {
  ipcMain.on(IPC.Window.Minimize, () => mainWindow?.minimize())
  ipcMain.on(IPC.Window.Close, () => mainWindow?.close())
  ipcMain.on(IPC.Window.ToggleAlwaysOnTop, () => {
    if (!mainWindow) return
    mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop())
  })

  ipcMain.on(IPC.Chat.Open, (_e, tab?: string) => openChat(tab))
  ipcMain.on(IPC.Chat.Close, () => chatWindow?.close())
  ipcMain.on(IPC.Chat.SetTab, (_e, tab: string) => {
    chatWindow?.webContents.send(IPC.Chat.SetTab, tab)
  })

  ipcMain.on(IPC.Pet.Hide, () => mainWindow?.hide())
  ipcMain.on(IPC.Pet.Show, () => mainWindow?.show())
  ipcMain.on(IPC.Pet.SetClickThrough, (_e, enable: boolean) => {
    if (!mainWindow) return
    mainWindow.setIgnoreMouseEvents(enable, { forward: true })
  })
  ipcMain.on(IPC.Pet.MoveWindow, (_e, x: number, y: number) => {
    if (!mainWindow) return
    mainWindow.setPosition(Math.round(x), Math.round(y))
  })
  ipcMain.on(IPC.Pet.SetParam, (_e, id: string, value: number) => {
    console.log('[Main] SetParam', id, value)
    mainWindow?.webContents.send(IPC.Pet.SetParam, id, value)
  })
  ipcMain.on(IPC.Pet.SetPartOpacity, (_e, id: string, opacity: number) => {
    console.log('[Main] SetPartOpacity', id, opacity)
    mainWindow?.webContents.send(IPC.Pet.SetPartOpacity, id, opacity)
  })
  ipcMain.handle(IPC.Pet.GetPosition, () => {
    if (!mainWindow) return [0, 0]
    return mainWindow.getPosition()
  })

  // Context menu — opens a separate transparent window at cursor position
  ipcMain.on(IPC.ContextMenu.Open, (_e, screenX: number, screenY: number) => {
    closeContextMenu()
    if (!mainWindow) return
    contextMenuWindow = createContextMenuWindow(mainWindow, screenX, screenY)
    contextMenuWindow.on('closed', () => { contextMenuWindow = null })
  })
  ipcMain.on(IPC.ContextMenu.Close, () => closeContextMenu())
  ipcMain.on(IPC.ContextMenu.Action, (_e, action: string) => {
    closeContextMenu()
    mainWindow?.webContents.send(IPC.ContextMenu.Action, action)
  })

  ipcMain.handle(IPC.Conversations.List, () => store?.list() ?? [])
  ipcMain.handle(IPC.Conversations.Create, (_e, title: string) => store?.create(title))
  ipcMain.handle(IPC.Conversations.Rename, (_e, id: string, title: string) => store?.rename(id, title))
  ipcMain.handle(IPC.Conversations.Remove, (_e, id: string) => store?.remove(id))
  ipcMain.handle(IPC.Conversations.GetMessages, (_e, conversationId: string, before?: number, limit?: number) =>
    store?.getMessages(conversationId, before, limit) ?? [],
  )
  ipcMain.handle(IPC.Conversations.AddMessage, (_e, conversationId: string, role: 'user' | 'hermes', text: string) =>
    store?.addMessage(conversationId, role, text),
  )
}

app.whenReady().then(() => {
  store = new ConversationStore(app.getPath('userData'))
  registerIpc()
  mainWindow = createMainWindow()

  // Cursor polling for click-through (macOS).
  // macOS doesn't forward DOM events with setIgnoreMouseEvents + forward:true,
  // so we poll from the main process and toggle click-through + send IPC to renderer.
  //
  // Strategy: start with click-through ENABLED so transparent areas pass clicks through.
  // When cursor enters the window, disable click-through so the canvas receives events
  // (eye tracking, drag, right-click). When cursor leaves, re-enable click-through.
  let wasInside = false

  // Start with click-through enabled — transparent areas pass through to windows below
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  }

  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const point = screen.getCursorScreenPoint()
    const [wx, wy] = mainWindow.getPosition()
    const [ww, wh] = mainWindow.getSize()
    const inside = point.x >= wx && point.x <= wx + ww && point.y >= wy && point.y <= wy + wh

    if (inside && !wasInside) {
      // Mouse entered window — disable click-through so renderer gets events
      console.log('[Polling] cursor entered window → setIgnoreMouseEvents(false)')
      mainWindow.setIgnoreMouseEvents(false)
      mainWindow.webContents.send(IPC.Pet.MouseEnter)
    } else if (!inside && wasInside) {
      // Mouse left window — enable click-through + tell renderer to reset eyes
      console.log('[Polling] cursor left window → setIgnoreMouseEvents(true)')
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
      mainWindow.webContents.send(IPC.Pet.MouseLeave)
    }
    wasInside = inside
  }, 50)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
