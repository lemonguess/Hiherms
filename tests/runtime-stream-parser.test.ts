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

test('flush emits unterminated non-tag text without showing protocol syntax', () => {
  const parser = createStreamParser()
  const parts = [
    ...parser.feed('主消息<status state="thinking" detail="检索中" />'),
    ...parser.feed('后续'),
    ...parser.flush(),
  ]

  assert.deepEqual(parts.map(part => part.kind), ['text', 'status', 'text'])
  assert.equal(appendVisibleText('', parts), '主消息后续')
})
