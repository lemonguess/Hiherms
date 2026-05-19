# Hermes 后端模块补齐产品说明

- **日期**: 2026-05-19
- **状态**: 本轮实施说明
- **参考**: `EKKOLearnAI/hermes-web-ui` 的 route/controller/service 分层与左侧模块组织

## 背景

HermesPet 的目标不是复制一个完整 Web UI，而是在桌宠运行时里提供足够的 Hermes 操作面板。用户仍然主要通过桌宠对话、Live2D 反馈、语音和动作与 Hermes 交互；新增模块负责暴露本地 Hermes 状态，让团队排查配置、模型、网关、技能、记忆和日志时不用离开桌宠。

上一轮已经补齐了 hermes-web-ui 风格的左侧导航和部分只读 dashboard IPC，但多个入口仍停留在 planned/partial 文案。对团队交付来说，这会造成两个问题：

- 前端看起来有模块，但后端没有稳定数据契约，Claude Code / Trae 接手时容易继续堆 UI 占位。
- Hermes 运行状态分散在 profile 文件、日志、skills 目录和 CLI 输出里，缺少桌宠自己的聚合边界。

## 产品目标

本轮新增能力的目标是把“模块入口”变成“可读的本地运行态面板”：

- **网关**: 看当前 active profile 的 gateway 状态，并保留启动/停止/重启操作。
- **模型**: 从 profile 配置和认证文件读取当前模型分组，展示本机 Hermes 暴露的 provider/model。
- **日志**: 读取 Hermes 与 HermesPet 日志目录，展示文件名、大小和更新时间。
- **用户 / Profile**: 展示 default 与 profiles 目录里的 profile，标明 active、路径、默认模型。
- **技能**: 扫描 `~/.hermes/skills`，按 category 展示技能数量、启用状态和来源线索。
- **记忆**: 读取 `MEMORY.md`、`USER.md`、`SOUL.md` 的存在状态、大小、更新时间和预览。
- **用量 / 技能用量**: 当前阶段先提供本地可证明的 summary，占位原因要明确；不伪造 token 统计。

## 非目标

- 不引入 Koa/HTTP BFF；HermesPet 仍使用 Electron main IPC。
- 不 fork 或修改 Hermes。
- 不在 HermesPet 内重建 provider/model 管理系统。
- 不实现完整 skills 编辑、profile 创建/删除、memory 保存、usage 图表写入。
- 不改变现有桌宠聊天、HRP AST、Live2D Runtime 的职责边界。

## 后端边界

参考 hermes-web-ui 的 `routes/index.ts` 注册方式，HermesPet 使用一个 main-process service 聚合模块数据：

```text
Renderer ChatApp.vue
  -> preload window.hermes.dashboard
  -> Electron IPC
  -> HermesDashboardService
  -> 本机 Hermes profile 文件 / skills / memory / logs / hermes CLI
```

这次补齐的重点是数据契约，而不是 UI 装饰。Renderer 只负责渲染 `HermesDashboardSummary` 和 `HermesDashboardDetails`，不直接读磁盘，不直接调用 Hermes CLI。

## Live2D 服装修复说明

本轮同时修复用户反馈的暗黑服装回归：

- `tuzi mian.cdi3.json` 标注 `Part28=常规服装`，`Part20=暗黑服装`，`Part39=腿`。
- `iteration-008` 已验证：暗黑模式不能把 `Part28` 置 0，否则基础衣物会消失。
- `iteration-012` 新 preset 再次把 `Part28` 置 0，并批量控制 `Part39` 等子 part，导致腿和衣物透明。

新的产品行为是：服装切换只切换安全的 root layer。

- 常服：`Part28=1`、`Part20=0`
- 暗黑：`Part28=1`、`Part20=1`
- 不再批量隐藏 `Part39` 等身体/腿部相关 part。
- 服装参数暂不强行全量置 1；等后续有模型 inspector 后再精细化映射。

## 验收标准

- 暗黑服装点击后角色腿部仍可见，衣服不透明消失。
- 常服和暗黑可以往返切换，不留下不可见 part。
- `window.hermes.dashboard.details()` 能返回 profile、skills、memory、usage、gateway 的只读聚合数据。
- 对话窗口中 profiles/skills/memory/usage/skillsUsage 不再只是 planned 文案。
- 新增或调整行为有 Node 测试覆盖，`typecheck` 和 `build` 通过。
