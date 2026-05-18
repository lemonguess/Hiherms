import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')

const PET_WIDTH = 280
const PET_HEIGHT = 567
const PET_MARGIN = 64

export function createMainWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay().workAreaSize
  const x = display.width - PET_WIDTH - PET_MARGIN
  const y = display.height - PET_HEIGHT - PET_MARGIN

  const win = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function createChatWindow(_parent: BrowserWindow, initialTab?: string): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const { x, y } = display.workArea

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: '#131315',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const hash = initialTab ? `#${initialTab}` : ''
  const chatUrl = process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}/chat.html${hash}`
    : join(__dirname, '../renderer/chat.html')

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(chatUrl as string)
  } else {
    void win.loadFile(chatUrl as string)
  }

  return win
}

const CTX_MENU_WIDTH = 280
const CTX_MENU_HEIGHT = 380

export function createContextMenuWindow(
  parent: BrowserWindow,
  screenX: number,
  screenY: number,
): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea
  const x = Math.min(screenX, display.x + display.width - CTX_MENU_WIDTH)
  const y = Math.min(screenY, display.y + display.height - CTX_MENU_HEIGHT)

  const win = new BrowserWindow({
    width: CTX_MENU_WIDTH,
    height: CTX_MENU_HEIGHT,
    x: Math.max(display.x, x),
    y: Math.max(display.y, y),
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    parent,
    webPreferences: {
      preload: join(__dirname, '../preload/context-menu.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    win.on('blur', () => {
      if (!win.isDestroyed()) win.close()
    })
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/context-menu.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/context-menu.html'))
  }

  return win
}
