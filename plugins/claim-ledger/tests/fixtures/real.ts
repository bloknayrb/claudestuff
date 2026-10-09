/**
 * Sentences shaped on real answers, labeled blind against written definitions, with paths, repository,
 * branch and people names, numbers, shas and project vocabulary replaced. `expect` uses the claims test's families() notation.
 */
export const REAL: readonly { text: string; expect: string[]; why: string }[] = [
  // CLAIM
  { text: 'All 76 tests pass.', expect: ['tests'], why: 'CLAIM: end-of-task test count' },
  { text: 'Committed (27 files).', expect: ['shipped:commit'], why: 'CLAIM: sentence-initial ship verb' },
  { text: 'Typecheck is clean; the linter only wants formatting on the new test file.', expect: ['build'], why: 'CLAIM: build, with a lint note' },
  { text: 'Acceptance tests pass (84, 1 skipped), and typecheck is clean.', expect: ['tests', 'build'], why: 'CLAIM: two families in one sentence' },
  { text: 'PR #12 is merged into main as `1a2b3c4`, and your local main is up to date.', expect: ['shipped:merge'], why: 'CLAIM: present state with a git noun' },
  { text: 'Pushed clean, pre-push hook green.', expect: ['shipped:push'], why: 'CLAIM: sentence-initial push' },
  { text: 'The tag is pushed.', expect: ['shipped:push'], why: 'CLAIM: present state, the tag' },
  { text: 'Task 5, the parser, is committed: 18 tests pass, and the code is byte-for-byte what the plan specifies.', expect: ['tests', 'shipped:commit'], why: 'CLAIM: task subject with an appositive' },
  { text: 'Unit and integration tests are green (64 passing); now adding one missing edge case.', expect: ['tests'], why: 'CLAIM: tests are green' },
  // Recall: any subject before "is committed", and "Unit N" as a git noun.
  { text: 'The helper scripts are committed on the spike branch, which stays local only.', expect: ['shipped:commit'], why: 'CLAIM: "committed" with a subject outside the git nouns' },
  { text: 'The parser fixes are committed.', expect: ['shipped:commit'], why: 'CLAIM: present state' },
  { text: '**Unit 3b is merged** (#12) with every required check green.', expect: ['shipped:merge'], why: 'CLAIM: "Unit N" subject' },
  // NOT-CLAIM
  { text: 'Every obvious negative test passes against that mutation.', expect: [], why: 'NOT-CLAIM: describes a test under a mutation' },
  { text: 'Committing the notes, then the final branch review runs before anything is pushed.', expect: [], why: 'NOT-CLAIM: describes a process; the hedge sits between subject and verb' },
  { text: 'Nothing is committed yet; the docs are staged on `docs/example`.', expect: [], why: 'NOT-CLAIM: negation' },
  { text: 'Neither change is pushed yet.', expect: [], why: 'NOT-CLAIM: negation' },
  { text: 'A reviewer is now checking the table before anything is committed.', expect: [], why: 'NOT-CLAIM: future, conditional' },
  { text: 'Once your `settings.json` edit is committed or stashed, switch to `main`.', expect: [], why: 'NOT-CLAIM: conditional instruction' },
  { text: 'Nothing is pushed or merged yet.', expect: [], why: 'NOT-CLAIM: negation' },
  { text: 'Merging if checks pass:', expect: [], why: 'NOT-CLAIM: conditional' },
  { text: 'Now verifying the revised code actually passes its own tests (the reviewer proved the first draft did; the revision must too).', expect: [], why: 'NOT-CLAIM: in progress' },
  { text: 'Those numbers were correct when the PR was opened.', expect: [], why: 'NOT-CLAIM: a recap, conditional on when' },
]

/** A real Bash toolUseResult for a commit, redacted (sha, branch and output replaced); the shape is as recorded. */
export const REAL_GIT_RESULT: unknown = {
  stdout: '[feat/example 1a2b3c4] feat: add a thing\n 4 files changed, 120 insertions(+), 3 deletions(-)',
  stderr: "warning: in the working copy of 'src/a.ts', LF will be replaced by CRLF the next time Git touches it",
  interrupted: false,
  isImage: false,
  noOutputExpected: false,
  gitOperation: { commit: { sha: '1a2b3c4', kind: 'committed', branch: 'feat/example' } },
}
