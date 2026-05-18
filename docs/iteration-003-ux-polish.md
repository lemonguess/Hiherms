# iteration-003 — ux-polish

- **日期**: 2026-05-15
- **范围**: 鼠标跟随锚点修复 / 右键菜单脱离画布限制 / 历史记录下拉 + 会话消息持久化 / 消息操作按钮移至气泡外 / 模型位置调整

## 动机

iteration-002 后用户反馈四个 UX 问题：
1. 鼠标跟随的锚点位置不对 — 鼠标在画布上半部分时模型眼睛反而向上看
2. 右键菜单被宠物窗口 (233×567) 裁剪，无法完整显示
3. 历史记录是独立 tab，需要改为聊天顶栏下拉 + 会话消息加载
4. 复制/播报按钮在气泡内部，应移到下方；复制需要 UI 反馈

## 改动

### 1. 鼠标跟随锚点 — `src/renderer/src/components/Live2DStage.vue`
- **问题根因**: `model.focus(screenX, screenY)` 内部的 `toModelPosition()` + `atan2` 坐标转换对本模型不适用，导致方向反转
- **解决方案**: 绕过 `model.focus()`，直接操作 `model.internalModel.focusController.x/y`
- 眼睛锚点设为 `model.y + model.height * 0.4`（模型高度 40% 处）
- 归一化到 [-1, 1]：`nx = (mouseX - eyeX) / (canvasW * 0.5)`
- mouseleave 时 `focusController.x = 0, y = 0` 直接归零

### 2. 右键菜单 — 独立 BrowserWindow
- **问题根因**: 宠物窗口仅 233×567，菜单 280×380，DOM Teleport 仍受限于窗口边界
- **解决方案**: 用独立的 frameless transparent BrowserWindow 承载菜单
- 新增文件：
  - `src/preload/context-menu.ts` — 简单 preload，暴露 `ctxMenu.action()` / `ctxMenu.close()`
  - `src/renderer/context-menu.html` — 自包含 HTML 页面，内联样式匹配原 ContextMenu.vue 设计
- 修改文件：
  - `src/shared/ipc-channels.ts` — 新增 `ContextMenu.Open/Close/Action` 通道
  - `src/main/window.ts` — 新增 `createContextMenuWindow()`，带 `blur` 自动关闭
  - `src/main/index.ts` — 注册 context menu IPC handlers，action 转发到 pet 窗口
  - `src/preload/index.ts` — 新增 `contextMenu.open()` / `contextMenu.onAction()`
  - `src/renderer/src/env.d.ts` — 新增 contextMenu 类型声明
  - `src/renderer/src/App.vue` — 移除 Teleport 菜单，改用 IPC 调用
  - `electron.vite.config.ts` — 新增 context-menu preload 和 renderer 入口

### 3. 历史记录下拉 + 会话消息持久化
- `src/main/store.ts` — ConversationStore 新增 `messages: StoredMessage[]`，支持 `getMessages(id, before, limit)` / `addMessage()`
- `src/shared/ipc-channels.ts` — 新增 `Conversations.GetMessages/AddMessage`
- `src/main/index.ts` — 注册新 IPC handlers
- `src/preload/index.ts` — 暴露 `conversations.getMessages()` / `addMessage()`
- `src/renderer/src/env.d.ts` — 新增 StoredMessage 类型 + 新方法声明
- `src/renderer/src/chat/ChatApp.vue`:
  - 移除 history tab，sidebar 只保留 chat + settings
  - 聊天顶栏新增下拉按钮（显示当前会话标题 + 箭头）
  - 下拉面板：分组显示所有会话，点击切换并加载消息
  - 发送/接收消息自动持久化到 store
  - 滚动到顶部自动加载更早消息（默认 10 条）

### 4. 消息操作按钮移至气泡外
- `src/renderer/src/chat/ChatApp.vue`:
  - 复制/播报按钮从气泡 `<div>` 内部移到外部（同级 `<div>`）
  - 按钮左对齐（hermes 消息下方）
  - 复制点击后图标变为 `check`，文字变"已复制"，2 秒后恢复

## 验证方式

1. `pnpm typecheck` 通过
2. `pnpm dev` 启动，宠物窗口正常渲染
3. 鼠标在画布内移动，模型眼睛跟随方向正确（上=上看，下=下看）
4. 鼠标离开画布，模型视线归正
5. 右键点击宠物，菜单在光标位置完整显示（不被裁剪）
6. 点击菜单外部，菜单关闭
7. 聊天窗口顶栏下拉显示历史会话列表
8. 点击会话切换，加载该会话消息
9. 发送消息后刷新，消息仍在（持久化）
10. Hermes 回复气泡下方有复制/播报按钮
11. 点击复制，图标变 check + "已复制"，2 秒后恢复

