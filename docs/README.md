# docs/ — HermesPet 迭代日志

本目录是项目的 **事实记录**。每一轮 vibe coding（每一次有意义的功能更新）
**必须** 落到一份 `iteration-NNN-<slug>.md`，与代码 **同一次落盘**。

> 真理之源：[../.trae/rules/project.md](../.trae/rules/project.md)
> 工作流导览：[../CLAUDE.md](../CLAUDE.md)

## 索引（最新在顶）

<!-- 新条目追加在本注释下方 -->

- [iteration-013 — hermes-backend-modules-and-outfit-regression](iteration-013-hermes-backend-modules-and-outfit-regression.md) — 修复暗黑服装/腿部透明回归；补 dashboard details IPC 与 profile/skills/memory/plugins/usage 只读后端；tests + typecheck + build + Browser smoke 通过
- [iteration-012 — hermes-web-ui-parity-and-live2d-fixes](iteration-012-hermes-web-ui-parity-and-live2d-fixes.md) — 平滑 Live2D 视线回正 / 暗黑服装 preset / hermes-web-ui 分组导航 + dashboard IPC；tests + typecheck + build + Browser smoke 通过
- [iteration-011 — web-ui-parity-media-and-layout](iteration-011-web-ui-parity-media-and-layout.md) — 对齐 hermes-web-ui：会话左栏常驻 + 图片附件（导入到 ~/HermesPet_Media/）；typecheck + build 通过
- [iteration-010 — hermes-cli-hosting](iteration-010-hermes-cli-hosting.md) — 增加 Hermes CLI 托管面板（profile/gateway 管理），不改现有聊天链路；typecheck + build 通过
- [iteration-009 — hermes-agent-bridge](iteration-009-hermes-agent-bridge.md) — renderer localhost API 改为 Electron main Hermes Agent Bridge；HRP 增量解析 + 可见文本过滤 + AST 持久化；typecheck + build + dev smoke 通过
- [iteration-008 — live2d-regression-fixes](iteration-008-live2d-regression-fixes.md) — 修复暗黑模式衣物消失 / 视线回正未持续生效；改用 internalModel beforeModelUpdate；typecheck + build 通过
- [iteration-007 — known-bugfixes](iteration-007-known-bugfixes.md) — 修复流式渲染 reactivity / 暗黑服装互斥与持久 opacity / 视线回正兜底；typecheck + build 通过，dev 启动成功
- [iteration-006 — superpowers-skill](iteration-006-superpowers-skill.md) — 安装 Superpowers skill / 团队协作说明 / Codex 重启后生效
- [iteration-005 — interaction-panel](iteration-005-interaction-panel.md) — 移除 ready / 右键精简 / 交互模式面板 / 点击穿透（部分）/ 未解决：视线回正、暗黑服装、流式输出
- [iteration-004 — api-and-drag](iteration-004-api-and-drag.md) — 切换 /v1/chat/completions / 流式渲染修复 / 桌宠拖动 / 移除 DevTools 自动打开

- [iteration-003 — ux-polish](iteration-003-ux-polish.md) — 鼠标跟随锚点修复 / 右键菜单独立窗口 / 历史下拉 + 消息持久化 / 操作按钮移至气泡外
- [iteration-002 — chat-and-ui](iteration-002-chat-and-ui.md) — 修复渲染/交互 bug + 独立聊天窗口 + 右键菜单 + 设置/历史页面 + Hermes Agent API 集成
- [iteration-001 — bootstrap](iteration-001-bootstrap.md) — Electron 透明窗 + Live2D 模型渲染 + 基础生命迹象 + 项目骨架
- [iteration-000 — spec-alignment](iteration-000-spec-alignment.md) — 文档对齐 / 资产盘点 / 工作流约定（无代码）

## 写作约定

每份 `iteration-NNN-<slug>.md` 至少包含：

```markdown
# iteration-NNN — <slug>

- **日期**: YYYY-MM-DD
- **范围**: <一句话>

## 动机
为什么要做这件事？要解决什么问题？关联了 project.md 哪一节？

## 改动
- 新增 / 删除 / 修改的文件清单
- 关键决策（库选型、目录结构、协议等）

## 验证方式
- 怎么跑起来？怎么手动验证？跑了哪些自动化？

## 已知问题 / 留给下一轮
- 已知 bug、临时绕过、未实现的需求
```

规则：

- 编号 **单调递增**；不复用、不回填；占用即落盘。
- slug 用 kebab-case 简短描述（如 `bootstrap`、`live2d-render`、`hrp-parser`）。
- 不写无意义的总结句；写的是给下一个接手者的"上下文交接"。
