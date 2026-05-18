# iteration-006 — superpowers-skill

- **日期**: 2026-05-15
- **范围**: 安装 Superpowers skill，并补充团队协作文档

## 动机

用户希望当前项目能接入 Superpowers skill，方便 Codex、Claude Code、Trae 或其他同事
延续同一套协作流程。项目已有 `AGENTS.md` 和 `docs/` 迭代日志机制，本轮把 Superpowers
定位为协作增强，而不是项目规范替代品。

## 改动

- 本机安装：
  - clone `https://github.com/obra/superpowers.git` 到 `/Users/lixincheng/.codex/superpowers`
  - 创建 `/Users/lixincheng/.agents/skills/superpowers` 软链接，指向 Superpowers `skills`
- `AGENTS.md`
  - 新增 Superpowers 协作技能入口和优先级说明
- `docs/superpowers-team-workflow.md`
  - 新增团队安装方式、Codex / Claude Code / Trae 使用建议、HermesPet 优先级
- `docs/README.md`
  - 在索引顶部追加本轮记录

## 验证方式

- 已确认 `/Users/lixincheng/.agents/skills/superpowers` 软链接存在。
- 已确认 Superpowers skills 目录包含 `using-superpowers`、`brainstorming`、
  `systematic-debugging`、`writing-plans`、`verification-before-completion` 等入口。
- 当前 Codex session 启动时尚未扫描到新 skill；需要重启 Codex 后生效。

## 已知问题 / 留给下一轮

- Superpowers 是本机安装资产，不会随仓库自动分发；团队成员需要按
  `docs/superpowers-team-workflow.md` 安装。
- Trae 是否原生支持 Superpowers / Agent Skills 取决于当前 Trae 环境；本项目仍以
  `.trae/rules/project.md` 为真理之源。
