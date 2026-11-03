import { expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'

import { MESSAGES_CAP, turnSlice } from '../hooks/capture'

const user = (text: string): SessionMessage => ({ role: 'user', text, toolUses: [] })
const claude = (text: string): SessionMessage => ({ role: 'assistant', text, toolUses: [] })

test('the opening prompt finds the turn past the 4096 cap, through rows other mods append', async () => {
  const older = Array.from({ length: MESSAGES_CAP - 5 }, (_, i) => (i % 2 === 0 ? user(`old ${i}`) : claude(`old ${i}`)))
  const turn = [user('please refactor'), claude('First, should I delete the old branch?'), user('Bridge decision: {"id":1}'), claude('Done.')]
  const msgs = [...older, ...turn].slice(-MESSAGES_CAP)
  // Under the cap the count would work; at the cap only the opener can find the turn.
  const slice = turnSlice(msgs, MESSAGES_CAP, new Set(), 'please refactor')
  expect(slice.map(m => m.text)).toEqual(['First, should I delete the old branch?', 'Bridge decision: {"id":1}', 'Done.'])
})

test('the opener matches a user row that carries extra blocks after the prompt', async () => {
  const msgs = [user('earlier'), claude('x'), user('please refactor\n<system-reminder>ctx</system-reminder>'), claude('Should I delete it?')]
  expect(turnSlice(msgs, undefined, new Set(), 'please refactor').map(m => m.text)).toEqual(['Should I delete it?'])
})

test('with no opener the count taken at turn.start slices the turn', async () => {
  const msgs = [user('a'), claude('b'), user('c'), claude('d')]
  expect(turnSlice(msgs, 3, new Set()).map(m => m.text)).toEqual(['d'])
})

test('past the cap with no opener, the walk back skips shell rows and mid-turn prompts', async () => {
  const msgs = [user('start'), claude('one'), user('<bash-input>ls</bash-input>'), user('typed mid-turn'), claude('two')]
  expect(turnSlice(msgs, undefined, new Set(['typed mid-turn'])).map(m => m.text)).toEqual(['one', '<bash-input>ls</bash-input>', 'typed mid-turn', 'two'])
})
