// Docket's state contract. One value, docket.session, kept for the session ($.state survives a hot
// reload; /clear and /resume reset it).

export type ItemKind = 'decide' | 'do'
export type ItemStatus = 'open' | 'resolved' | 'dismissed'
// you: the user's words decided or did it. claude: Claude's text or tool lines showed it done or moot.
// dismiss: a digit key or button. clear: /docket clear (a batch).
export type ClosedBy = 'you' | 'claude' | 'dismiss' | 'clear'

export type Item = {
  id: number
  kind: ItemKind
  text: string
  // Claude's words the item came from ('' for one added by hand).
  quote: string
  // Claude offered one recommended option and asked only for a go-ahead.
  singleRec: boolean
  source: 'judge' | 'manual'
  openedTurn: number
  status: ItemStatus
  by?: ClosedBy
  note?: string
  closedAt?: number
  // Order of closes, so "Recently closed" can sort and prune. A clear batch shares one value.
  closeSeq?: number
  // Set by /docket clear: every item of one clear shares it.
  batch?: number
  // Stamped on Reopen, so the evidence that closed the item cannot close it again.
  reopenedAtSeq?: number
  reopenedAtTurn?: number
}

// One thing the user typed: a prompt, or a `!` shell command (text starts with '!').
export type UserEntry = { seq: number; text: string; afterTurn: number }
// One assistant message's text, or one tool line, tagged with the main turn it came from.
export type ClaudeEntry = { turn: number; text: string; isFinal: boolean }
export type ToolLine = { turn: number; text: string }

export type LastCheck = {
  ok: boolean
  at: number
  reason: string
  streak: number
  checkedTurns: number
}

export type ViewState = {
  // Docket's pane is open: drives the band button's "click to show/hide".
  isPaneUp: boolean
  // After any change to the list, digit keys ignore presses until this time (a debounce).
  keysPausedUntil: number | null
  showAllClosed: boolean
  // The item whose button holds the pane's focus ring: its Claude quote is shown.
  focusedId: number | null
}

export type DocketSession = {
  items: Item[]
  nextId: number
  // Main turns ended so far this session.
  turn: number
  nextSeq: number
  nextCloseSeq: number
  nextBatch: number
  pendingUser: UserEntry[]
  claude: ClaudeEntry[]
  tools: ToolLine[]
  // Questions already asked through AskUserQuestion or Bridge's decide tool: never listed.
  toolAsked: string[]
  // Claude's last final message, kept after a full check consumes the rest: a resolve-only check
  // shows it to the judge so a numbered or short reply can be read.
  lastFinal: string
  lastCheck: LastCheck
  view: ViewState
}

declare module 'claude-code' {
  interface PluginState {
    docket: { session: DocketSession }
  }
}
