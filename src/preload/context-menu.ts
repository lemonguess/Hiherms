import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'

contextBridge.exposeInMainWorld('ctxMenu', {
  action: (name: string) => ipcRenderer.send(IPC.ContextMenu.Action, name),
  close: () => ipcRenderer.send(IPC.ContextMenu.Close),
})
