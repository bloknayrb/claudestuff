/** A claim family the detector knows. */
export type Family = 'tests' | 'build' | 'shipped'

/** The git operation a shipped claim names. */
export type ShipOp = 'commit' | 'push' | 'merge' | 'pr-create'

/** What a run is evidence for: tests, build, or one shipped op. */
export type Kind = 'tests' | 'build' | ShipOp

/** How a claim stands against the ledger. */
export type Status = 'backed' | 'none' | 'failed' | 'masked' | 'background'

/** One claim found in my text: its family, op (shipped only), the words as written, and a stable hash. */
export type Claim = {
  family: Family
  op: ShipOp | null
  phrase: string
  hash: string
}

/** How a run's outcome was read: its exit status, an echo of that status, its visible output, the result's gitOperation, or not at all (weak). */
export type Basis = 'exit' | 'echo' | 'output' | 'gitOperation' | 'none'

/** One evidence-bearing run, recorded when it completed. `seq`: order at hook entry. `done`: order of completion. */
export type Entry = {
  seq: number
  done: number
  ts: number
  agentId: string | null
  toolUseId: string | null
  tool: string
  short: string
  kind: Kind
  ok: boolean
  background: boolean
  masked: boolean
  basis: Basis
}

/** A successful code edit. `path` is normalized (pathKey). A Bash command's own edits sit half a step before its runs. */
export type Mutation = { seq: number; ts: number; path: string }

/** What the ledger knew when a step began (decision 5). */
export type AsOf = { done: number; lastMutation: Mutation | null }

/** A flagged tests or build claim not yet backed. `edit`: the last edit's seq when it was flagged. */
export type Pending = { hash: string; family: Family; op: ShipOp | null; ts: number; edit: number }

/** The session's ledger: module-authoritative, mirrored to $.state. */
export type Ledger = {
  seq: number
  done: number
  calls: number
  /** The shipped window opens after this seq: the seq when the previous answered main turn completed (decision 6). */
  turnFrom: number
  /** The newest of `edits`; null when there are none. */
  lastMutation: Mutation | null
  /** Recent code edits, one per path, oldest first (capped): a commit-message file handed to git later is taken back out. */
  edits: Mutation[]
  entries: Entry[]
  /** The latest strong entry of each shipped op, kept past the entry cap. */
  ships: Partial<Record<ShipOp, Entry>>
  flagged: string[]
  flaggedEvidence: string[]
  pending: Pending[]
  backed: Pending[]
  steps: { turnId: string; candidates: Claim[]; backed: Claim[] } | null
}

export type Counter = { fires: number; laterBacked: number; repeated: number }
export type Counters = Record<Family, Counter>

/** One entry of the 200-entry fire ring in $.store. */
export type Fire = { ts: number; guard: Family; input_hash: string; outcome: Status; laterBacked?: true }

declare module 'claude-code' {
  interface PluginState {
    'claim-ledger': { ledger: Ledger }
  }
}
