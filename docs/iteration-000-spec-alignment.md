# iteration-000 — spec-alignment

- **日期**: 2026-05-13
- **范围**: 文档对齐 / 资产盘点 / 工作流约定（**未写代码**）

## 动机

接手项目时仅有：
- `.trae/rules/project.md`（v0.1，规范）
- `stitch_hermes_desktop_companion/`（UI HTML 静态稿）
- `live2d/tuzi_mian__2_/`（Live2D 模型）
- `Alexia.zip`（备选 Live2D 模型）

规范里写的是 **GPT-SoVITS** + 抽象 emotion/motion 推荐值，但用户确认：
- TTS 切到 **CosyVoice**（部署地址未提供，先不写）
- Live2D 实际参数应以模型为准（不是规范里的推荐值）

需要在写第一行代码前把这些落到文档，避免后续 vibe coding 各自为政。

## 改动

### 文件

- 编辑 `.trae/rules/project.md`（v0.1 → **v0.2**）
  - L7: 架构行 `GPT-SoVITS` → `CosyVoice`
  - §3 技术栈：拆出 Live2D / 语音子节，标注 CosyVoice 当前不实现
  - §9 整节重写：`GPT-SoVITS` → `CosyVoice`，明确 **当前阶段仅占位接口**
  - §10 / §11：emotion / motion 推荐值标注为 **HRP 抽象意图**，强调
    Runtime 必须做到 "抽象意图 → 实际模型参数" 的映射层
  - 追加 §20 **Live2D 模型清单**：tuzi_mian 实际参数 + Alexia 备选 + 适配层接口
  - 追加 §21 **UI 设计源**：指向 `stitch_hermes_desktop_companion/`
  - 追加 §22 **文档与迭代日志**：约定 `docs/iteration-NNN-*.md` 工作流
- 新建 `CLAUDE.md`（仓库根）：导览 / 资产位置 / 红线 / 工作流
- 新建 `docs/README.md`：迭代日志索引 + 写作约定
- 新建 `docs/iteration-000-spec-alignment.md`（本文）

### 关键事实（盘点产出）

**tuzi_mian 主模型（live2d/tuzi_mian__2_/）**：
- 315 参数，2 组 CombinedParameter (`ParamAngleX/Y`, `ParamMouthForm/OpenY`)
- model3.json 的 `Groups.LipSync` / `Groups.EyeBlink` **是空数组** —
  Runtime 装载时必须手动注入 `["ParamMouthOpenY"]` / `["ParamEyeLOpen", "ParamEyeROpen"]`
- **没有** `.exp3.json` / `.motion3.json` —
  emotion / motion 必须由参数关键帧合成
- 表情合成可用参数：`ParamMouthForm`, `ParamEyeLSmile`, `ParamEyeRSmile`,
  `Param48` (歪嘴), `Param49` (瞪眼), `Param50` (歪嘴-嘴)

**Alexia.zip 备选模型**：
- 16 个 `.exp3.json` 表情（拼音名: bbt/dyj/h/k/lh/lzx/mj/sq/wh/xxy/y/yf/yfmz/yjys1/yjys2/zs1）
- 1 个 motion (`dh.motion3.json`)
- 拼音表情命名含义不明确，emotion → expression 映射 **由用户后续指定**

**UI 设计源（stitch_hermes_desktop_companion/）**：
- 玻璃拟态深色主题，强调色 `#00daf3` (primary-fixed-dim) / `#00e5ff` (primary-container)
- 字体 Inter (正文) / Geist (label)
- 圆角 `rounded-xl` 浮窗 / `rounded-lg` 控件 / `rounded-full` 输入条
- 已有静态 HTML 稿 4 份：chat / history / settings / context-menu

## 验证方式

无代码改动；仅文档对齐。验证手段：
- 读 `project.md` v0.2，确认 §9 / §20 / §21 / §22 已落到位
- 读 `CLAUDE.md`，确认资产位置与红线一致
- `docs/README.md` 索引与本文件存在

## 已知问题 / 留给下一轮

- **项目骨架未建** —— 下一轮 (`iteration-001`) 计划 bootstrap
  Electron + Vue3 + TS + Vite + Pinia + Tailwind + 透明窗口。
- **Live2D 渲染库未定** —— 倾向 `pixi-live2d-display`，但需在 iteration-001
  与用户确认。
- **emotion → 模型参数 映射表 未建** —— 需要装载模型后实际调参确定每个
  intent 的关键帧；安排在 iteration-002 (Live2D Runtime) 之后。
- **Alexia 表情语义** —— 16 个拼音名需要用户人工指定语义映射，或
  Runtime 提供调试 UI 让用户即时映射。
- **CosyVoice client** —— 等用户提供地址 + 协议后，单独一轮迭代补全。
