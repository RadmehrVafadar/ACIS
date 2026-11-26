import test from 'node:test'
import assert from 'node:assert/strict'
import { unread } from './queue.mjs'

test('returns unread articles in original order', () => {
  const items = [{id: 1, read: false}, {id: 2, read: true}, {id: 3, read: false}]
  assert.deepEqual(unread(items).map(item => item.id), [1, 3])
})
