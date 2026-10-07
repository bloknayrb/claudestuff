import { describe, expect, test } from 'claude-code/testing'

import { asksQuestion, isFromUser, isGoAhead, stillPendingLine } from '../hooks/prompt'

describe('isGoAhead', () => {
  for (const text of ['make it so', 'Make it so', 'MAKE IT SO!', 'make it so.', '  engage  ', 'Engage!!', 'engage.\n']) {
    test(`accepts ${JSON.stringify(text)}`, () => expect(isGoAhead(text)).toBe(true))
  }
  for (const text of ['make it so, but use SQLite', 'engage the tests', 'please make it so', 'make it so?', 'make  it so', 'ok', '']) {
    test(`refuses ${JSON.stringify(text)}`, () => expect(isGoAhead(text)).toBe(false))
  }
})

describe('isFromUser', () => {
  test('composer and Remote Control are the user', () => {
    expect(isFromUser({ kind: 'composer' })).toBe(true)
    expect(isFromUser({ kind: 'bridge' })).toBe(true)
  })
  for (const kind of ['plugin', 'channel', 'unclassified', 'sdk', 'peer', 'peer-send-message', 'task-notification', 'scheduled-trigger']) {
    test(`${kind} is not`, () => expect(isFromUser({ kind })).toBe(false))
  }
})

describe('asksQuestion', () => {
  test('a prose question mark counts', () => expect(asksQuestion('Shall I push?')).toBe(true))
  test('a full-width question mark counts', () => expect(asksQuestion('push\uff1f')).toBe(true))
  test('none at all', () => expect(asksQuestion('Done. Tests pass.')).toBe(false))
  test('inside inline code it does not', () => expect(asksQuestion('Ran `a?.b` and it passed.')).toBe(false))
  test('inside a fence it does not', () => expect(asksQuestion('Here:\n```ts\nconst x = a ? b : c\n```\nDone.')).toBe(false))
  test('inside a tilde fence it does not', () => expect(asksQuestion('~~~\nwhy?\n~~~\nok')).toBe(false))
  test('in an unclosed fence it does not', () => expect(asksQuestion('```\nwhy?')).toBe(false))
  test('inside a URL it does not', () => expect(asksQuestion('See https://x.test/a?b=1 for it.')).toBe(false))
  test('prose after code still counts', () => expect(asksQuestion('`a?b` passed. Merge it?')).toBe(true))
  // A question that ends in a URL: the URL match stops before trailing punctuation (review, asks.mjs).
  test('a ? right after a URL counts', () => expect(asksQuestion('Shall I merge https://github.com/o/r/pull/7?')).toBe(true))
  test('a ? after a URL ending in a slash counts', () => expect(asksQuestion('Tests pass. Want me to open https://x.test/p?')).toBe(true))
  test('a ? after a bracketed URL counts', () => expect(asksQuestion('Ready to push (see https://x.test/a?b=1)?')).toBe(true))
  test('a full stop after a URL is still no question', () => expect(asksQuestion('Merged https://x.test/a?b=1.')).toBe(false))
})

test('the still-pending note (an appended row, never prompt context)', () => {
  expect(stillPendingLine(3)).toBe('Bridge: decision #3 is still pending; that prompt did not resolve it.')
})
