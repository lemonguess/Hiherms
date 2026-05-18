import test from 'node:test'
import assert from 'node:assert/strict'
import { IPC } from '../src/shared/ipc-channels.js'

test('defines Hermes Agent bridge IPC channels', () => {
  assert.equal(IPC.Agent.Send, 'agent:send')
  assert.equal(IPC.Agent.Abort, 'agent:abort')
  assert.equal(IPC.Agent.Event, 'agent:event')
})
