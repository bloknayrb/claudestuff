import { describe, expect, test } from 'claude-code/testing'

import { denialFor, INPUT_SCHEMA, isSubagentCall, receipt, SUBAGENT_DENIAL, TOOL_DESCRIPTION, validateDecide } from '../hooks/decide'
import { SAMPLE } from './world'

describe('validateDecide', () => {
  test('accepts the sample and keeps only known option fields', () => {
    const checked = validateDecide({ ...SAMPLE, options: [{ label: 'A', detail: 'd', extra: 1 }, { label: 'B' }], extra: true })
    expect(checked).toEqual({
      isValid: true,
      input: { ...SAMPLE, options: [{ label: 'A', detail: 'd' }, { label: 'B' }] },
    })
  })

  test('stores labels trimmed', () => {
    const checked = validateDecide({ ...SAMPLE, options: [{ label: '  A ' }, { label: 'B\n' }] })
    expect(checked.isValid).toBe(true)
    if (checked.isValid) expect(checked.input.options.map(o => o.label)).toEqual(['A', 'B'])
  })

  test('accepts every field at its cap', () => {
    const checked = validateDecide({
      ...SAMPLE,
      question: 'q'.repeat(500),
      context: 'c'.repeat(4000),
      why: 'w'.repeat(1000),
      why_yours: 'y'.repeat(1000),
      options: [{ label: 'a'.repeat(120) }, { label: 'b' }],
    })
    expect(checked.isValid).toBe(true)
  })

  const cases: [string,Record<string, unknown>, string][] = [
    ['missing why_yours', { ...SAMPLE, why_yours: undefined }, 'why_yours'],
    ['blank why_yours', { ...SAMPLE, why_yours: '   ' }, 'why_yours'],
    ['missing context', { ...SAMPLE, context: undefined }, 'context'],
    ['one option', { ...SAMPLE, options: [{ label: 'A' }] }, 'options'],
    ['five options', { ...SAMPLE, options: ['a', 'b', 'c', 'd', 'e'].map(label => ({ label })) }, 'options'],
    ['a blank label', { ...SAMPLE, options: [{ label: 'A' }, { label: ' ' }] }, 'options[1].label'],
    ['a non-string detail', { ...SAMPLE, options: [{ label: 'A', detail: 3 }, { label: 'B' }] }, 'options[0].detail'],
    ['duplicate labels', { ...SAMPLE, options: [{ label: 'A' }, { label: 'A' }] }, 'differ'],
    ['recommend 1-based past the end', { ...SAMPLE, recommend: 2 }, 'recommend must be 0 to 1'],
    ['a question over 500 characters', { ...SAMPLE, question: 'q'.repeat(501) }, 'question is 501 characters; the limit is 500'],
    ['a context over 4000 characters', { ...SAMPLE, context: 'c'.repeat(4001) }, 'context is 4001'],
    ['a why over 1000 characters', { ...SAMPLE, why: 'w'.repeat(1001) }, 'why is 1001'],
    ['a why_yours over 1000 characters', { ...SAMPLE, why_yours: 'y'.repeat(1001) }, 'why_yours is 1001'],
    ['a label over 120 characters', { ...SAMPLE, options: [{ label: 'a'.repeat(121) }, { label: 'B' }] }, 'options[0].label is 121'],
    ['labels that differ only by padding', { ...SAMPLE, options: [{ label: 'A' }, { label: ' A ' }] }, 'differ'],
    ['recommend negative', { ...SAMPLE, recommend: -1 }, 'recommend'],
    ['recommend fractional', { ...SAMPLE, recommend: 0.5 }, 'recommend'],
    ['recommend as a string', { ...SAMPLE, recommend: '0' }, 'recommend'],
  ]
  for (const [name, raw, needle] of cases) {
    test(`refuses ${name}`, () => {
      const checked = validateDecide(raw)
      expect(checked.isValid).toBe(false)
      if (!checked.isValid) expect(checked.problems.join('; ')).toContain(needle)
    })
  }
})

describe('the rest of the tool surface', () => {
  test('denialFor names every problem and says how to proceed', () => {
    const text = denialFor(['why_yours must be a non-empty string', 'options must be an array of 2 to 4 items'])
    expect(text).toContain('why_yours')
    expect(text).toContain('options')
    expect(text).toContain('call again')
  })

  test('the receipt text is exact', () => {
    expect(receipt(3)).toBe("Logged as decision #3. Keep going on what doesn't depend on it; the answer arrives as a message.")
  })

  test('a call with an agentId is a subagent call', () => {
    expect(isSubagentCall({ agentId: 'a1' })).toBe(true)
    expect(isSubagentCall({})).toBe(false)
  })

  test('the subagent denial says only the main loop can queue decisions', () => {
    expect(SUBAGENT_DENIAL).toContain('only the main loop can queue decisions')
  })

  test('the description fits the 2,048 characters the model is sent and names the rules', () => {
    expect(TOOL_DESCRIPTION.length).toBeLessThanOrEqual(2048)
    expect(TOOL_DESCRIPTION).toContain('AskUserQuestion')
    expect(TOOL_DESCRIPTION).toContain('Procedural calls are yours')
    expect(TOOL_DESCRIPTION).toContain('why_yours')
  })

  test('the tool schema requires every field', () => {
    expect(INPUT_SCHEMA.required).toEqual(['question', 'context', 'options', 'recommend', 'why', 'why_yours'])
  })
})
