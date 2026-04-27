# HiHermes 二次元桌宠 AI 助手 - 项目总结

## 项目概述
HiHermes 是一款跨平台（macOS/Windows）的二次元桌宠 AI 助手。项目将 Q 版 Lottie 动画常驻在桌面右下角，用户可通过唤醒词触发交互，并以纯文本或流式语音的形式与后端的 Hermes Agent 进行对话。

## 核心架构与技术栈
- **底层框架**：Electron 33（支持透明窗口、系统托盘等原生特性）
- **前端栈**：React 18 + TypeScript 5 + Vite 5
- **语音识别 (ASR)**：使用 `sherpa-onnx-node` 集成 `paraformer-zh-small` 模型，提供极低功耗的离线唤醒词检测和流式语音识别。
- **语音合成 (TTS)**：调用 `msedge-tts` (Edge TTS) 的 `zh-CN-XiaoyiNeural` 音色，进行句子级流式播报。
- **大模型后端**：通过本地子进程桥接 `Hermes Agent CLI`，实现持久化记忆、工具调用和会话管理。
- **动画引擎**：Lottie Web（用于呈现桌宠的待机、唤醒、说话、休眠等状态）。

## 交互模式
1. **语音唤醒模式（桌宠态）**：
   桌面右下角常驻 → 喊出唤醒词（如"小赫"） → Lottie 触发唤醒动画 → 用户说话进行流式 ASR 识别 → 传给 Hermes Agent → 获取回复并分句进行 Edge TTS 语音播报。
2. **聊天窗口模式（面板态）**：
   双击桌宠 → 弹出 React Chat UI 面板 → 支持文字输入与图片上传（不触发语音回复） → 关闭后退回桌宠态。

## 项目结构
- `src/main/`: Electron 主进程代码，包含窗口管理 (`index.ts`)、托盘 (`tray.ts`)、Hermes 子进程桥接 (`hermes-bridge.ts`)、唤醒与识别引擎 (`sherpa-engine.ts`) 以及 TTS 引擎 (`tts-engine.ts`)。
- `src/renderer/`: React 渲染进程代码，按功能划分为桌宠页面 (`pet/`) 和聊天窗口页面 (`chat/`)，通过自定义 Hooks (如 `useHermes`, `useVoice`) 管理状态和 IPC 通信。
- `assets/`: Lottie 动画资源。
- `model/`: 本地 ONNX 语音模型。

## 现状与待办
- **已完成**：Electron+React 基础脚手架、Hermes CLI 子进程单次交互桥接、纯文字聊天窗口及图片上传。
- **规划中/开发中**：Sherpa-ONNX 离线唤醒与流式识别、Edge TTS 语音回复、透明桌宠窗口及 Lottie 动画、双击打开聊天面板等核心功能。
