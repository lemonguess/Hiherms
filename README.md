# HermesPet

Electron 桌面宠物 + Hermes Agent (LLM) + Live2D，一个有生命感的 AI 桌面伙伴。

## 功能

### Live2D 桌面宠物
- 透明无边框窗口，始终置顶，不干扰正常工作
- tuzi_mian Live2D 模型渲染（PIXI.js v6 + pixi-live2d-display）
- 生命迹象：呼吸摆动、自动眨眼、鼠标跟随
- 点击反应：歪嘴 + 瞪眼短动画（420ms）
- 右键菜单：聊天 / 历史记录 / 设置 / 隐藏 / 退出

### 聊天窗口
- 独立 Electron 窗口，与桌宠进程分离
- 对接本地 Hermes Agent API（OpenAI 兼容协议）
- SSE 流式响应，实时逐字显示
- Markdown 渲染（代码块、列表、表格、引用等）
- 消息操作：复制 / 语音播报
- 多轮对话：服务端管理上下文（`/v1/responses` + `conversation`）
- 会话管理：本地存储会话列表，按时间分组（今天 / 昨天 / 过去7天 / 更早）

### 系统设置
- Hermes Agent 连接配置（Base URL / API Key）
- 连接状态实时检测
- 语音设置（TTS 引擎 / 音调 / 语速）— UI 占位

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面框架 | Electron 33 |
| 构建工具 | electron-vite 2.3 + Vite 5 |
| 前端 | Vue 3.5 + TypeScript + Pinia |
| 样式 | Tailwind CSS 3 + 自定义 design tokens |
| Live2D | pixi-live2d-display 0.4 + PIXI.js 6.5 |
| LLM | Hermes Agent API（OpenAI 兼容） |
| Markdown | markdown-it |

## 项目结构

```
HermesPet/
├── src/
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # 入口 + IPC 注册
│   │   ├── window.ts           # 窗口创建（桌宠 + 聊天）
│   │   └── store.ts            # 本地会话存储（JSON）
│   ├── preload/
│   │   └── index.ts            # contextBridge 暴露 API
│   ├── shared/
│   │   └── ipc-channels.ts     # IPC 频道定义
│   └── renderer/
│       ├── index.html          # 桌宠窗口入口
│       ├── chat.html           # 聊天窗口入口
│       └── src/
│           ├── main.ts         # 桌宠 Vue 入口
│           ├── App.vue         # 桌宠主界面
│           ├── components/
│           │   ├── Live2DStage.vue    # Live2D 渲染
│           │   └── ContextMenu.vue    # 右键菜单
│           ├── chat/
│           │   ├── main.ts     # 聊天 Vue 入口
│           │   └── ChatApp.vue # 聊天主界面
│           ├── api/
│           │   └── hermes.ts   # Hermes Agent API 客户端
│           ├── live2d/
│           │   ├── stage.ts    # PIXI Application
│           │   ├── loader.ts   # 模型加载 + Groups 注入
│           │   └── tuzi-driver.ts  # 生命迹象驱动
│           ├── runtime/        # Runtime stubs（待实现）
│           ├── stores/
│           │   └── runtime.ts  # Pinia store
│           └── styles/
│               └── tokens.css  # Tailwind tokens + 组件样式
├── live2d/
│   └── tuzi_mian__2_/          # 主 Live2D 模型
├── docs/                       # 迭代日志
└── stitch_hermes_desktop_companion/  # UI 设计稿
```

## 前置依赖

- **Node.js** >= 18
- **pnpm** >= 9
- **Hermes Agent** — 提供 LLM API 服务（端口 8642）

## 安装

```bash
pnpm install
```

## 开发

```bash
pnpm dev
```

启动后会看到：
- 透明无边框桌宠窗口（右下角）
- 右键桌宠 → 聊天 → 打开独立聊天窗口

## Hermes Agent 配置

聊天功能依赖本地 Hermes Agent 的 API 服务器。在 `~/.hermes/.env` 中添加：

```env
API_SERVER_ENABLED=true
API_SERVER_KEY=your-secret-key
API_SERVER_CORS_ORIGINS=http://localhost:5173
```

然后重启 Hermes gateway：

```bash
hermes gateway
```

验证：

```bash
curl http://localhost:8642/health
# → {"status":"ok","platform":"hermes-agent"}
```

在聊天窗口的「系统设置」页面可以修改 Base URL 和 API Key。

## 命令

```bash
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产包
pnpm typecheck        # TypeScript 类型检查
pnpm preview          # 预览生产构建
```

## 迭代日志

见 [docs/](docs/) 目录。
