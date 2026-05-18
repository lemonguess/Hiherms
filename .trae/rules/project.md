---
alwaysApply: false
---
# HermesPet 项目规范

版本：v0.3
架构：Electron + Vue3 + Hermes Agent Bridge + CosyVoice + Live2D
定位：AI Native Desktop Runtime

---

# 1. 项目目标

HermesPet 不是传统聊天软件。

Hermes 负责：

- 对话生成
- 情绪意图
- 动作意图
- 媒体意图
- TTS 意图

Runtime 负责：

- UI
- Live2D
- TTS
- Emotion
- Motion
- Media
- Tool 状态
- 流式解析

核心原则：

# LLM 只生成意图
# Runtime 负责执行

---

# 2. 当前阶段目标

当前阶段：

# 仅支持本地 Hermes Agent Bridge

运行方式：

```text
Electron
↓
main process 启动 HermesPet Bridge
↓
Bridge 调用本机 Hermes Agent 交互运行时
↓
Hermes 负责底层模型 / 工具 / Agent loop
```

Renderer 禁止直接访问 localhost Hermes API。聊天入口必须经过：

```text
Renderer
↓
preload IPC
↓
Electron main
↓
HermesPet Bridge
↓
Hermes Agent
```

未来可能支持：

- 远端 Hermes Gateway / Agent Bridge

但当前阶段：

# 不开发多模型兼容
# 不开发 Provider 抽象层

仅预留接口结构。Hermes 的 provider / model 解析由本机 Hermes 配置承担，HermesPet 不在 UI
层重新做一套 provider 管理。

---

# 3. 技术栈

## 前端

- Vue3
- TypeScript
- Vite
- Pinia
- TailwindCSS

## 桌面端

- Electron
- preload + contextBridge
- IPC 通信

## AI

- Hermes Agent Bridge
- Electron IPC
- Python 本地 socket bridge
- Agent delta Streaming

## Live2D

- Cubism Core (运行时由模型自带)
- pixi-live2d-display (推荐渲染层) 或 Cubism Web Framework

## 语音 (TTS)

- CosyVoice (本地或远程，部署待用户提供)
- 当前阶段仅预留接口，**不实现** 具体调用

## 其他

- better-sqlite3

---

# 4. 核心架构

```text
User
 ↓
Electron UI
 ↓
Runtime Layer
 ↓
Hermes Agent Bridge
 ↓
Agent Delta Stream
 ↓
HRP Parser
 ↓
AST
 ↓
Renderer / TTS / Live2D
```

---

# 5. 重要原则

## 不修改 Hermes

禁止：

- fork Hermes
- 修改 Hermes 内核
- hack Hermes Runtime

仅通过：

- Hermes Agent Bridge
- System Prompt

接入。

---

## Streaming First

所有解析必须支持：

- Agent delta / SSE 分块
- 增量解析
- 半截标签

禁止：

```ts
text.replace(...)
```

必须：

```text
stream
↓
buffer
↓
state machine parser
↓
AST
```

---

## Runtime 主导

Hermes 不直接控制 UI。

Hermes 输出：

```text
Intent Stream
```

Runtime 负责：

- 动作
- 表情
- TTS
- 文件
- Tool 状态

---

# 6. HRP 协议

Hermes 可输出协议标签。

示例：

```text
主人回来啦～

<emotion value="happy" />

<motion action="wave" />

<speech tone="soft">
辛苦啦～
</speech>
```

---

# 7. 支持标签

| 标签 | 作用 |
|---|---|
| `<speech>` | TTS |
| `<emotion>` | 情绪 |
| `<motion>` | 动作 |
| `<media>` | 文件 |
| `<tool>` | Tool 状态 |
| `<status>` | Runtime 状态 |

---

# 8. Speech

示例：

```xml
<speech
  tone="soft"
  speed="1.0"
  emotion="happy"
>
主人辛苦啦～
</speech>
```

tone 推荐值：

```text
soft
happy
cute
sad
angry
shy
sleepy
```

---

# 9. 语音引擎 (CosyVoice)

本项目语音合成切换为 **CosyVoice**。CosyVoice 不是真正 SSML，
情绪通过 reference audio 注入。

正确做法：

```text
emotion + text
↓
reference audio (per emotion)
↓
CosyVoice HTTP API
↓
audio stream
```

示例（暂定）：

```ts
const emotionMap = {
  happy: "refs/happy.wav",
  sad:   "refs/sad.wav",
  shy:   "refs/shy.wav",
  // ...
}
```

## 当前阶段

- 仅预留 `src/runtime/tts-runtime.ts` 接口和 emotion → reference 的映射
- **不实现** 具体的 HTTP 调用、不打包 CosyVoice 二进制
- 待用户提供 **部署地址 + API 协议** 后再补全 client（请求/流式响应/参数）
- emotion 映射、reference audio 资源占位即可

