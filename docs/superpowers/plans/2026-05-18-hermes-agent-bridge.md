# Hermes Agent Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace renderer-side localhost API chat with an Electron main-process Hermes Agent Bridge while keeping HermesPet Runtime parsing and filtered chat display.

**Architecture:** Electron main starts a local Python bridge subprocess that imports Hermes Agent and calls `AIAgent.run_conversation()`. Renderer talks to main through preload IPC, receives streamed deltas, parses HRP tags into AST parts, and displays only `TextPart` content.

**Tech Stack:** Electron IPC, Node `child_process`, Node `net`, Python stdlib socket/threading, Hermes Agent `run_agent.py`, Vue 3, TypeScript, Node built-in test runner.

---

### Task 1: HRP Parser And Display Projection

**Files:**
- Modify: `src/renderer/src/runtime/stream-parser.ts`
- Create: `src/renderer/src/runtime/display-text.ts`
- Create: `tests/runtime-stream-parser.test.ts`
- Create: `tests/tsconfig.json`

- [x] **Step 1: Write failing parser tests**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createStreamParser } from '../src/renderer/src/runtime/stream-parser.js'
import { appendVisibleText } from '../src/renderer/src/runtime/display-text.js'

test('parses split HRP tags and keeps only text visible', () => {
  const parser = createStreamParser()
  const parts = [
    ...parser.feed('主人回来啦～<emo'),
    ...parser.feed('tion value="happy" intensity="0.8" /><motion action="wave" />'),
    ...parser.feed('<speech tone="soft" speed="1.2" emotion="happy">辛苦啦～</speech>'),
    ...parser.flush(),
  ]

  assert.deepEqual(parts.map(part => part.kind), ['text', 'emotion', 'motion', 'speech'])
  assert.equal(appendVisibleText('', parts), '主人回来啦～')
  assert.deepEqual(parts[1], { kind: 'emotion', value: 'happy', intensity: 0.8 })
  assert.deepEqual(parts[2], { kind: 'motion', action: 'wave' })
  assert.deepEqual(parts[3], {
    kind: 'speech',
    text: '辛苦啦～',
    tone: 'soft',
    speed: 1.2,
    emotion: 'happy',
  })
})
```

- [x] **Step 2: Run tests and verify they fail**

Run: `pnpm exec tsc -p tests/tsconfig.json && node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js`

Expected: FAIL because `display-text.ts` does not exist and parser stubs emit no parts.

- [x] **Step 3: Implement streaming parser and visible projection**

Implement character-buffer parsing for:

- visible text outside tags;
- self-closing `<emotion />`, `<motion />`, `<media />`, `<tool />`, `<status />`;
- paired `<speech>...</speech>`;
- incomplete tags buffered across chunks.

`appendVisibleText(current, parts)` appends only `TextPart.content`.

- [x] **Step 4: Verify parser tests pass**

Run: `pnpm exec tsc -p tests/tsconfig.json && node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js`

Expected: PASS.

### Task 2: Main-Process Agent Bridge

**Files:**
- Create: `src/main/hermes/hermespet_bridge.py`
- Create: `src/main/hermes/bridge-client.ts`
- Create: `src/main/hermes/bridge-manager.ts`
- Create: `src/main/hermes/bridge-service.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/main/index.ts`

- [x] **Step 1: Write bridge IPC/type test**

Create a Node test that imports shared types after TypeScript compilation and asserts the required IPC channel names are present:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { IPC } from '../src/shared/ipc-channels.js'

test('defines Hermes Agent bridge IPC channels', () => {
  assert.equal(IPC.Agent.Send, 'agent:send')
  assert.equal(IPC.Agent.Abort, 'agent:abort')
  assert.equal(IPC.Agent.Event, 'agent:event')
})
```

- [x] **Step 2: Run test and verify it fails**

Run: `pnpm exec tsc -p tests/tsconfig.json && node --test /private/tmp/hermespet-tests/tests/agent-ipc.test.js`

Expected: FAIL because `IPC.Agent` does not exist.

- [x] **Step 3: Implement bridge service**

Implement:

- Python bridge local socket JSON protocol;
- Node bridge client `request()`, `chat()`, `getOutput()`, `streamOutput()`, `interrupt()`, `shutdown()`;
- Node manager subprocess lifecycle;
- Electron IPC `agent:send`, `agent:abort`, `agent:event`;
- default HermesPet system instructions prepended to runs.

- [x] **Step 4: Verify bridge compile checks pass**

Run:

```bash
python3 -m py_compile src/main/hermes/hermespet_bridge.py
pnpm typecheck:node
```

Expected: both pass.

### Task 3: Renderer Integration

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Modify: `src/renderer/src/api/hermes.ts`
- Modify: `src/renderer/src/chat/ChatApp.vue`
- Modify: `src/main/store.ts`

- [x] **Step 1: Write display/store test**

Extend the parser test to assert assistant stored metadata contains AST while visible text remains filtered.

- [x] **Step 2: Run test and verify it fails**

Run: `pnpm exec tsc -p tests/tsconfig.json && node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js`

Expected: FAIL until `display-text.ts` and AST handling exist.

- [x] **Step 3: Replace renderer fetch API with IPC adapter**

Keep `sendMessage()` as the ChatApp-facing API, but route it through `window.hermes.agent.send()`. Parse deltas with `createStreamParser()`, append only `TextPart`, collect AST parts, and store assistant visible text plus AST metadata.

- [x] **Step 4: Verify renderer typecheck**

Run: `pnpm typecheck:web`

Expected: PASS.

### Task 4: Docs And Full Verification

**Files:**
- Create: `docs/iteration-009-hermes-agent-bridge.md`
- Modify: `docs/README.md`

- [x] **Step 1: Write iteration log**

Document motivation, code changes, verification, and known limitations.

- [x] **Step 2: Run all verification**

Run:

```bash
pnpm exec tsc -p tests/tsconfig.json
node --test /private/tmp/hermespet-tests/tests/runtime-stream-parser.test.js /private/tmp/hermespet-tests/tests/agent-ipc.test.js
python3 -m py_compile src/main/hermes/hermespet_bridge.py
pnpm typecheck
pnpm build
```

Expected: all pass.

- [x] **Step 3: Commit**

```bash
git add .
git commit -m "feat: bridge Hermes Agent through Electron main"
```
