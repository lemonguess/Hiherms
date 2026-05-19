# Hermes Backend Modules And Outfit Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the tuzi_mian outfit regression and turn the new Hermes module navigation into real read-only backend-backed panels.

**Architecture:** Keep HermesPet's Electron IPC boundary. Live2D outfit switching stays in `outfit-presets.ts` plus the existing pet IPC path. Hermes module data is collected by `HermesDashboardService`, exposed through preload, and rendered by `ChatApp.vue`; renderer never reads Hermes files directly.

**Tech Stack:** Electron IPC, Vue 3, TypeScript, Node built-in tests, Live2D Cubism parts, Node fs/path APIs, Hermes CLI.

---

### Task 1: Live2D Outfit Regression

**Files:**
- Modify: `src/renderer/src/live2d/outfit-presets.ts`
- Test: `tests/live2d-look-and-outfit.test.ts`

- [ ] **Step 1: Write failing test**

Add assertions that dark outfit keeps the base clothing layer and never controls the leg part directly:

```ts
assert.equal(dark.parts.Part28, 1)
assert.equal(dark.parts.Part20, 1)
assert.equal(normal.parts.Part28, 1)
assert.equal(normal.parts.Part20, 0)
assert.equal(Object.hasOwn(dark.parts, 'Part39'), false)
assert.equal(Object.hasOwn(normal.parts, 'Part39'), false)
assert.deepEqual(dark.params, {})
assert.deepEqual(normal.params, {})
```

- [ ] **Step 2: Verify red**

Run: `pnpm exec tsc -p tests/tsconfig.json`

Expected: PASS compile, then run `node --test /private/tmp/hermespet-tests/tests/live2d-look-and-outfit.test.js` and see assertion failure because the current preset sets `Part28=0`, includes `Part39`, and sets clothing params.

- [ ] **Step 3: Implement minimal fix**

Change `outfit-presets.ts` to only expose:

```ts
normal.parts = { Part28: 1, Part20: 0 }
dark.parts = { Part28: 1, Part20: 1 }
normal.params = {}
dark.params = {}
```

- [ ] **Step 4: Verify green**

Run the compile and targeted Node test again. Expected: PASS.

### Task 2: Dashboard Details Backend Contract

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/main/hermes/hermes-dashboard-service.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Test: `tests/agent-ipc.test.ts`

- [ ] **Step 1: Write failing contract test**

Add assertions for a new IPC channel:

```ts
assert.equal(IPC.HermesDashboard.Details, 'hermes-dashboard:details')
```

- [ ] **Step 2: Verify red**

Run: `pnpm exec tsc -p tests/tsconfig.json`

Expected: TypeScript or Node test fails because `Details` is not defined.

- [ ] **Step 3: Add shared types**

Add read-only detail interfaces for profiles, memory files, skill categories, usage summary, gateway rows, and a `HermesDashboardDetails` aggregate. Keep fields primitive and serializable.

- [ ] **Step 4: Implement service readers**

In `HermesDashboardService`, add helpers that mirror hermes-web-ui controller boundaries:

- profiles: scan root profile plus `profiles/*`
- memory: read `memories/MEMORY.md`, `memories/USER.md`, `SOUL.md`
- skills: scan two-level and three-level `skills/**/SKILL.md`
- usage: return an honest local summary placeholder with source and reason
- gateways: return active profile status and profile rows when CLI is available

- [ ] **Step 5: Expose preload contract**

Expose `window.hermes.dashboard.details()` and update renderer env typings.

- [ ] **Step 6: Verify contract**

Run compile and `tests/agent-ipc.test.ts`. Expected: PASS.

### Task 3: Render Backend-Backed Module Panels

**Files:**
- Modify: `src/renderer/src/chat/ChatApp.vue`

- [ ] **Step 1: Add details state**

Add `dashboardDetails`, load it with summary, and refresh both on module refresh.

- [ ] **Step 2: Replace placeholder panels**

Render actual data for `profiles`, `skills`, `memory`, `usage`, and `skillsUsage`. Keep unimplemented modules honest but specific.

- [ ] **Step 3: Keep gateway/settings behavior intact**

Do not remove existing gateway start/stop/restart controls. Gateway module should use the same CLI service state as settings.

### Task 4: Docs And Verification

**Files:**
- Create: `docs/iteration-013-hermes-backend-modules-and-outfit-regression.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Write iteration log**

Document root cause, backend module scope, files changed, verification commands, and remaining gaps.

- [ ] **Step 2: Run verification**

Run:

```bash
pnpm exec tsc -p tests/tsconfig.json
node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js /private/tmp/hermespet-tests/tests/agent-ipc.test.js /private/tmp/hermespet-tests/tests/live2d-look-and-outfit.test.js
pnpm typecheck
pnpm build
git diff --check
```

- [ ] **Step 3: Commit**

Stage relevant source, tests, and docs. Commit with:

```bash
git commit -m "fix: stabilize outfit switching and dashboard modules"
```
