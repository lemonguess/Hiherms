import test from 'node:test'
import assert from 'node:assert/strict'
import { IPC } from '../src/shared/ipc-channels.js'

test('defines Hermes Agent bridge IPC channels', () => {
  assert.equal(IPC.Agent.Send, 'agent:send')
  assert.equal(IPC.Agent.Abort, 'agent:abort')
  assert.equal(IPC.Agent.Event, 'agent:event')
})

test('defines Hermes dashboard IPC channels', () => {
  assert.equal(IPC.HermesDashboard.Summary, 'hermes-dashboard:summary')
  assert.equal(IPC.HermesDashboard.Models, 'hermes-dashboard:models')
  assert.equal(IPC.HermesDashboard.Logs, 'hermes-dashboard:logs')
  assert.equal((IPC.HermesDashboard as Record<string, string>).Details, 'hermes-dashboard:details')
})
