# iteration-013 — hermes-backend-modules-and-outfit-regression

- **日期**: 2026-05-19
- **范围**: 修复暗黑服装/腿部透明回归，补齐 hermes-web-ui 风格模块的后端只读数据契约

## 动机

用户反馈：

1. 人物腿不见了；暗黑服装模式下衣服变成透明。
2. 新增功能不能只停在前端复刻，需要补齐后端代码，并写产品说明方便团队继续接手。

本轮继续遵守 project.md 的 Runtime 边界：不修改 Hermes，不引入 Web UI 的 Koa BFF；HermesPet 通过 Electron main IPC 聚合本机 Hermes 状态。

## 根因

`iteration-012` 的 `outfit-presets.ts` 回退到了高风险策略：

- 暗黑模式把 `Part28=常规服装` 设为 0；
- 批量控制 `Part20` 子树里的 `Part39=腿` 等 part；
- 同时把多个衣服/外套参数强行置 1。

这与 `iteration-008` 已验证过的结论冲突：`Part20` 更像暗黑 layer，不是完整替换常服底层的独立模型。隐藏 `Part28` 或误控 `Part39` 会让基础衣物、腿部出现透明/消失。

## 改动

- Live2D 服装 preset
  - 修改 `src/renderer/src/live2d/outfit-presets.ts`：
    - 常服：`Part28=1`、`Part20=0`
    - 暗黑：`Part28=1`、`Part20=1`
    - 不再批量写 `Part39` 等子 part。
    - 不再强行写衣服/外套参数，避免误触透明/位移状态。
- Hermes 后端模块
  - 新增 `src/main/hermes/hermes-dashboard-readers.ts`：纯函数读取 profile、memory、skills、plugins、usage summary。
  - 修改 `src/main/hermes/hermes-dashboard-service.ts`：新增 `hermes-dashboard:details` IPC，按 Electron main service 方式映射 hermes-web-ui 的 profiles/skills/memory/gateways/logs/models 边界。
  - 修改 `src/shared/ipc-channels.ts`、`src/shared/types.ts`、`src/preload/index.ts`、`src/renderer/src/env.d.ts`：补齐 dashboard details 契约。
  - 修改 `src/renderer/src/chat/ChatApp.vue`：用户、技能、插件、记忆、用量、技能用量面板改为读取后端聚合数据。
- 文档
  - 新增 `docs/hermes-backend-modules-product.md`：产品说明、非目标、后端边界和验收标准。
  - 新增 `docs/superpowers/plans/2026-05-19-hermes-backend-modules-and-outfit-regression.md`：实施计划。

## 验证方式

- TDD 红灯：
  - `node --test /private/tmp/hermespet-tests/tests/agent-ipc.test.js /private/tmp/hermespet-tests/tests/live2d-look-and-outfit.test.js`
  - 失败点：
    - `hermes-dashboard:details` 不存在；
    - 暗黑 preset 中 `Part28` 实际为 0。
  - 新增 `tests/hermes-dashboard-readers.test.ts` 后，`pnpm exec tsc -p tests/tsconfig.json` 先因 reader 模块不存在失败。
- 绿灯与回归：
  - `pnpm exec tsc -p tests/tsconfig.json`
  - `node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js /private/tmp/hermespet-tests/tests/agent-ipc.test.js /private/tmp/hermespet-tests/tests/live2d-look-and-outfit.test.js /private/tmp/hermespet-tests/tests/hermes-dashboard-readers.test.js`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm dev` + Browser 打开 `http://localhost:5173/chat.html`
    - 页面标题为 `HermesPet Chat`
    - 左侧入口包含用户、技能、记忆、用量、插件等模块
    - 用户/技能/记忆/用量/插件面板可切换
    - 控制台 error 数为 0

## 已知问题 / 留给下一轮

- Browser smoke 是普通浏览器环境，没有 Electron preload，因此只能验证前端渲染不会崩溃；真实 `window.hermes.dashboard.details()` 已通过 Electron main/preload 类型与构建验证。
- 用量与技能用量目前只显示本地会话/消息规模，并明确说明 HermesPet 尚未写入 token usage；后续要接 Hermes usage store 或 bridge usage event。
- skills/plugins/memory 当前为只读扫描；编辑、启停、安装、保存能力留给后续迭代。
