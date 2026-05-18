# AGENTS.md — HermesPet Workspace

> 给 Codex（以及未来接手的协作者）的"上车说明"。
> **真理之源** 是 [.trae/rules/project.md](.trae/rules/project.md)，本文件只做导览与工作流。

---

## 项目一句话

HermesPet = Electron 桌面宠物 + Hermes Agent Bridge + CosyVoice (TTS) + Live2D，
**核心是 Runtime Layer**（流式解析 / Emotion / Motion / Audio Queue / Protocol），
不是聊天框。

## 仓库布局

```
HermesPet/
├── .trae/rules/project.md             # ★ 规范，单一真理之源
├── AGENTS.md                          # ← 你正在读
├── docs/                              # ★ 迭代日志（每轮 vibe coding 必写）
├── stitch_hermes_desktop_companion/   # UI 设计稿（HTML mockup + 截图 + DESIGN.md）
├── live2d/                            # Live2D 模型主清单
│   └── tuzi_mian__2_/                 #   主模型（315 参数，无 exp/motion 文件）
├── Alexia.zip                         # 备选模型（含 16 表情 + 1 motion）
└── <项目骨架待建>                       # Electron+Vue3+TS+Vite+Pinia+Tailwind
```

## 关键资产位置（绝对路径）

| 类型 | 路径 |
|---|---|
| 项目规范 | `/Users/lixincheng/workspace/HermesPet/.trae/rules/project.md` |
| UI 设计稿 | `/Users/lixincheng/workspace/HermesPet/stitch_hermes_desktop_companion/` |
| 设计 tokens | `stitch_hermes_desktop_companion/hermes_os/DESIGN.md` |
| 主 Live2D 模型 | `/Users/lixincheng/workspace/HermesPet/live2d/tuzi_mian__2_/` |
| 备选模型 | `/Users/lixincheng/workspace/HermesPet/Alexia.zip` |
| 迭代日志 | `/Users/lixincheng/workspace/HermesPet/docs/` |

## 红线（开始写代码之前必读）

1. **不开发多模型/多 Provider 抽象** —— 当前阶段只对接本地 Hermes Agent Bridge，provider/model 解析交给本机 Hermes 配置。
2. **不 fork / 不修改 Hermes** —— 仅通过 Hermes Agent Bridge + System Prompt 接入。
3. **Streaming First** —— 禁用 `text.replace()`、禁用整段拼接后再解析。必须 Agent delta/SSE → buffer → state machine → AST。
4. **Message 不是字符串** —— 用 AST (`MessagePart` 联合类型)，禁止 `type Message = string`。
5. **LLM 只生成意图，Runtime 执行** —— `<emotion>` / `<motion>` / `<speech>` / `<media>` / `<tool>` / `<status>` 是抽象意图标签，由 Runtime 映射到实际能力。
   - **抽象意图 ≠ Live2D 实参 / 实文件名**。禁止 `model.motion('wave')` / `model.expression('happy')` 这种把抽象字符串直接喂 SDK 的写法。必须经 motion-runtime / emotion-runtime 的映射表，根据当前装载模型 (`model.internalModel.settings`) 实有的 Motions / Expressions / 参数 ID 决定执行路径。详见 project.md §11 / §20。
6. **CosyVoice 接入推迟** —— 现在只占位 `tts-runtime.ts`，等用户给部署地址 + API 协议再补。
7. **媒体安全** —— 所有媒体限制在 `~/HermesPet_Media/`，禁止 `..` 跳出。

## Live2D 模型实情（必看，prompt 里写错的多）

`tuzi_mian` 主模型 **没有** `.exp3.json` / `.motion3.json`，且 model3.json 的
`Groups.LipSync` / `Groups.EyeBlink` **是空数组**。Runtime 装载时必须手动注入：

- `LipSync = ["ParamMouthOpenY"]`
- `EyeBlink = ["ParamEyeLOpen", "ParamEyeROpen"]`
- emotion / motion 通过参数关键帧合成（`ParamMouthForm`, `ParamEyeLSmile`,
  `ParamEyeRSmile`, `Param48`, `Param49`, `Param50` 等可用）。

完整参数表见 project.md §20.1。

## 工作流：每轮 vibe coding

1. 读 `.trae/rules/project.md`（规范）+ 本文件（导览）。
2. 读 `docs/README.md` 了解最近一次迭代落到哪里。
3. 写代码。
4. **同一次落盘** 写 `docs/iteration-NNN-<slug>.md`：动机 / 改动 / 验证方式 / 已知问题。
5. 在 `docs/README.md` 顶部追加一行索引。
6. 编号单调递增，绝不复用 / 回填。

## Superpowers 协作技能（可选增强）

本机已安装 Superpowers：

- clone: `/Users/lixincheng/.codex/superpowers`
- skill symlink: `/Users/lixincheng/.agents/skills/superpowers`

Codex 需重启后才能发现新增 skills。团队安装、Claude Code / Trae 交接方式见
[`docs/superpowers-team-workflow.md`](docs/superpowers-team-workflow.md)。

优先级：`.trae/rules/project.md` 和本文件高于 Superpowers。若 Superpowers 的通用流程
与 HermesPet 红线冲突，以 HermesPet 规范为准。

## 命令备忘（项目骨架就绪后再补）

```bash
# 待项目骨架就绪后填充：
# pnpm dev              # Electron + Vite dev server
# pnpm build            # 打包桌面端
# pnpm typecheck        # tsc --noEmit
# pnpm lint
```

## 与用户协作的偏好

- 规划阶段：用 EnterPlanMode 提案，复杂决策用 AskUserQuestion。
- 实现阶段：禁止过度抽象 / 防御式校验 / 注释噪声；遵循 project.md §15 的 Runtime 目录布局。
- 每完成一轮迭代主动写迭代日志（不等用户提醒）。
