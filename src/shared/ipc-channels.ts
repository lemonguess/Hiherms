// Centralized IPC channel names. Renderer ⇄ Main contract goes here.
// iteration-001 only ships placeholders; real channels land as features arrive.

export const IPC = {
  Window: {
    Minimize: 'window:minimize',
    Close: 'window:close',
    ToggleAlwaysOnTop: 'window:toggle-always-on-top',
  },
  Chat: {
    Open: 'chat:open',
    Close: 'chat:close',
    SetTab: 'chat:set-tab',
  },
  Pet: {
    Hide: 'pet:hide',
    Show: 'pet:show',
    SetClickThrough: 'pet:set-click-through',
    MoveWindow: 'pet:move-window',
    GetPosition: 'pet:get-position',
    SetParam: 'pet:set-param',
    SetPartOpacity: 'pet:set-part-opacity',
    MouseEnter: 'pet:mouse-enter',
    MouseLeave: 'pet:mouse-leave',
  },
  ContextMenu: {
    Open: 'context-menu:open',
    Close: 'context-menu:close',
    Action: 'context-menu:action',
  },
  Conversations: {
    List: 'conversations:list',
    Create: 'conversations:create',
    Rename: 'conversations:rename',
    Remove: 'conversations:remove',
    GetMessages: 'conversations:get-messages',
    AddMessage: 'conversations:add-message',
  },
} as const

export type IpcChannel =
  | typeof IPC.Window.Minimize
  | typeof IPC.Window.Close
  | typeof IPC.Window.ToggleAlwaysOnTop
