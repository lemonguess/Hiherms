# HiHermes 当前项目总结

## 项目概述
HiHermes 当前正在从旧版 Electron 桌宠方案迁移到 **Tauri + React + PixiJS + Live2D**。现阶段已经完成一个可运行的 Tauri 桌宠原型：主窗口显示 Live2D 桌宠，桌宠固定在桌面右下角，双击可打开独立聊天窗口，聊天消息通过 Tauri 事件流模拟 Hermes Agent 的流式回复。

## 当前实际技术栈
- **底层框架**：Tauri 2 + Rust。
- **前端栈**：React 18 + TypeScript 5 + Vite 5。
- **渲染引擎**：PixiJS 6 + `pixi-live2d-display@0.4.0`。
- **模型资源**：当前接入 `public/live2d/kei/kei_basic_free.model3.json`。
- **后端通信**：Tauri `invoke` + `window.emit`，Rust 端当前为模拟流式输出。
- **遗留兼容**：仓库内仍保留部分 Electron 代码和 `index.html` 中的 Electron fallback bridge，但当前 Tauri 方案不依赖这些逻辑。

## 本轮已经完成的内容
- 修复 `pixi-live2d-display` 与 PixiJS 版本不兼容导致的模型碎片化显示问题，将 `pixi.js` 固定到 v6。
- 清理 `PetApp` 中调试残留内容，移除调试方块、纹理预览和日志面板。
- 暂时关闭点击穿透逻辑，因为原实现会吞掉双击事件，导致桌宠无法打开聊天窗口。
- 将桌宠主窗口缩小为更贴近角色本体的尺寸：`420 x 560`。
- 在前端启动时使用 Tauri Window API 将桌宠窗口定位到主显示器工作区右下角。
- 双击桌宠时不再在原窗口内展开面板，而是新建独立 Tauri 聊天窗口，并保持居中打开。
- 新增 `src/renderer/chat/TauriChatApp.tsx`，作为当前 Tauri 聊天窗口实现。
- 修正 `src/renderer/main.tsx` 的入口路由逻辑：`?mode=pet` 进入桌宠页，Tauri 其他窗口进入聊天页，非 Tauri 环境继续走旧版 `App.tsx`。

## 当前窗口与交互状态
1. **桌宠窗口**
   启动后为透明无边框窗口，固定右下角，尺寸较小，显示 Live2D 模型和气泡文本。
2. **聊天窗口**
   双击桌宠后打开一个独立的居中聊天窗，不再复用桌宠窗口右侧面板。
3. **流式回复**
   Rust 端 `connect_agent` 会逐字 `emit("agent-chunk")`，前端聊天页和桌宠气泡都能接收流式文本。

## 关键文件
- `src/renderer/pet/PetApp.tsx`：桌宠主界面、Live2D 加载、右下角布局、双击打开聊天窗。
- `src/renderer/chat/TauriChatApp.tsx`：当前 Tauri 独立聊天窗口。
- `src/renderer/main.tsx`：按 `mode` 决定渲染桌宠页还是聊天页。
- `src-tauri/src/lib.rs`：Tauri 命令与事件发送，当前提供 `set_ignore_cursor_events` 和 `connect_agent`。
- `src-tauri/tauri.conf.json`：主窗口初始配置，已收窄为桌宠尺寸并设为透明、无边框、置顶、跳过任务栏。
- `index.html`：仍保留 Electron fallback bridge，属于遗留兼容逻辑。

## 当前已知问题
- **点击穿透未完成**：当前为了保证双击可用，已临时关闭精准点击穿透；透明区域点穿桌面能力还未正确恢复。
- **聊天链路仍是模拟版**：Rust 端 `connect_agent` 只是模拟 SSE 输出，尚未接真实 Hermes Agent 服务。
- **旧版 Electron 逻辑仍在仓库中**：包括 `src/main/` 与 `window.hermesAPI` 相关代码，尚未彻底清理。
- **开发环境磁盘空间不足**：执行 `npm run dev` 时出现 `ENOSPC: no space left on device`，当前会阻塞重新启动 Tauri 开发环境。

## 下一步建议
- 恢复“精确点击穿透”，但要避免再次吞掉双击事件。
- 将 `connect_agent` 从模拟输出切换到真实 Hermes Agent SSE 或桥接实现。
- 为桌宠增加拖拽后记忆位置能力。
- 评估是否移除 `index.html` 中的 Electron fallback，避免后续混淆。
