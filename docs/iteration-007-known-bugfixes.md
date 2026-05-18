# iteration-007 — known-bugfixes

- **日期**: 2026-05-15
- **范围**: 修复流式渲染 reactivity、暗黑服装切换、视线回正兜底

## 动机

iteration-005 记录了三个已验证未生效的问题：

- 暗黑服装切换不生效
- 鼠标离开后视线不回正
- 聊天流式输出仍表现为整段显示

用户要求开始修复问题，并明确要求使用 skill、更新文档。本轮按 Superpowers 的
`systematic-debugging` 先定位 root cause，再实现修复；按
`verification-before-completion` 执行 fresh verification。

## 根因

1. **流式输出**
   - `ChatApp.vue` 将 `hermesMsg` 原始对象 push 进 `messages.value` 后，`onDelta`
     继续修改闭包里的原始对象。
   - Vue 数组内对象会被代理读取，但原始对象的后续 mutation 不可靠触发 DOM 更新。
   - `hermes.ts` 在 stream 结束时也没有解析最后残留的 buffer。

2. **暗黑服装**
   - `InteractionPanel.vue` 切换暗黑时保持 `Part28=1`，同时设置 `Part20=1`。
   - `tuzi mian.cdi3.json` 标注 `Part28=常规服装`、`Part20=暗黑服装`，两者应互斥。
   - 一次性 `setPartOpacityById` 可能被 Live2D update pipeline 覆盖，需要持久应用。

3. **视线回正**
   - 原实现主要依赖 main process 的窗口矩形轮询发送 `Pet.MouseLeave`。
   - renderer 缺少 canvas `mouseleave` / window `blur` 兜底，导致某些路径下眼睛保持最后方向。

## 改动

- `docs/superpowers/plans/2026-05-15-known-bugfixes.md`
  - 新增并勾选本轮 Superpowers bugfix plan。
- `src/renderer/src/api/hermes.ts`
  - 抽出 `parseChatCompletionSseLine()`。
  - 支持 stream close 后解析尾部 buffer。
- `src/renderer/src/chat/ChatApp.vue`
  - 新增 `updateMessage()`，通过替换 `messages.value[index]` 触发 Vue reactivity。
  - `onDelta` / `onDone` / `onError` 全部按 message id 更新响应式数组成员。
- `src/renderer/src/components/InteractionPanel.vue`
  - 暗黑服装切换改为 `Part28=0, Part20=1`。
  - 常服切换改为 `Part28=1, Part20=0`。
- `src/renderer/src/components/Live2DStage.vue`
  - 新增 part opacity override map。
  - 每个 Live2D update tick 持续应用 `Part28` / `Part20` opacity。
  - 增加 canvas `mouseleave` 和 window `blur` 调用 `resetEyes()`。

## 验证方式

- `pnpm typecheck`
  - 结果：exit 0
  - 覆盖：Node TS + Vue TS 类型检查。
- `pnpm build`
  - 结果：exit 0
  - 覆盖：Electron main/preload/renderer 生产构建。
- `pnpm dev`
  - 结果：Electron dev server 启动成功，随后已停止。
  - 观察到主进程日志：
    - `[Polling] cursor entered window → setIgnoreMouseEvents(false)`
    - `[Polling] cursor left window → setIgnoreMouseEvents(true)`
    - `[Main] SetPartOpacity Part28 0`
    - `[Main] SetPartOpacity Part20 1`
    - `[Main] SetPartOpacity Part28 1`
    - `[Main] SetPartOpacity Part20 0`
  - 覆盖：GUI 启动、main process 鼠标轮询、服装切换 IPC 到主进程。

## 已知问题 / 留给下一轮

- 本轮已启动 Electron GUI 并确认 main process 日志，但暗黑服装视觉变化、renderer 侧
  `mouseleave` 回正、真实 Hermes SSE 逐 token 渲染仍需要人眼确认。
- Runtime Layer 的 HRP `stream-parser`、`emotion-runtime`、`motion-runtime`、`media-runtime`
  仍是 stub，不属于本轮修复范围。
- 点击穿透仍是 iteration-005 记录的“部分生效”状态：cursor 进入窗口后整个窗口区域会阻挡底层点击。
