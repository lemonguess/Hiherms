# iteration-002 — chat-and-ui

- **日期**: 2026-05-14
- **范围**: 修复渲染/交互 bug + 独立聊天窗口 + 右键菜单 + 设置/历史页面 + Hermes Agent API 集成

## 动机

iteration-001 完成后用户反馈三个严重 bug：模型三重渲染、交互失灵、无聊天界面。
此外需要完整的聊天窗口（独立 Electron 窗口）、右键上下文菜单、设置页和历史记录页，
以及对接本地 Hermes Agent API 实现真实 LLM 对话。

关联 project.md §15（Runtime 目录布局）、§20（Live2D 模型资产）。

## 改动

### Bug 修复

**三重渲染**:
- 根因：旧 Electron 进程未被 kill，`pnpm dev` 每次新建窗口叠加
- 修复：`pkill -f "electron-vite"` 清理旧进程；`Live2DStage.vue` / `stage.ts` 加 HMR guard（`globalThis.__hermespet_*`）

**交互失灵**:
- 根因：`model.focus(x, y)` 接收归一化 [-1,1] 但期望像素坐标
- 修复：传入 `e.clientX - rect.left, e.clientY - rect.top` 像素坐标
- 确认 `model.interactive = true`（PIXI v6 API，非 v7 的 `eventMode`）

**模型裁剪**:
- 根因：`fitModel` 只按高度缩放，宽度超出被裁
- 修复：`Math.min(maxW / m.width, maxH / m.height)` 双向适配
- 位置调整：`m.x = viewW * 0.46` 居中

### 新增文件

**聊天窗口**（独立 Electron 窗口）:
- `src/renderer/chat.html` — 聊天窗口 HTML 入口（无 Cubism Core）
- `src/renderer/src/chat/main.ts` — Vue3 + Pinia 初始化
- `src/renderer/src/chat/ChatApp.vue` — 完整聊天 UI：
  - 侧边栏：Logo + 导航（当前会话/历史记录/系统设置）
  - Chat tab：消息气泡 + 输入框 + SSE 流式响应 + 停止按钮
  - History tab：搜索 + 日期分组会话列表（今天/昨天/过去7天）
  - Settings tab：Hermes Agent 连接配置 + 语音设置 + 状态栏

**Hermes Agent API 客户端**:
- `src/renderer/src/api/hermes.ts` — `/v1/responses` SSE 流式对话 + 健康检查 + 多轮 conversation 管理

**右键菜单**:
- `src/renderer/src/components/ContextMenu.vue` — 匹配 hermespet_context_menu 设计稿
- 两组功能：[聊天(⌘K)/历史/设置/交互模式] | [隐藏桌宠/退出]
- 智能定位：靠近窗口边缘时自动翻转

### 修改文件

**`src/main/index.ts`** — IPC 处理:
- 新增 `Chat.Open` / `Chat.Close` / `Chat.SetTab` / `Pet.Hide` / `Pet.Show`
- `openChat(tab?)` 创建或聚焦聊天窗口，支持指定初始 tab

**`src/main/window.ts`** — 窗口创建:
- `createMainWindow()`: 560×720 透明无边框，右下角，置顶
- `createChatWindow(parent, initialTab?)`: 居中，2/3 屏宽，全高，无边框，暗色背景

**`src/shared/ipc-channels.ts`** — IPC 频道定义

**`src/preload/index.ts`** — contextBridge 暴露 `window.hermes` API

**`src/renderer/src/env.d.ts`** — 全局类型声明 `Window.hermes`

**`src/renderer/src/App.vue`** — 桌宠窗口:
- 右键菜单集成（智能定位 + 点击外部关闭）
- 状态指示器（idle/loading/ready/error）
- 错误信息显示

**`src/renderer/src/components/Live2DStage.vue`** — 模型渲染:
- HMR guard + 全局 registry
- 修复 focus 坐标 + 双向缩放 + 居中

**`src/renderer/src/live2d/stage.ts`** — PIXI Application:
- HMR guard via `globalThis.__hermespet_stage`

**`electron.vite.config.ts`** — 多入口渲染:
- 新增 `chat.html` 作为第二渲染入口

**Markdown 渲染 + 消息操作**:
- 安装 `markdown-it`，Hermes 回复内容渲染为 Markdown（代码块、列表、表格、引用等）
- 每条 Hermes 消息下方显示操作按钮：复制 / 语音播报（Web Speech API）
- Markdown 样式通过 scoped CSS 实现，适配暗色主题

**本地会话存储**:
- `src/main/store.ts` — JSON 文件存储（`userData/hermespet/conversations.json`）
- IPC 通道：`conversations:list/create/rename/remove`
- 首次发消息自动创建会话（标题取前 30 字）
- 历史记录页按时间分组，支持搜索过滤和删除

**README.md** — 项目说明文档（功能 / 技术栈 / 安装部署）

### 关键决策

1. **独立聊天窗口** — 不用 overlay，创建独立 BrowserWindow，通过 IPC 通信
2. **SSE 流式响应** — 使用 `/v1/responses` + `conversation` 参数，服务端管理多轮历史
3. **`model.focus()` 坐标系** — pixi-live2d-display 接受 PIXI 全局像素坐标，内部做 `toModelPosition` 转换
4. **PIXI v6 API** — `interactive = true`（非 v7 的 `eventMode`），InteractionManager 自动注册
5. **右键菜单定位** — `MENU_W=256, MENU_H=380`，超出窗口边界时翻转方向

## 验证方式

1. `pnpm dev` 启动，模型只出现一次（无重影）
2. 鼠标移动模型头部跟随，点击触发歪嘴瞪眼反应
3. 右键弹出菜单，所有功能可点击（聊天/历史/设置/隐藏/退出）
4. 聊天窗口独立显示，侧边栏导航切换正常
5. 聊天输入消息，SSE 流式接收 Hermes Agent 响应
6. 设置页显示 Hermes Agent 连接状态，可保存/重置配置
7. `pnpm typecheck` 通过

## 已知问题 / 留给下一轮

- Hermes Agent API 服务器需要用户手动在 `~/.hermes/.env` 中启用并重启 gateway
- 历史记录页目前是 mock 数据，需要对接 Hermes Agent 会话查询 API
- TTS 语音设置目前是 UI 占位，未对接实际 TTS 服务
- 交互模式（Interaction Mode）切换尚未实现
- Runtime stubs（9 个 no-op 文件）等待后续迭代实现
