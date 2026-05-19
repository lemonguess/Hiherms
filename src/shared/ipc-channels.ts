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
  Agent: {
    Send: 'agent:send',
    Abort: 'agent:abort',
    Event: 'agent:event',
    Check: 'agent:check',
  },
  HermesCli: {
    Check: 'hermes-cli:check',
    ListProfiles: 'hermes-cli:list-profiles',
    GatewayStatus: 'hermes-cli:gateway-status',
    GatewayStart: 'hermes-cli:gateway-start',
    GatewayStop: 'hermes-cli:gateway-stop',
    GatewayRestart: 'hermes-cli:gateway-restart',
  },
  HermesDashboard: {
    Summary: 'hermes-dashboard:summary',
    Models: 'hermes-dashboard:models',
    Logs: 'hermes-dashboard:logs',
    Details: 'hermes-dashboard:details',
  },
  Media: {
    Import: 'media:import',
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
  | typeof IPC.Agent.Send
  | typeof IPC.Agent.Abort
  | typeof IPC.Agent.Event
  | typeof IPC.Agent.Check
  | typeof IPC.HermesCli.Check
  | typeof IPC.HermesCli.ListProfiles
  | typeof IPC.HermesCli.GatewayStatus
  | typeof IPC.HermesCli.GatewayStart
  | typeof IPC.HermesCli.GatewayStop
  | typeof IPC.HermesCli.GatewayRestart
  | typeof IPC.HermesDashboard.Summary
  | typeof IPC.HermesDashboard.Models
  | typeof IPC.HermesDashboard.Logs
  | typeof IPC.HermesDashboard.Details
  | typeof IPC.Media.Import