## 二轮修复（用户测试后）

1. **鼠标跟随锚点 Y 调整** — 从 40% 改为 10%（更接近眼睛位置），并取反 `fc.y = -ny` 修正上下方向
2. **历史下拉名称不更新** — 根因：`currentConversationId` 是 `let` 而非 `ref`，computed 无法追踪。改为 `const currentConversationId = ref('')`，所有引用更新为 `.value`
3. **会话消息不加载** — 同上 reactivity 问题，`openConversation` 中设置的值无法被其他响应式代码感知
4. **用户气泡宽度过窄** — 添加 `w-fit` 让气泡根据内容自适应，短文本不再换行
5. **模型显示不全** — scale 乘以 0.85 缩小，x 改为 `viewW * 0.45` 中心对齐，y 改为 `viewH * 0.06` 下移

## 三轮修复（用户测试后）

1. **模型位置** — 恢复原始 scale（去掉 0.85），x 改为 `viewW * 0.35` 左移，y 改为 `viewH * 0.02` 上移
2. **鼠标跟随完全重写** — 弃用 `focusController`（与 tuzi-driver 的呼吸 ParamAngleX/Y 冲突导致抖动）。改为直接写 `coreModel.setParameterValueById`：ParamAngleX/Y（±30°）+ ParamEyeBallX/Y（±1）。锚点：画布中心 X，顶部 10% Y
3. **消息重复** — 根因：`loadOlderMessages` 用 `Date.now()` 做分页，每次滚动加载同一批消息。修复：用 `oldestLoadedAt` ref 跟踪最早消息时间戳做分页 + `storedId` 去重
4. **聊天窗口置顶** — 移除 `parent` 关联 + 显式设 `alwaysOnTop: false`
5. **右键菜单 interaction 默认选中** — 移除 `class="active"` 和 active-dot

## 四轮修复

1. **锚点方向修正** — 改为画布中心 (50%, 50%) 作为锚点，取反 ny（`-ny * 30`）修正上下方向
2. **流式等待动画** — streaming 且无文本时显示三个 bounce 点动画（`animate-bounce` with staggered delays）
3. **人物左移** — x 从 `viewW * 0.35` 改为 `viewW * 0.28`

## 五轮修复

1. **锚点 Y 改为 90%** — 从画布中心改为底部 10% 位置（`rect.height * 0.9`）
2. **画布加宽 20%** — PET_WIDTH 从 233 改为 280
3. **人物再左移** — x 从 `viewW * 0.28` 改为 `viewW * 0.24`
4. **流式返回修复** — `response.completed` 事件不再直接调 `onDone`，改为等待 `[DONE]` 事件，确保所有 delta 先处理完
5. **文本选中** — 消息气泡添加 `select-text` class，允许自由选择文字
6. **滚动条样式** — 添加 `.custom-scrollbar` 样式：6px 宽、半透明圆角 thumb、hover 变亮
7. **消息宽度扩大** — 从 `max-w-[70%]` 改为 `max-w-[85%]`，消息区域 padding 从 `px-8` 改为 `px-12`
8. **聊天窗口全屏** — 使用 `display.workArea` 的完整尺寸和位置，去除 taskbar 遮挡

## 六轮修复

1. **锚点 Y 改为顶部 10%** — `rect.height * 0.1`（之前误设为 0.9）
2. **画布放大但人物不放大** — scale 计算改用固定参考尺寸 (233×567)，不再随画布缩放
3. **流式显示模拟** — 当 API 不返回增量 delta（文本一次性到达）时，将文本按 3 字符分片，每片 20ms 延迟发送 `onDelta`，模拟逐字流式效果

## 七轮修复

1. **锚点 Y 改为顶部 10%** — `rect.height * 0.1`（六轮误写为 0.9，现修正）
2. **画布放大但人物不放大** — scale 改用固定参考尺寸 (233×567) 计算，画布加宽不影响人物大小
3. **流式调试** — 移除分片 hack（弱智方案），加 console.log 追踪 SSE 事件。curl 测试确认 API 返回逐 token 的 `response.output_text.delta` 事件，解析逻辑正确。需用户确认 Console 输出排查渲染问题

## 已知问题 / 留给下轮

- context-menu.html 的样式是硬编码的 CSS，与 Vue 组件的 Tailwind tokens 不共享，后续需统一
- 会话消息的 `before` 时间戳用的是 `Date.now()` 而非实际最早消息时间，极端场景可能重复加载
- `focusController.y` 的正负方向已取反修正，但不同模型可能需要不同方向