> Runtime 在 client 未配置时应直接 no-op TTS（不阻塞流式渲染）。

---

# 10. Emotion

示例：

```xml
<emotion value="happy" intensity="0.8" />
```

推荐值（**HRP 抽象意图**，不是 Live2D 参数名）：

```text
neutral
happy
sad
angry
cute
shy
sleepy
thinking
```

Emotion 会影响：

- Live2D
- 呼吸
- TTS
- Idle 动作

> **Runtime 必须做映射层**：抽象 emotion → 当前装载模型的 expression 或参数关键帧。
> 详见 §20 Live2D 模型清单。

**严令禁止** 把 `happy` / `sad` 等抽象 emotion 字符串直接当作 expression 文件名
调用（`model.expression('happy')`）—— tuzi_mian 完全没有 .exp3.json，Alexia 表情
是拼音名（`bbt`/`dyj`/...），都不会命中。必须经 emotion-runtime 的映射表。

---

# 11. Motion

示例：

```xml
<motion action="wave" />
```

推荐动作（**HRP 抽象意图**）：

```text
idle
blink
wave
nod
shake_head
sleep
happy_jump
```

必须使用：

# Motion Queue

禁止直接播放动作。

> **Runtime 必须做映射层**：抽象 motion → 当前模型的 .motion3.json，或参数关键帧合成；
> 模型未提供对应动作时降级为 idle。详见 §20。

**严令禁止**：
- 直接把抽象意图字符串当作 Live2D 动作名 / 参数 ID 调用
  （如 `model.motion('wave')` —— tuzi_mian 不存在 `wave`，会静默失败）
- 在代码里硬编码 `idle` / `blink` / `wave` 等抽象名调用底层 SDK
- 假设当前模型一定有某个表情或参数 —— 必须查 `model.internalModel.coreModel`
  和 model3.json 实有的 Groups / Expressions / Motions 再决定执行路径

正确流程：

```text
HRP <motion action="wave" />
    ↓
motion-runtime.resolve('wave')
    ↓
查 §20 模型清单 → 当前模型有/没有对应实现
    ↓
有: model.motion('xxx.motion3.json') 走原生
无: 用实参 ID 合成关键帧 (e.g. ParamAngleY 正弦) 或降级 idle
```

---

# 12. Media

示例：

```xml
<media
  type="image"
  src="/images/cat.png"
/>
```

支持：

- image
- audio
- video
- file

---

# 13. Media 安全

所有媒体必须限制在：

```text
~/HermesPet_Media/
```

禁止：

```text
../../system
```

访问。

---

# 14. Message AST

禁止：

```ts
type Message = string
```

必须：

```ts
type MessagePart =
  | TextPart
  | SpeechPart
  | EmotionPart
  | MotionPart
  | MediaPart
  | ToolPart
```

---

# 15. Runtime 目录

```text
src/runtime/
├── stream-parser.ts
├── ast-builder.ts
├── protocol-repair.ts
├── motion-runtime.ts
├── emotion-runtime.ts
├── tts-runtime.ts
├── media-runtime.ts
├── tool-runtime.ts
└── audio-queue.ts
```

---

# 16. 协议修复层

LLM 可能输出错误标签：

```xml
<emotion happy>
```

Runtime 自动修复：

```xml
<emotion value="happy" />
```

---

# 17. Prompt 注入

Runtime 自动 prepend：

```text
You are HermesPet Desktop Assistant.

You may output:

<speech />
<emotion />
<motion />
<media />
<tool />
<status />

Rules:
1. tags can mix with text
2. never explain tags
3. keep responses natural
```

---

# 18. 数据库

## sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

