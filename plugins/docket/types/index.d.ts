// Docket's state contract. docket.session is the current conversation's docket ($.state survives a
// hot reload; a /clear or /resume replaces it, after it is saved to disk). docket.proc and
// docket.writer are process-scoped bookkeeping a switch never replaces.

export type ItemKind = 'decide' | 'do'
export type ItemStatus = 'open' | 'resolved' | 'dismissed'
// you: the user's words decided or did it. claude: Claude's text or tool lines showed it done or moot.
// dismiss: a digit key or button. clear: /docket clear (a batch).
// claude-tool (v0.6): Claude closed it through the close tool, on purpose, with a kind and a reason.
export type ClosedBy = 'you' | 'claude' | 'dismiss' | 'clear' | 'claude-tool'

// What the user said when a reply of theirs closed an item (v0.6): their words as typed (the Reply lead
// stripped), and, for an option pick, the option code read by their key. linked: Claude's amend tied
// these words to the item; they are not the reply that first closed it. seq: that reply's.
export type Answer = { words: string; option?: { key: string; label: string }; linked?: true; seq?: number }
export type CloseKind = 'duplicate' | 'settled-earlier' | 'user-asked' | 'done-by-claude' | 'stale'
// Why Claude closed an item with the close tool. dupOf for a duplicate; cite: the #id or the user's words.
export type Closure = { kind: CloseKind; reason: string; dupOf?: number; cite?: string }
export type ClaudeNote = { text: string; at: number }
// A resolution Claude's amend replaced, kept visible.
export type Superseded = { note?: string; answer?: Answer; at: number; correction: string }

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
  // Where the item was first raised, "<sid>:<id>"; kept when carried (v0.3), so it is never brought in
  // twice. Older items read it as `${sid}:${id}`.
  origin?: string
  // When the item first appeared, kept through every carry: the honest age.
  firstSeenAt?: number
  // Set when the item arrived through a carry (v0.3).
  carriedAt?: number
  // v0.6: see Answer. Set on every close by a judged reply of the user's.
  answer?: Answer
  // v0.6: a close by a button rather than a reply (Done, Reply new).
  via?: 'done' | 'reply-new'
  // v0.6: Claude's notes (annotate), its close (close), and what its amend replaced.
  notes?: ClaudeNote[]
  closure?: Closure
  superseded?: Superseded
}

// The carry switch (v0.3). gen goes up each time it is turned on; { on: false, gen: 0 } until then.
export type CarryState = { on: boolean; gen: number }

// One thing the user typed: a prompt, or a `!` shell command (text starts with '!').
// v0.4, stamped when it was typed (see ledger.addUser): focusId, the walk item this reply answers;
// inWalk, a walk was going on (so "skip" and the like never close an item).
// v0.6: words, the text with a Reply lead stripped (what the user typed); namedId, the item that lead
// named; midTurn, typed while a turn ran; fails, checks of this reply that failed.
// answered: Claude's final message on screen when it was typed, which the reply is judged against.
export type UserEntry = {
  seq: number
  text: string
  afterTurn: number
  focusId?: number
  inWalk?: true
  words?: string
  namedId?: number
  midTurn?: true
  fails?: number
  answered?: Answered
  // The open items that message was about when the reply was typed (v0.6).
  aboutIds?: number[]
}
// clipped: the message was longer than what was kept, so its option lists can't be trusted whole.
export type Answered = { text: string; clipped: boolean }
// One prompt the user typed, as Docket recorded it (v0.6): the only source amend and close cite from.
// overCap: open items its check left by the per-reply limit; answered and the stamps tie it to items.
export type LoggedReply = { seq: number; words: string; afterTurn: number; overCap?: number[]; focusId?: number; namedId?: number; answered?: Answered; aboutIds?: number[] }
// The latest judged reply whose verdict went over the per-reply limit (v0.6). shown: list has shown it.
export type LastReply = { seq: number; words: string; closed: number[]; overCap: number[]; shown: boolean }
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
  // The conversation this docket belongs to. 'pending' until the session is known (every new process
  // starts there); '' only for a live v0.1 value from before the upgrade, which is adopted.
  sid: string
  // $.session.root() at the first landing; a later /cd doesn't move it.
  root: string
  // Saved in the snapshot: a session that never had an item (and never touched carry) writes nothing.
  everHadItem: boolean
  carry: CarryState
  // Not saved: this landing loaded a snapshot or adopted a v0.1 value.
  restored: boolean
  // Not saved (rebuilt on restore from the claims): a later session already took this carry gen.
  carryTaken: boolean
  // Not saved: the last carry write failed; the pane row says so until one succeeds.
  carrySaveFailed: boolean
  // Not saved: items just carried in, for the band and the first-prompt line.
  // isSeen: the pane was opened, so the band's banner stops; the transcript line still comes.
  carriedNotice: { count: number; folder: string; isSeen: boolean } | null
  // Saved: a take applied whose claim isn't written yet; retried until it is.
  pendingClaim: CarrySource | null
  // Not saved (v0.4): the item Claude last presented in a walk, through the list tool's `presenting`.
  // turn is the main turn it was presented in; ids every distinct id presented in that turn.
  walkFocus: WalkFocus | null
  // v0.6, not saved: the user's typed prompts, and the last reply that went over the limit.
  userLog: LoggedReply[]
  // v0.6: lastFinal came back from disk cut to the saved length, so its lists can't be read whole.
  lastFinalClipped: boolean
  lastReply: LastReply | null
}

