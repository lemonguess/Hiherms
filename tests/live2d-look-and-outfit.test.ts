import test from 'node:test'
import assert from 'node:assert/strict'
import { createLookState, relaxLookTarget, setLookTargetFromNormalizedPointer, stepLookState } from '../src/renderer/src/live2d/look-controller.js'
import { getOutfitPreset } from '../src/renderer/src/live2d/outfit-presets.js'

test('look controller eases toward neutral instead of snapping', () => {
  const state = createLookState()
  setLookTargetFromNormalizedPointer(state, 1, -0.5)
  stepLookState(state, 1)

  assert.equal(state.current.angleX, 30)
  assert.equal(state.current.angleY, 15)

  relaxLookTarget(state)
  stepLookState(state, 0.2)

  assert.ok(state.current.angleX > 0)
  assert.ok(state.current.angleX < 30)
  assert.ok(state.current.eyeX > 0)
  assert.ok(state.current.eyeX < 1)
})

test('dark outfit preset switches visible dark parts and clothing parameters', () => {
  const dark = getOutfitPreset('dark')
  const normal = getOutfitPreset('normal')

  assert.equal(dark.parts.Part20, 1)
  assert.equal(dark.parts.Part28, 1)
  assert.equal(normal.parts.Part20, 0)
  assert.equal(normal.parts.Part28, 1)

  assert.equal(Object.hasOwn(dark.parts, 'Part39'), false)
  assert.equal(Object.hasOwn(normal.parts, 'Part39'), false)
  assert.deepEqual(dark.params, {})
  assert.deepEqual(normal.params, {})
})
