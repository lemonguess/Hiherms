import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listMemoryFiles, listProfileDetails, listSkillCategories, readUsageSummary } from '../src/main/hermes/hermes-dashboard-readers.js'

test('dashboard readers list profile details from Hermes home', () => {
  const root = mkdtempSync(join(tmpdir(), 'hermespet-dashboard-'))
  writeFileSync(join(root, 'active_profile'), 'work\n')
  writeFileSync(join(root, 'config.yaml'), 'model: glm-5-turbo\n')
  mkdirSync(join(root, 'profiles', 'work'), { recursive: true })
  writeFileSync(join(root, 'profiles', 'work', 'config.yaml'), 'default: gpt-5.5\n')

  const profiles = listProfileDetails(root, ['default', 'work'])

  assert.equal(profiles.length, 2)
  assert.deepEqual(profiles.map(profile => profile.name), ['default', 'work'])
  assert.equal(profiles[1].active, true)
  assert.equal(profiles[1].defaultModel, 'gpt-5.5')
})

test('dashboard readers summarize memory files for active profile', () => {
  const root = mkdtempSync(join(tmpdir(), 'hermespet-dashboard-'))
  mkdirSync(join(root, 'memories'), { recursive: true })
  writeFileSync(join(root, 'memories', 'MEMORY.md'), '长期记忆内容\n第二行')
  writeFileSync(join(root, 'memories', 'USER.md'), '用户偏好')
  writeFileSync(join(root, 'SOUL.md'), '人格设定')

  const memory = listMemoryFiles(root, 'default')

  assert.equal(memory.length, 3)
  assert.equal(memory[0].section, 'memory')
  assert.equal(memory[0].exists, true)
  assert.equal(memory[0].preview, '长期记忆内容 第二行')
})

test('dashboard readers scan flat and categorized skills', () => {
  const root = mkdtempSync(join(tmpdir(), 'hermespet-dashboard-'))
  mkdirSync(join(root, 'skills', 'writing'), { recursive: true })
  writeFileSync(join(root, 'skills', 'writing', 'SKILL.md'), '---\ndescription: Team writing helper\n---\n# Writing')
  mkdirSync(join(root, 'skills', 'runtime', 'debugging'), { recursive: true })
  writeFileSync(join(root, 'skills', 'runtime', 'debugging', 'SKILL.md'), '# Debugging\nFind root cause first.')

  const categories = listSkillCategories(root, 'default')

  assert.equal(categories.length, 2)
  assert.equal(categories.find(category => category.name === 'misc')?.skills[0]?.name, 'writing')
  assert.equal(categories.find(category => category.name === 'runtime')?.skills[0]?.name, 'debugging')
})

test('dashboard readers return honest local usage summary without token accounting', () => {
  const userData = mkdtempSync(join(tmpdir(), 'hermespet-dashboard-'))
  mkdirSync(join(userData, 'hermespet'), { recursive: true })
  writeFileSync(join(userData, 'hermespet', 'conversations.json'), JSON.stringify({
    conversations: [{ id: 'c1', title: 'hello', createdAt: 1 }],
    messages: [
      { id: 1, conversationId: 'c1', role: 'user', text: 'hi', createdAt: 1 },
      { id: 2, conversationId: 'c1', role: 'hermes', text: 'hello', createdAt: 2 },
    ],
  }))

  const usage = readUsageSummary(userData)

  assert.equal(usage.available, false)
  assert.equal(usage.conversations, 1)
  assert.equal(usage.messages, 2)
  assert.equal(usage.reason.includes('token'), true)
})