export type WalkFocus = { id: number; turn: number; ids: number[] }

// What a Reply new window shows Claude with the first prompt it sends (v0.4).
export type HandoffContext = { itemText: string; quote: string }

// Where a carry came from: its session, the switch generation it was taken at, and that session's root
// (claims live under the source's folder).
export type CarrySource = { srcSid: string; gen: number; srcRoot: string }

// What a /clear leaves for the cleared conversation to take, recorded as the old session is left.
export type ClearCapture = CarrySource & { id: number; on: boolean; taken: boolean; items: Item[]; target: string | null }

// Process-scoped: survives a hot reload, and is never replaced by a /clear or /resume.
export type DocketProc = {
  // null until session.start says.
  isInteractive: boolean | null
  // The id session.end is ending, while it is still current.
  endingSid: string | null
  // Bumped by every switch and every session.start: a check that began before is thrown away.
  epoch: number
  saveToastShown: boolean
  // The session the last classic.SessionStart named: lazy callers don't pull the docket off it while
  // $.session.id() still reads an older or provisional id.
  classicSid: string | null
  // What $.session.id() read when that classic call landed; the lazy guard holds only while it still does.
  classicFrom: string | null
  // The first session this process landed on (from session.start or classic startup): the only one a
  // startup take can go to.
  startupSid: string | null
  startupDecided: boolean
  // The sid a classic.SessionStart with source startup named.
  classicStartupSeenFor: string | null
  clearCapture: ClearCapture | null
  captureSeq: number
  // v0.4, Reply new. In a window Docket opened: the handoff's nonce (latched at session.start, before
  // anything can take the folder's carry), whether it was picked up, and the item context the first
  // prompt carries. In any window: whether this one can open a new window at all.
  handoffNonce: string | null
  handoffPicked: boolean
  handoffContext: HandoffContext | null
  canReplyNew: boolean
  // v0.6: the module instance whose judge runner may queue replies (the newest to run session.start).
  runner: number | null
}

export type WriteKind = 'snap' | 'carry'

// One write the writer still owes: the latest payload for (sid, kind).
export type PendingWrite = { sid: string; root: string; kind: WriteKind; text: string; isFinal: boolean }

// Process-scoped writer bookkeeping, keyed "<sid>|<kind>" where per (sid, kind).
export type DocketWriter = {
  seqBy: Record<string, number>
  lastText: Record<string, string>
  pending: Record<string, PendingWrite>
  // The root each sid was last written with, so the writer's in-memory text can be restored whole.
  rootBy: Record<string, string>
  // Sids left by a switch: only a final is written for them until a rehome reopens one.
  closed: Record<string, true>
  // Sids /docket forget erased, with the nextId at that moment: the next new item lifts it.
  forgotten: Record<string, number>
}

declare module 'claude-code' {
  interface PluginState {
    docket: { session: DocketSession; proc: DocketProc; writer: DocketWriter }
  }
}
