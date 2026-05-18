# Superpowers Team Workflow

本项目使用 Superpowers 作为可选协作增强：它不替代 HermesPet 规范，只提供更结构化的
brainstorming、debugging、planning、verification、code review 工作流。

## 当前本机安装状态

- Superpowers repo: `/Users/lixincheng/.codex/superpowers`
- Codex skill entry: `/Users/lixincheng/.agents/skills/superpowers`
- 入口 skill: `using-superpowers`

Codex 在启动时扫描 skills；本次安装后需要重启 Codex 才会自动发现。

## 团队安装方式

### Codex

优先用 Codex App / CLI 的插件市场安装 `Superpowers`。如果插件市场不可用，可手动安装：

```bash
git clone https://github.com/obra/superpowers.git ~/.codex/superpowers
mkdir -p ~/.agents/skills
ln -s ~/.codex/superpowers/skills ~/.agents/skills/superpowers
```

安装后重启 Codex。

### Claude Code

优先用官方插件市场：

```bash
/plugin install superpowers@claude-plugins-official
```

如果团队使用 Superpowers marketplace：

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

### Trae

Trae 仍以 `.trae/rules/project.md` 为真理之源。若当前 Trae 环境支持 Agent Skills /
`SKILL.md` 目录扫描，可指向 `~/.codex/superpowers/skills` 或按 Trae 的插件机制安装
Superpowers；如果不支持，则至少遵循本文件的推荐流程标签和项目迭代日志规则。

## 在 HermesPet 中怎么用

Superpowers 只管“怎么协作”，不改变项目架构。

- 新功能：`brainstorming` -> `writing-plans` -> 实现 -> `verification-before-completion`
- Bug：`systematic-debugging` -> 最小修复 -> 验证 -> 迭代日志
- 大改动：先写计划文档，再实现；必要时做 `requesting-code-review`
- 收尾：更新 `docs/iteration-NNN-*.md` 和 `docs/README.md`

## HermesPet 优先级

这些规则高于 Superpowers：

- 不开发多 Provider 抽象；只对接本地 Hermes Gateway。
- 不 fork / 不修改 Hermes。
- Streaming First：SSE -> buffer -> state machine -> AST。
- Message 使用 `MessagePart` AST，不退化成字符串消息。
- Live2D emotion / motion 必须走 runtime 映射，不直接调用抽象字符串。
- CosyVoice 当前只保留占位，不实现 HTTP 调用。
- 媒体路径必须限制在 `~/HermesPet_Media/`。

## 交接约定

如果 Claude Code、Trae 或其他同事接手：

1. 先读 `.trae/rules/project.md`、`AGENTS.md`、`docs/README.md`。
2. 再按各自工具加载 Superpowers。
3. 所有决策和已知问题写进 `docs/iteration-NNN-*.md`，不要只留在聊天记录里。
4. 若 Superpowers 建议的流程和 HermesPet 红线冲突，记录冲突并遵循 HermesPet 规范。
