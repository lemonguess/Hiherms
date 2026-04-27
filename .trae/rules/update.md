这份文档专为 **Claude Code** 或类似 AI 编程助手设计，记录当前 Tauri 版桌宠的落地状态、约束和下一步开发方向，便于后续继续迭代而不重复踩坑。

---

# Tauri 版桌宠当前实现说明

## 1. 当前状态
项目已切到 **Tauri + React + PixiJS + Live2D** 技术路径，当前可运行的桌宠原型包含：
- 透明、无边框、置顶的桌宠主窗口。
- Live2D 模型渲染与基础跟随展示。
- 双击桌宠后打开独立的、居中显示的聊天窗口。
- Rust 端通过 `emit` 向前端推送模拟流式对话文本。

### 当前关键结论
* **PixiJS 必须使用 v6：** `pixi-live2d-display@0.4.0` 与 Pixi v7 不兼容，会导致模型贴图错乱和碎片化。
* **点击穿透逻辑暂时关闭：** 之前的穿透实现会把整个窗口切成忽略鼠标事件，导致双击桌宠无法触发。
* **聊天必须走独立窗口：** 主窗缩成右下角桌宠后，聊天面板不适合继续内嵌在桌宠窗口中。

---

## 2. 当前技术实现
| 维度 | 选型 | 说明 |
| :--- | :--- | :--- |
| **底层框架** | **Tauri 2 / Rust** | 当前主窗和聊天窗都基于 Tauri Window API。 |
| **前端框架** | **React 18 + TypeScript** | 负责桌宠页与聊天页。 |
| **渲染引擎** | **PixiJS 6 + Live2D** | 当前已接入 `kei_basic_free.model3.json`。 |
| **通信方式** | **Tauri invoke / emit** | 目前为模拟流式输出，尚未接真实 SSE。 |
| **窗口管理** | **Tauri Window API** | 已实现右下角桌宠窗和居中聊天窗。 |

---

## 3. 当前实现细节

### A. 窗口特性 (Desktop Pet Essentials)
* **主窗尺寸：** 当前主窗口固定为 `420 x 560`。
* **主窗位置：** `PetApp.tsx` 启动时根据 `primaryMonitor().workArea` 计算右下角逻辑坐标并调用 `setPosition`。
* **聊天窗创建：** 双击桌宠时使用 `new WebviewWindow('chat', { center: true, width: 920, height: 680 })` 创建独立聊天窗。
* **点击穿透：** Rust 命令 `set_ignore_cursor_events` 仍存在，但当前前端默认挂载后执行 `ignore: false`，不再动态切换。

### B. Hermes Agent 对接逻辑
* **当前状态：** Rust 的 `connect_agent` 会生成一段模拟文本，并逐字 `emit("agent-chunk")`。
* **桌宠页行为：** `PetApp.tsx` 会将流式文本显示在角色旁边的气泡中。
* **聊天页行为：** `TauriChatApp.tsx` 会将流式文本拼接成 assistant 消息。
* **口型触发：** 当前通过文本尾部匹配 `[Action: Speak]`，调用 `model.speak()` 做演示性质的音频口型同步。

### C. 视觉资源规范
* **当前资源：** 使用 `public/live2d/kei/` 下的 Cubism 4 模型。
* **定位策略：** 先将模型加到 Pixi stage，再基于 `getLocalBounds()` 计算缩放、pivot 和底部对齐位置。
* **现阶段目标：** 先保证模型显示稳定、位置正确、窗口尺寸合理，再继续细化表情与动作状态机。

---

## 4. 当前待办

### 优先级高
- [ ] 重新设计精准点击穿透，保证透明区域可穿透且不影响双击桌宠。
- [ ] 将 `connect_agent` 从模拟流改成真实 Hermes Agent SSE / bridge。
- [ ] 让聊天窗与桌宠窗的焦点切换更自然，例如关闭聊天窗后回到桌宠。

### 优先级中
- [ ] 加入桌宠拖拽与位置持久化。
- [ ] 清理遗留 Electron 代码与 `index.html` 中的 fallback bridge。
- [ ] 统一聊天页与桌宠页的状态管理方式，减少双份实现。

### 环境阻塞
- [ ] 本机运行 `npm run dev` 时出现 `ENOSPC: no space left on device`，需要先清理磁盘空间，否则无法稳定重启 Tauri 开发环境验证界面效果。

---

## 5. 给后续 AI 助手的工作提示
> 当前项目以 Tauri 方案为主，不要再把 Electron 逻辑当成主链路实现。
> 继续开发时，优先围绕 `src/renderer/pet/PetApp.tsx`、`src/renderer/chat/TauriChatApp.tsx`、`src/renderer/main.tsx` 与 `src-tauri/src/lib.rs` 展开。
> 如果要恢复点击穿透，务必先解决“窗口忽略鼠标后双击事件丢失”的问题。
> 如果要验证桌宠布局，需要完整重启 Tauri；但当前机器存在 `ENOSPC`，开发前先确认磁盘空间。

---

## 6. 注意事项
* **不要默认相信旧文档：** 仓库历史里同时存在 Electron 和 Tauri 两套路，必须以当前运行链路为准。
* **多屏与 DPI：** 当前右下角定位已按 `monitor.scaleFactor` 做逻辑像素换算，后续改动不要破坏这一点。
* **验证方式：** 改 `tauri.conf.json` 或窗口参数后，必须完整重启 Tauri 进程，热更新不足以验证窗口尺寸和位置。
