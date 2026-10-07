import { describe, expect, test } from 'claude-code/testing'

import { findClaims, fnv1a, sentencesOf, stripNonClaims } from '../hooks/claims'

const families = (text: string) => findClaims(text).map(c => (c.op === null ? c.family : `${c.family}:${c.op}`))

describe('claim forms the spec names', () => {
  test('tests', () => {
    for (const text of ['Tests pass.', 'All tests passing.', 'The tests are green.', 'All green.', 'All 42 tests pass.', '42/42 tests pass now.', 'The test suite passes.', 'All 38 doc-claim test files pass (277 tests).']) {
      expect(families(text), text).toEqual(['tests'])
    }
  })

  test('build', () => {
    for (const text of ['It builds cleanly.', 'The plugin compiles.', 'Everything type-checks.', 'The build passes.', 'tsc is clean.', 'It compiles without errors.']) {
      expect(families(text), text).toEqual(['build'])
    }
  })

  test('shipped, first person and present state', () => {
    expect(families('I committed the fix.')).toEqual(['shipped:commit'])
    expect(families("I've pushed the branch.")).toEqual(['shipped:push'])
    expect(families('I merged it.')).toEqual(['shipped:merge'])
    expect(families('Opened PR #18.')).toEqual(['shipped:pr-create'])
    expect(families('I opened a pull request.')).toEqual(['shipped:pr-create'])
    expect(families('PR #17 is now merged.')).toEqual(['shipped:merge'])
    expect(families('The changes are committed.')).toEqual(['shipped:commit'])
    expect(families('I’ve pushed it.'), 'curly apostrophe').toEqual(['shipped:push'])
  })

  test('present state with the other subjects real claims use (re-review)', () => {
    expect(families('Everything is committed.')).toEqual(['shipped:commit'])
    expect(families('The tag is pushed.')).toEqual(['shipped:push'])
    expect(families('Task 3 is committed, and its 17 tests pass.')).toEqual(['tests', 'shipped:commit'])
    expect(families('Round 2 is merged.')).toEqual(['shipped:merge'])
  })

  test('sentence-initial shipped forms (review C9)', () => {
    expect(families('Committed.')).toEqual(['shipped:commit'])
    expect(families('Pushed and verified.')).toEqual(['shipped:push'])
    expect(families('Merged as `e2aa467`.')).toEqual(['shipped:merge'])
    expect(families('- **Merged** into main.')).toEqual(['shipped:merge'])
    expect(families('Committed and pushed.')).toEqual(['shipped:commit', 'shipped:push'])
  })
})

describe('forms that are not claims', () => {
  test('negation, negating quantifiers and not-yet', () => {
    for (const text of [
      "The tests don't pass.",
      'Tests are not yet passing.',
      'Not all green.',
      'The build is not clean.',
      'None of the tests pass.',
      'Nothing is pushed.',
      'Nothing is committed yet.',
      "I've pushed nothing yet.",
    ]) {
      expect(families(text), text).toEqual([])
    }
  })

  test('hedged, conditional, future, imperative and interrogative forms', () => {
    for (const text of [
      'Once the tests pass, I will push.',
      'Make sure all tests pass before merging.',
      'If it compiles, ship it.',
      'The tests should pass now.',
      'I will commit after review.',
      'Run it to confirm the build passes.',
      'Do the tests pass?',
      '**What it builds.**',
    ]) {
      expect(families(text), text).toEqual([])
    }
  })

  test('past-tense recaps, other people and non-git merges', () => {
    for (const text of [
      'PR #17 was merged last week.',
      'That branch was pushed yesterday.',
      'Bryan merged PR #12.',
      'Bryan opened PR #5.',
      'All 12 tests passed in CI last night.',
      'All three rows are merged into the tracker.',
    ]) {
      expect(families(text), text).toEqual([])
    }
  })

  test('descriptions of what a thing does or how a test behaves (review C9)', () => {
    for (const text of ['It builds its own stub.', 'The relaunch test passes even without the epoch check.', 'Both tests pass identically under the mutation.']) {
      expect(families(text), text).toEqual([])
    }
  })

  test('quoted text, code spans, fenced code and blockquotes', () => {
    for (const text of [
      'The commit message says "all tests pass".',
      'Run `npm test` until the tests pass.',
      '```\n$ pytest\n5 tests pass\n```',
      '> Tests pass.',
      'Bryan wrote “I pushed it”.',
    ]) {
      expect(families(text), text).toEqual([])
    }
  })

  test('single-quoted text, apostrophes inside it included (review B10)', () => {
    // The plugin's own manifest description: it would fire whenever the mod is described.
    const description = "Checks end-of-turn claims like 'tests pass', 'builds cleanly' and 'I've pushed' against the tool calls that actually ran."
    expect(families(description)).toEqual([])
    expect(families("Bryan's note says 'the build passes'.")).toEqual([])
  })
})

describe('shape of what is found', () => {
  test('a claim among other sentences keeps the words as written', () => {
    const claims = findClaims('I edited the parser.\n\nAll tests pass, and the build is clean.')

    expect(claims.map(c => [c.family, c.phrase])).toEqual([
      ['tests', 'All tests pass'],
      ['build', 'the build is clean'],
    ])
  })

  test('a present-state shipped phrase names its subject', () => {
    expect(findClaims('PR #17 is now merged.').map(c => c.phrase)).toEqual(['PR #17 is now merged'])
  })

  test('one sentence twice is one claim, with a stable hash', () => {
    const claims = findClaims('Tests pass.\nTests pass.')

    expect(claims).toHaveLength(1)
    expect(claims[0]?.hash).toBe(fnv1a('tests||tests pass'))
  })

  test('fnv1a is FNV-1a 32-bit, hex', () => {
    expect(fnv1a('')).toBe('811c9dc5')
    expect(fnv1a('a')).toBe('e40c292c')
  })

  test('stripping and splitting', () => {
    expect(stripNonClaims('a `b` "c" d')).toBe('a  CODE   QUOTE  d')
    expect(stripNonClaims("say 'tests pass' and I've pushed")).toBe("say  QUOTE  and I've pushed")
    expect(sentencesOf('One. Two!\n\nThree? Four')).toEqual(['One.', 'Two!', 'Three?', 'Four'])
  })
})
