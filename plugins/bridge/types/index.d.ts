// Copied from the shared delivery module (Red Team's hooks/delivery.ts) because a types contract may
// not import. If that module's DeliveryRow/DeliveryState change, change these to match; tsc then checks
// that register.tsx passes the module's values through unchanged.
export type EndReason = 'answer' | 'aborted' | 'error' | 'refusal'
export type DeliveryRow = { id: number; tag: string; step: number; hasWoken: boolean }
export type DeliveryState = {
  unread: DeliveryRow[]
  nextId: number
  steps: number
  isMainTurnRunning: boolean
  lastMainEnd: EndReason | null
}

export type BridgeOption = { label: string; detail?: string }

export type DecideInput = {
  question: string
  context: string
  options: BridgeOption[]
  recommend: number
  why: string
  why_yours: string
}

export type LabelAnswer = { choice: 'label'; label: string }
export type OtherAnswer = { choice: 'other'; text: string }
export type Answer = LabelAnswer | OtherAnswer

// 'answered' covers every way a decision closes from the pane: a pick, Other, and Make it so (button or
// the m key). Each one appends a row, so there is no separate 'resolved' state.
export type DecisionStatus = 'pending' | 'answered'

export type Decision = DecideInput & {
  id: number
  // The tool_use_id that queued it: makes queueing idempotent and lets the hook find its own id.
  useId: string
  status: DecisionStatus
  answer?: Answer
  // Set with the answer so the press that set it (and only that one) delivers it.
  answerNonce?: string
  createdAt: number
}

export type Book = { decisions: Decision[]; nextId: number }

// isPaneUp: Bridge's own record of whether its pane is open; re-synced from $.ui.panes() before it is
// trusted for surfacing. otherFor: the card whose Other field is open (its hotkeys are off meanwhile).
// keysPausedUntil: the clock time the key pause after an answer ends, or null. During it a press on a
// card is a no-op that pushes the end out again (a debounce), so a held key never answers the next card
// until it has been let go for the whole delay. Each pause's timer clears only its own deadline.
export type ViewState = { isPaneUp: boolean; otherFor: number | null; keysPausedUntil: number | null }

export type BridgeSession = {
  book: Book
  // The shared module's state (copied from Red Team, hooks/delivery.ts).
  delivery: DeliveryState
  // A wake was submitted and its turn has not started yet: a second idle answer rides on it.
  isWakeQueued: boolean
  view: ViewState
}

declare module 'claude-code' {
  interface PluginState {
    bridge: { session: BridgeSession }
  }
  // The plugin's own tool. When MCP servers are connected the engine-written claude-code-mcp types fill
  // McpToolInputs, the loose fallback goes away, and a tool.call matcher naming a tool missing from the
  // table no longer type-checks. If a later engine writes this tool
  // into claude-code-mcp itself with another type, the merge conflicts: then delete this entry.
  interface McpToolInputs {
    mcp__bridge__decide: Record<string, unknown>
  }
}
