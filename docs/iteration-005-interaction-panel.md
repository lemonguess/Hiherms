# iteration-005 — interaction-panel

- **日期**: 2026-05-15
- **范围**: 移除 ready / 右键精简 / 交互模式面板 / 画布点击穿透 / 视线回正

## 已完成（确认生效）

1. **移除 ready 状态** — App.vue 删除 Status overlay ✓
2. **右键菜单精简** — context-menu.html 移除"历史会话" ✓
3. **交互模式面板** — InteractionPanel.vue 新建，作为聊天窗口 sidebar 第三个 tab ✓
4. **切换到 /v1/chat/completions**（iteration-004 遗留）— hermes.ts 已改 ✓
5. **桌宠拖动**（iteration-004 遗留）— mousedown/mousemove/mouseup + IPC moveWindow ✓
6. **点击穿透**（部分生效）— 启动时透明区域可穿透，cursor 进入窗口后 canvas 接收事件 ✓
7. **眼动跟踪** — 鼠标在窗口内时模型眼睛跟随 ✓

## 未解决（已验证未生效）

### 问题 A：暗黑服装切换不生效

- **现象**：交互面板点击"暗黑"按钮，模型外观无变化
- **终端日志**（已确认 IPC 链路通到主进程）：
  ```
  [Main] SetPartOpacity Part28 1
  [Main] SetPartOpacity Part20 1    ← 切到暗黑
  [Main] SetPartOpacity Part28 1
  [Main] SetPartOpacity Part20 0    ← 切回常服
  ```
- **根因分析**：IPC 从 chat window → main process → pet window 链路已通（主进程日志确认）。问题在 pet window 端：
  1. pet window 的 `onSetPartOpacity` 回调可能未收到消息（preload 注册问题）
  2. 或 `coreModel.setPartOpacityById('Part20', 1)` 执行了但视觉无变化（Cubism SDK 的 Part 系统可能不直接控制渲染）
- **下一步**：检查 pet window DevTools 是否有 `[IPC] setPartOpacity` 日志。如果没有，说明 preload 的 `ipcRenderer.on` 未正确注册

### 问题 B：离开画布视线不回正

- **现象**：鼠标移出桌宠窗口后，模型眼睛保持看向最后位置
- **根因**：主进程轮询代码已写，`Pet.MouseLeave` IPC 已注册。但未确认轮询是否真正触发了 `setIgnoreMouseEvents(true)` + 发送 MouseLeave IPC
- **下一步**：检查终端是否有 `[Polling] cursor left window` 日志。如果没有，说明轮询逻辑未正确检测 cursor 离开

### 问题 C：流式输出未生效

- **现象**：聊天消息仍然是整段显示，不是逐字流式输出
- **代码状态**：`hermes.ts` 已改为 `/v1/chat/completions` SSE 格式，有 `await setTimeout(0)` 让出事件循环
- **可能原因**：后端未返回 SSE 流，或 SSE 解析逻辑有 bug
- **下一步**：检查 Network tab 确认请求是否返回 `text/event-stream`，检查 `onDelta` 回调是否被调用

## 架构说明

```
桌宠窗口 (mainWindow)              聊天窗口 (chatWindow)
┌─────────────────────┐           ┌──────────────────┐
│ Live2DStage.vue     │           │ ChatApp.vue      │
│ - model/coreModel   │           │ - InteractionPanel│
│ - eye tracking      │           │ - pet.setParam() │
│ - drag              │           │ - pet.setPartOpacity()│
│ IPC listeners:      │           └──────────────────┘
│  onSetParam         │                    ↑ IPC send
│  onSetPartOpacity   │                    (已确认到达 main)
│  onMouseEnter       │
│  onMouseLeave→reset │
└─────────────────────┘
         ↑ IPC send (onSetParam / onSetPartOpacity / MouseEnter / MouseLeave)
    ┌────┴────────────────────────────────────┐
    │         main/index.ts                  │
    │ - 启动时 setIgnoreMouseEvents(true)    │
    │ - setInterval(50ms) 轮询 cursor pos    │
    │ - cursor 进入 → setIgnoreMouseEvents(false) + MouseEnter IPC │
    │ - cursor 离开 → setIgnoreMouseEvents(true) + MouseLeave IPC │
    │ - forward SetParam/SetPartOpacity IPC  │
    └────────────────────────────────────────┘
```

## 当前功能清单

| 功能 | 状态 | 备注 |
|------|------|------|
| Live2D 模型渲染 | ✅ | tuzi_mian 模型，280×567 窗口 |
| 桌宠拖动 | ✅ | 左键按住拖动 |
| 眼动跟踪 | ✅ | 鼠标在窗口内时跟随 |
| 右键菜单 | ✅ | 开启对话/系统设置/交互模式/隐藏宠物/退出 |
| 聊天窗口 | ✅ | 独立 BrowserWindow，SSE API |
| 交互模式面板 | ✅ UI | 服装/表情/姿势三个控制区 |
| 点击穿透 | ⚠️ 部分 | 透明区域穿透 ✓，cursor 在窗口内时整个窗口阻挡 |
| 视线回正 | ❌ | 鼠标离开后眼睛不回正 |
| 暗黑服装切换 | ❌ | IPC 到主进程 ✓，视觉无变化 |
| 流式输出 | ❌ | 代码已改 SSE，但实际仍是整段显示 |

## 未解决问题详情

### 1. 视线回正未生效
- 主进程轮询 + MouseLeave IPC 代码已写
- 需验证：终端是否有 `[Polling] cursor left window` 日志

### 2. 流式输出未生效
- `hermes.ts` 已改为 `/v1/chat/completions` SSE 解析
- 需验证：Network tab 确认后端返回 `text/event-stream`

### 3. 暗黑服装不生效
- IPC 链路已通（主进程日志确认收到 SetPartOpacity）
- 问题在 pet window 端：`setPartOpacityById` 执行了但视觉无变化
- 可能原因：Cubism SDK 的 Part opacity 不直接影响渲染，或需要同时调用 `model.update()`