## messages

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content TEXT,
  ast_json TEXT,
  created_at INTEGER
);
```

---

# 19. 项目核心

HermesPet 的核心不是聊天框。

而是：

# Runtime Layer
# Streaming Parser
# Emotion Runtime
# Motion Queue
# Audio Runtime
# Protocol Layer
# AST

---

# 20. Live2D 模型清单 (Asset Inventory)

> 本节是 §10 emotion 与 §11 motion 的事实补充。
> **以下参数为实际模型参数，HRP 抽象意图必须映射到这些参数。**

模型存放位置：

```
/Users/lixincheng/workspace/HermesPet/live2d/    （主清单）
/Users/lixincheng/workspace/HermesPet/Alexia.zip （备选，需解压）
```

## 20.1 主模型: tuzi_mian

路径: `live2d/tuzi_mian__2_/tuzi mian.model3.json`

文件: `.moc3` / `.model3.json` / `.physics3.json` / `.cdi3.json` + 4096 纹理 ×3

**实际可驱动参数**（从 cdi3.json 提取）：

| 用途 | Parameter ID | 备注 |
|---|---|---|
| 口型 (LipSync) | `ParamMouthOpenY` | 嘴 张开/闭合 |
| 嘴形 | `ParamMouthForm` | 嘴 变形 |
| 左眼开闭 | `ParamEyeLOpen` | |
| 右眼开闭 | `ParamEyeROpen` | |
| 左眼微笑 | `ParamEyeLSmile` | |
| 右眼微笑 | `ParamEyeRSmile` | |
| 眼珠 X/Y | `ParamEyeBallX` / `ParamEyeBallY` | |
| 头部 X/Y | `ParamAngleX` / `ParamAngleY` | |
| 歪嘴 | `Param48` / `Param50` | 表情合成用 |
| 瞪眼 | `Param49` | 表情合成用 |

参数总数: 315；CombinedParameter 组: 2 (`ParamAngleX/Y`, `ParamMouthForm/OpenY`)。

**特别注意**：

- model3.json 中 `Groups.LipSync` 与 `Groups.EyeBlink` **均为空数组**，
  Runtime 装载时必须手动注入：
  - `LipSync = ["ParamMouthOpenY"]`
  - `EyeBlink = ["ParamEyeLOpen", "ParamEyeROpen"]`
- 该模型 **没有** `.exp3.json` / `.motion3.json` —
  emotion / motion 必须在 Runtime 用参数关键帧合成。

## 20.2 备选模型: Alexia (Alexia.zip)

解压目录约定: `live2d/Alexia/`（首次需要时解压）

可用配置（基于 model3.json）：

- LipSync: `ParamMouthOpenY`
- EyeBlink: `ParamEyeLOpen`, `ParamEyeROpen`
- Expressions (16 个，命名为拼音首字母):
  `bbt`, `dyj`, `h`, `k`, `lh`, `lzx`, `mj`, `sq`,
  `wh`, `xxy`, `y`, `yf`, `yfmz`, `yjys1`, `yjys2`, `zs1`
- Motions: `dh.motion3.json` (1 个)

emotion → expression 的语义映射 **由用户后续指定**（拼音名含义不固定）。

## 20.3 Runtime 模型适配层

`emotion-runtime` / `motion-runtime` 必须实现：

```ts
type EmotionMapping =
  | { intent: EmotionIntent; expression: string }              // 走 .exp3.json
  | { intent: EmotionIntent; paramKeyframes: ParamKeyframe[] } // 走参数合成

type MotionMapping =
  | { intent: MotionIntent; motionFile: string }
  | { intent: MotionIntent; paramKeyframes: ParamKeyframe[] }
```

加载模型时根据 model3.json 自动选用映射策略；未匹配的意图降级为 `neutral` / `idle`。

---

# 21. UI 设计源 (Design Reference)

视觉与交互稿位于：

```
/Users/lixincheng/workspace/HermesPet/stitch_hermes_desktop_companion/
```

包含：

- `hermes_os/DESIGN.md` — 设计系统（颜色、字体、间距、玻璃拟态规则）
- `hermespet_chat_interface/`     — 主对话界面（HTML 静态稿 + 截图）
- `hermespet_history_sessions/`   — 历史会话
- `hermespet_enhanced_settings/`  — 系统设置
- `hermespet_context_menu/`       — 右键菜单
- `hermespet_product_documentation.md` — 产品功能说明

## 设计令牌（Design Tokens，落到 Tailwind config）

- 强调色: `#00daf3` (primary-fixed-dim) / `#00e5ff` (primary-container)
- 表面色: `#131315` 起步的多层深灰
- 字体: `Inter` (正文) / `Geist` (label / 状态)
- 圆角: `rounded-xl` (浮窗) / `rounded-lg` (控件) / `rounded-full` (输入条/胶囊)
- 玻璃效果: 70% 表面 + `backdrop-blur-xl` (32px) + 1px 白 15% 边

## 实现要求

- 严格遵循 `hermes_os/DESIGN.md`；具体值以该文件为准
- Live2D overlay 区域必须 `pointer-events-none`（除热区）
- 主窗口背景透明，支持桌面穿透与拖拽

---

# 22. 文档与迭代日志 (docs/)

`docs/` 目录是项目迭代的事实记录。

```
docs/
├── README.md                       # 索引 + 写作约定
├── iteration-001-bootstrap.md      # 项目骨架
├── iteration-002-<slug>.md         # 后续迭代
└── ...
```

约定：

- 每一轮 vibe coding（每一次有意义的功能更新）必须落到一份
  `iteration-NNN-<slug>.md`
- 每份迭代文档至少包含：**动机 / 改动 / 验证方式 / 已知问题**
- 编号单调递增，**不复用、不回填**
- 完成后在 `docs/README.md` 顶部追加一行索引
- 文档与代码 **同一次提交** 落盘
