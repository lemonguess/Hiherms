# iteration-001 — bootstrap

- **日期**: 2026-05-13
- **范围**: Electron 透明窗 + Live2D 模型渲染 + 基础生命迹象 + 项目骨架

## 动机

项目从零开始，需要搭建完整的 Electron + Vue3 + TypeScript + Vite + Pinia + Tailwind 开发环境，
并让 tuzi_mian Live2D 模型在透明无边框窗口中渲染并表现出生命迹象（呼吸/眨眼/鼠标跟随/点击反应）。

关联 project.md §15（Runtime 目录布局）、§20（Live2D 模型资产）。

## 改动

### 新增文件

**项目配置**:
- `package.json` — pnpm 项目，Electron 33 + electron-vite 2.3.0 + Vue3 + PixiJS 6.5
- `electron.vite.config.ts` — main/preload/renderer 三入口，`@live2d` alias 指向 `live2d/`
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` — strict TypeScript
- `tailwind.config.ts` — 从 DESIGN.md mockup 搬迁的 31 色 tokens + 自定义字体/间距
- `postcss.config.js` — Tailwind + autoprefixer
- `.gitignore` / `.npmrc`

**Electron 主进程**:
- `src/main/index.ts` — app.whenReady → createMainWindow，IPC 注册
- `src/main/window.ts` — 480×640 透明无边框窗口，右下角，置顶

**预加载**:
- `src/preload/index.ts` — contextBridge 暴露 window 控制 IPC

**共享类型**:
- `src/shared/types.ts` — MessagePart AST 联合类型（TextPart/SpeechPart/EmotionPart/MotionPart/MediaPart/ToolPart/StatusPart）
- `src/shared/ipc-channels.ts` — IPC 频道名常量

**渲染进程**:
- `src/renderer/index.html` — 含 Cubism Core script tag
- `src/renderer/public/vendor/live2dcubismcore.min.js` — 从 Live2D CDN 下载的 vendor 副本
- `src/renderer/public/vendor/LICENSE.txt` — Cubism Core 许可
- `src/renderer/src/main.ts` — Vue3 + Pinia 初始化
- `src/renderer/src/App.vue` — 承载 Live2DStage + 状态指示器
- `src/renderer/src/styles/tokens.css` — Tailwind base/components（.glass-panel 等）
- `src/renderer/src/components/Live2DStage.vue` — canvas + 模型加载/fit/鼠标跟随

**Live2D 集成**:
- `src/renderer/src/live2d/stage.ts` — PIXI Application 初始化 + Ticker 注册
- `src/renderer/src/live2d/loader.ts` — model3.json fetch + Groups 注入（LipSync/EyeBlink）
- `src/renderer/src/live2d/tuzi-driver.ts` — tuzi_mian 专属生命迹象（呼吸/角度摆动/点击反应）
- `src/renderer/src/live2d/core-shim.d.ts` — Live2DCubismCore 全局类型声明

**Pinia Store**:
- `src/renderer/src/stores/runtime.ts` — modelStatus / modelError

**Runtime Stubs**（9 个，接口签名 + TODO）:
- `src/renderer/src/runtime/stream-parser.ts`
- `src/renderer/src/runtime/ast-builder.ts`
- `src/renderer/src/runtime/protocol-repair.ts`
- `src/renderer/src/runtime/motion-runtime.ts`
- `src/renderer/src/runtime/emotion-runtime.ts`
- `src/renderer/src/runtime/tts-runtime.ts`
- `src/renderer/src/runtime/media-runtime.ts`
- `src/renderer/src/runtime/tool-runtime.ts`
- `src/renderer/src/runtime/audio-queue.ts`

### 关键决策

1. **electron-vite 2.3.0** — 主进程 ESM 输出 + `externalizeDepsPlugin`，兼容 Vite 5
2. **Cubism Core vendor** — 从 `https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js` 下载到 `public/vendor/`
3. **模型路径** — 通过 Vite `@live2d` alias + `server.fs.allow` 直接读取工作区外的 `live2d/` 目录
4. **Groups 注入** — loader.ts 在 model3.json 解析后、Live2DModel.from 之前注入 LipSync/EyeBlink 参数组
5. **tuzi-driver** — 通过 `model.on('beforeUpdate')` 每帧写入 ParamAngleX/Y 实现呼吸摆动；通过 `model.on('hit')`/`pointerdown` 触发 420ms 歪嘴瞪眼反应
6. **`env ELECTRON_RUN_AS_NODE=`** — IDE (VSCode/Trae) 设置了 `ELECTRON_RUN_AS_NODE=1`，导致 Electron 不进入 app 模式，`require('electron')` 返回 npm 包路径而非 API。dev script 必须清除此变量。

## 验证方式

1. `pnpm install && pnpm dev` — 透明无边框窗口出现，tuzi_mian 模型渲染
2. 模型表现：眨眼（EyeBlink 自动）、呼吸/角度摆动（ParamAngleY 正弦波）、鼠标跟随（model.focus）
3. 点击模型触发歪嘴+瞪眼短反应（420ms 三角缓动）
4. `pnpm typecheck` 通过
5. DevTools console 无报错（仅 stub warn）

## 已知问题 / 留给下一轮

- `ELECTRON_RUN_AS_NODE` 问题仅在 IDE 终端中出现；正常终端不受影响。dev script 的 `env` 前缀仅兼容 macOS/Linux，Windows 需 `cross-env`。
- Cubism Core LICENSE.txt 需要确认是否为官方完整许可文本。
- `tuzi_mian` 的 HitAreas 可能为空，此时 fallback 到 `pointerdown` 事件。
- Runtime stubs 为 9 个 no-op 文件，等待后续迭代实现。
