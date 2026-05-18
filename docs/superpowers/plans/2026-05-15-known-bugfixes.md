# Known Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the current HermesPet user-facing bugs: non-incremental chat streaming, dark outfit switching, and eye reset after pointer leave.

**Architecture:** Keep fixes inside the existing Electron/Vue runtime boundaries. Chat streaming remains in `api/hermes.ts` + `ChatApp.vue`; Live2D interaction remains in `InteractionPanel.vue` + `Live2DStage.vue`.

**Tech Stack:** Electron IPC, Vue 3 reactivity, TypeScript, pixi-live2d-display Cubism4.

---

## Root Cause Summary

- Streaming display mutates the raw `hermesMsg` object captured before Vue proxies it inside `messages.value`; those mutations do not reliably trigger DOM updates.
- Outfit switching keeps `Part28` ("常规服装") visible while enabling `Part20` ("暗黑服装"), so the regular outfit can occlude the dark outfit. One-shot part opacity writes can also be overwritten by the Live2D update loop.
- Eye reset depends on main-process rectangular window polling. The renderer should also reset on canvas `mouseleave` and window `blur` so the model returns to neutral even if IPC leave events are missed.

## Task 1: Chat Streaming Reactivity

**Files:**
- Modify: `src/renderer/src/chat/ChatApp.vue`
- Modify: `src/renderer/src/api/hermes.ts`

- [x] **Step 1: Add a message update helper**

In `ChatApp.vue`, add a helper near `scrollToBottom()` that updates messages by replacing the array member:

```ts
function updateMessage(id: number, updater: (msg: Message) => Message): Message | null {
  const index = messages.value.findIndex(m => m.id === id)
  if (index === -1) return null
  const next = updater(messages.value[index])
  messages.value[index] = next
  return next
}
```

- [x] **Step 2: Use message IDs during streaming**

In `send()`, replace direct `hermesMsg.text += delta` mutations with `updateMessage(hermesMsgId, ...)`. Store final messages using the current array value, not the stale raw object.

- [x] **Step 3: Flush pending SSE buffer on stream close**

In `hermes.ts`, move one-line parsing into a helper and parse the remaining buffer after `reader.read()` returns `done`.

- [x] **Step 4: Verify**

Run: `pnpm typecheck`

Expected: exit code 0.

## Task 2: Live2D Outfit and Eye Reset

**Files:**
- Modify: `src/renderer/src/components/InteractionPanel.vue`
- Modify: `src/renderer/src/components/Live2DStage.vue`

- [x] **Step 1: Make outfit parts mutually exclusive**

In `InteractionPanel.vue`, set dark mode as `Part28=0, Part20=1`; set normal mode as `Part28=1, Part20=0`.

- [x] **Step 2: Persist part opacity overrides**

In `Live2DStage.vue`, keep a `Map<string, number>` of requested part opacity overrides and apply them every Live2D update tick. Initialize `Part28=1` and `Part20=0` after model load.

- [x] **Step 3: Add renderer-side leave fallback**

In `Live2DStage.vue`, add canvas `mouseleave` and window `blur` listeners that call `resetEyes()`, and remove them in cleanup.

- [x] **Step 4: Verify**

Run: `pnpm typecheck`

Expected: exit code 0.

## Task 3: Iteration Documentation

**Files:**
- Create: `docs/iteration-007-known-bugfixes.md`
- Modify: `docs/README.md`

- [x] **Step 1: Record the iteration**

Document motivation, root causes, changed files, verification command output, and remaining manual verification gaps.

- [x] **Step 2: Update the docs index**

Add `iteration-007 — known-bugfixes` above iteration-006.
