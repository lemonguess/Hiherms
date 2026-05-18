# iteration-008 — live2d-regression-fixes

- **日期**: 2026-05-15
- **范围**: 修复 iteration-007 引入的 Live2D 暗黑服装与视线回正回归

## 动机

iteration-007 后用户反馈两个问题：

1. 暗黑模式下人物衣物直接不见。
2. 鼠标离开画布后视线回正仍未生效。

本轮继续按 Superpowers `systematic-debugging` 处理：先查 Live2D update pipeline 与模型
part 结构，再做最小修复。

## 根因

### 1. 暗黑服装

iteration-007 把 `Part28=常规服装` 与 `Part20=暗黑服装` 当成完全互斥的两套完整衣物，
切暗黑时将 `Part28` 设为 0。

实际表现说明这个判断不成立：`Part20` 更像暗黑服装 layer / subtree，不是可独立替换
常服底层的完整角色服装。隐藏 `Part28` 会让基础衣物消失。

另外，`tuzi mian.cdi3.json` 显示 `Part20` 下存在 `Part30/36/39/40/...` 等暗黑服装子
parts。只设置父 part opacity 不够稳妥，需要对 root part 的真实 Cubism 子树应用 opacity。

### 2. 视线回正

上一轮将持久应用逻辑挂在 `model.on('beforeUpdate')`。但 `pixi-live2d-display` 的 Cubism4
运行时实际在 `model.internalModel` 上触发 `beforeModelUpdate`，不是 `Live2DModel` 的
`beforeUpdate`。

因此上一轮的“每帧持久应用 opacity / reset”没有挂到正确事件上。鼠标离开时单次写 0
也会在后续帧被 focus / idle / physics 等更新覆盖。

## 改动

- `src/renderer/src/components/InteractionPanel.vue`
  - 暗黑模式改为保留 `Part28=1`，只切换 `Part20=1/0`。
- `src/renderer/src/components/Live2DStage.vue`
  - 增加 `partSubtreeCache`，通过 `core.getModel().parts.parentPartIndices` 收集 root part
    子树。
  - `setPartOpacity()` 改为对子树所有 part index 应用 opacity。
  - 将每帧 runtime override 从 `model.beforeUpdate` 改到
    `model.internalModel.beforeModelUpdate`。
  - 将视线控制改成 `lookTarget` 状态：鼠标移动只更新目标，离开画布 / 窗口 blur /
    main process `MouseLeave` 将目标归零。
  - 每帧在 `beforeModelUpdate` 按 `lookTarget` 覆盖 `ParamAngleX/Y` 与
    `ParamEyeBallX/Y`，确保离开后持续保持 neutral。
- `src/renderer/src/live2d/tuzi-driver.ts`
  - idle / poke driver 从不存在的 `model.beforeUpdate` 改为
    `model.internalModel.beforeModelUpdate`。

## 验证方式

- `pnpm typecheck`
  - 结果：exit 0
  - 覆盖：Node TS + Vue TS 类型检查。
- `pnpm build`
  - 结果：exit 0
  - 覆盖：Electron main/preload/renderer 生产构建。
- `pnpm dev`
  - 结果：Electron dev server 启动成功，随后已停止。
  - 覆盖：`model.internalModel.beforeModelUpdate` hook 没有运行时报错。
  - 观察到服装 IPC 已改为：
    - `[Main] SetPartOpacity Part28 1`
    - `[Main] SetPartOpacity Part20 1`
    - `[Main] SetPartOpacity Part28 1`
    - `[Main] SetPartOpacity Part20 0`

## 已知问题 / 留给下一轮

- 本轮完成启动级验证，没有截图级视觉验证；需要用户确认暗黑 layer 是否正常覆盖常服、
  离开画布后视线是否回到正中。
- 如果暗黑 layer 仍不明显，下一步应在 pet renderer 端输出 `Part20` 子树 ids / opacity，
  或直接做一个 Live2D part inspector 面板，而不是继续猜 part 名称。
- 点击穿透仍是 iteration-005 记录的部分生效状态。
