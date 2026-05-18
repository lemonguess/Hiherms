# iteration-009 — hermes-agent-bridge

- **日期**: 2026-05-18
- **范围**: 将聊天入口从 renderer localhost API 改为 Electron main Hermes Agent Bridge，并保留 HRP Runtime 解析

## 动机

用户明确要求 CLI/交互式行为扩展不是简单 `hermes -q`，而是参考
`EKKOLearnAI/hermes-web-ui` 的 bridge/interactive 模式：由应用侧启动本地 bridge，
复用 Hermes Agent 的 `run_conversation()`、工具回调、状态事件和流式输出。

同时，HermesPet 的桌宠能力不能退化成纯聊天框：

- 聊天窗口只显示主 message。
- `<emotion>` / `<motion>` / `<speech>` / `<media>` / `<tool>` / `<status>` 等参数仍进入 AST。
- Runtime 后续可继续接 emotion-runtime / motion-runtime / tts-runtime 执行。

## 改动

- `.trae/rules/project.md`
  - 当前阶段目标从 “本地 Hermes Gateway + localhost API” 调整为 “本地 Hermes Agent Bridge”。
  - 明确 renderer 禁止直接访问 localhost Hermes API，必须走 preload IPC -> Electron main -> bridge。
- `src/main/hermes/hermespet_bridge.py`
  - 新增 Python 本地 socket bridge。
  - 查找并导入本机 Hermes Agent `run_agent.py`。
  - 每个 conversation session 复用一个 `AIAgent`。
  - 通过 `AIAgent.run_conversation()` 执行对话，并采集 stream delta / status / thinking / reasoning / tool events。
  - 如果 Hermes 没有回调 delta，但返回 `final_response`，bridge 会补成输出 delta，避免聊天窗口空白。
- `src/main/hermes/bridge-client.ts`
  - 新增 Node JSON-line socket client，支持 `chat`、`get_output`、`stream_output`、`interrupt`、`shutdown`。
- `src/main/hermes/bridge-manager.ts`
  - Electron main 负责启动/停止 Python bridge。
  - 优先使用 `HERMESPET_BRIDGE_PYTHON` / `HERMES_AGENT_BRIDGE_PYTHON` / `hermes` shebang / `python3`。
- `src/main/hermes/bridge-service.ts`
  - 注册 `agent:send`、`agent:abort`、`agent:event`、`agent:check` IPC。
  - 注入 HermesPet system prompt，要求可见文本放在 protocol tags 之外。
- `src/preload/index.ts`、`src/renderer/src/env.d.ts`
  - 暴露 `window.hermes.agent`。
- `src/renderer/src/api/hermes.ts`
  - 保持 ChatApp-facing `sendMessage()` API，但内部改走 `window.hermes.agent.send()`。
  - 使用 HRP streaming parser 解析 bridge delta。
  - `onDelta()` 只派发可见文本，聊天窗口不显示 protocol 参数。
  - `onDone()` 返回可见主消息和完整 AST parts。
  - 取消时即使 runId 尚未返回，也会请求中断当前 session。
- `src/renderer/src/runtime/stream-parser.ts`
  - 从占位扩展为增量 HRP parser，支持分块标签、自闭合 intent 标签和 `<speech>...</speech>`。
- `src/renderer/src/runtime/display-text.ts`
  - 新增 visible text projection：只拼接 `TextPart.content`。
- `src/main/store.ts`、`src/renderer/src/chat/ChatApp.vue`
  - assistant 消息持久化主文本，同时保存 AST metadata。
  - 设置页文案从 API 口径调整为 Hermes Agent Bridge 口径。
- `src/shared/types.ts`、`src/shared/ipc-channels.ts`
  - 新增 Agent bridge IPC 与消息类型。
- `tests/`
  - 新增 parser/display projection 测试和 Agent IPC channel 测试。
- `AGENTS.md`、`docs/superpowers-team-workflow.md`
  - 同步 bridge 口径，避免后续协作者按旧 API 方案继续实现。

## 验证方式

已执行：

- `pnpm exec tsc -p tests/tsconfig.json`
- `node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js /private/tmp/hermespet-tests/tests/agent-ipc.test.js`
- `PYTHONPYCACHEPREFIX=/private/tmp/hermespet-pycache python3 -m py_compile src/main/hermes/hermespet_bridge.py`
- `pnpm typecheck`
- `pnpm build`
- `pnpm dev`
  - Electron dev server 启动成功，renderer 地址为 `http://localhost:5173/`，随后已停止。

## 已知问题 / 留给下一轮

- 本轮完成 bridge 接线、类型检查、构建和启动级 smoke，没有发起真实 LLM 调用，避免在未确认本机 Hermes 配置时消耗一次 agent run。
- 目前还没有命令 approval UI。Hermes 工具若请求执行审批，bridge 会记录事件并返回 deny，避免桌宠卡死。
- CosyVoice 仍按 project.md 约束保持占位；`<speech>` 已进入 AST，但未调用真实 TTS。
- emotion/motion 已进入 AST，但本轮没有新增执行调度；下一轮应把 `MessagePart` 分发给 emotion-runtime / motion-runtime / tts-runtime。
- 打包发布时需要确认 `hermespet_bridge.py` 是否被复制到 app resources。本轮 dev/build 通过，dev 路径走源码文件。
