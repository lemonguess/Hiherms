# iteration-004 — api-and-drag

- **日期**: 2026-05-15
- **范围**: 切换到 /v1/chat/completions / 流式渲染修复 / 桌宠拖动 / 移除 DevTools 自动打开

## 动机

iteration-003 七轮修复后仍有三个问题：
1. 流式返回不生效 — API 确认返回逐 token delta，但 UI 一次性显示全部文本
2. 接口不对 — 应使用 `/v1/chat/completions`（OpenAI Compatible），而非 `/v1/responses`
3. 桌宠无法拖动 — 用户希望左键长按拖动桌宠窗口位置

## 改动

### 1. 切换到 /v1/chat/completions — `src/renderer/src/api/hermes.ts`
- **接口变更**: `POST /v1/responses` → `POST /v1/chat/completions`
- **请求体**: `{ model, messages, stream }` 替代 `{ model, input, stream, conversation }`
- **SSE 解析**: `choices[0].delta.content` 替代 `response.output_text.delta`
- **SendOptions 接口**: `input + conversation` → `messages: ChatMessage[]`，`onDone` 不再返回 conversationId
- 移除所有 debug console.log

### 2. 流式渲染修复 — `src/renderer/src/api/hermes.ts`
- **根因**: SSE chunk 处理在同步循环中，Vue reactivity 更新被 batch 到一次 DOM flush
- **修复**: 每处理完一个包含 delta 的 chunk 后，`await new Promise(r => setTimeout(r, 0))` 让出事件循环，Vue 逐 chunk 渲染
- `data:` 前缀匹配改为 `slice(5).trim()`，兼容有无空格

### 3. ChatApp 适配新 API — `src/renderer/src/chat/ChatApp.vue`
- `send()` 从 `messages` ref 构建 `ChatMessage[]` 数组（`hermes` → `assistant`）传给 API
- 导入 `ChatMessage` 类型
- `onDone` 回调不再接收 conversationId

### 4. 桌宠拖动 — 多文件
- `src/shared/ipc-channels.ts` — 新增 `Pet.MoveWindow` / `Pet.GetPosition`
- `src/main/index.ts` — 注册 `MoveWindow`（`setPosition`）和 `GetPosition`（`getPosition`）handlers
- `src/preload/index.ts` — 暴露 `pet.moveWindow()` / `pet.getPosition()`
- `src/renderer/src/env.d.ts` — 新增类型声明
- `src/renderer/src/components/Live2DStage.vue`:
  - 新增 mousedown/mouseup 事件监听
  - mousedown 记录鼠标起始位置 + 窗口起始位置（通过 IPC `getPosition`）
  - mousemove 检测 `isDragging`：若拖动中，计算绝对屏幕坐标并调用 `moveWindow`；否则执行眼睛跟随
  - mouseleave 在拖动中不重置眼睛参数
  - mouseup 结束拖动状态
  - cleanup 移除新增事件监听

### 5. 移除 DevTools 自动打开 — `src/main/index.ts`
- 删除 `chatWindow.webContents.openDevTools({ mode: 'detach' })`
- 消除终端 Autofill.enable / Autofill.setAddresses 报错

## 验证方式

1. `pnpm typecheck` 通过
2. `pnpm dev` 启动，终端无 Autofill 报错
3. 聊天发送消息，文字逐 token 流式显示（非一次性出现）
4. 左键长按桌宠，拖动鼠标，窗口跟随移动
5. 松开鼠标，窗口停在新位置
6. 拖动过程中眼睛不跟随（不抖动）
7. 右键菜单、聊天等功能不受影响
