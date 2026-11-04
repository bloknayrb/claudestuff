import type { Elements } from 'claude-code'

import type { DocketSession, Item } from '../types'
import { folderName, wallAge } from './carry'
import type { CloseGroup } from './ledger'
import { clip } from './text'

export const PANE_ID = 'docket'
export const PANE_TITLE = 'Docket'
export const PANE_COLUMNS = 56

// After any change to the list, digit keys ignore presses for this long and each press during the pause
// restarts it: a verdict that reorders rows cannot turn a press into the wrong dismiss, and a held key
// cannot dismiss the next row. 1100 ms is above Windows' largest key-repeat delay (1000 ms), as Bridge.
export const ARM_DELAY_MS = 1100

export type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

export type Actions = {
  reply: (id: number) => void
  done: (id: number) => void
  dismiss: (id: number) => void
  reopen: (closeSeq: number) => void
  toggleClosed: () => void
  toggleCarry: () => void
}

// What the drawing knows beyond the session value (module state, the clock).
export type Live = { isChecking: boolean; isResolving: boolean; isFocused: boolean; now: number }

// Short ages: "now", then turns ("2t").
function age(turns: number): string {
  return turns <= 0 ? 'now' : `${turns}t`
}

// Display order, which the digit keys follow: decisions first, then actions, oldest first in each.
export function ordered(open: readonly Item[]): Item[] {
  return [...open.filter(i => i.kind === 'decide'), ...open.filter(i => i.kind === 'do')]
}

// The band button's label, or undefined to draw nothing: shown while anything is open or a check
// failed. It names what a click does.
export function indicatorText(open: number, s: DocketSession, isPaneUp: boolean): string | undefined {
  const click = isPaneUp ? 'click to hide' : 'click to show'
  // Just carried in: say where they came from, until the next prompt or the pane opens.
  if (s.carriedNotice !== null && !s.carriedNotice.isSeen && open > 0) return `◇ ${s.carriedNotice.count} carried from your previous session here · ${click}`
  const failed = s.lastCheck.ok ? '' : ' · last check failed'
  if (open === 0 && failed === '') return undefined
  const count = open === 0 ? '◇ Docket' : `◇ ${open} for you to decide or do`
  const carrying = s.carry.on && !s.carryTaken && open > 0 ? ' · ↪ next session' : ''
  return `${count}${carrying}${failed} · ${click}`
}

// Amber (the theme's warning color, as Quartermaster's line) so it is noticed; the Text child carries
// the color, since a Button's own props have none.
export function indicatorTree(els: Pick<Els, 'Box' | 'Button' | 'Text'>, below: unknown, label: string, onPress: () => void) {
  const { Box, Button, Text } = els
  return (
    <Box key="docket-band" flexDirection="column">
      {below as never}
      <Button key="docket-indicator" plain label={label} onPress={onPress}>
        <Text color="warning">{label}</Text>
      </Button>
    </Box>
  )
}

function row(els: Els, item: Item, n: number, turn: number, act: Actions, isFocusedItem: boolean, isResolving: boolean, now: number) {
  const { Box, Text, Button } = els
  const isKeyed = n < 9
  const pos = isKeyed ? String(n + 1) : '·'
  // A carried item's age is wall-clock from when it first appeared, wherever it was raised.
  const ageLabel = item.carriedAt !== undefined ? `↪ ${wallAge(now - (item.firstSeenAt ?? item.carriedAt))}` : age(turn - item.openedTurn)
  return (
    <Box key={`item-${item.id}`} flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold>{pos}</Text>
        <Box flexGrow={1}>
          <Text key={`text-${item.id}`}>{item.text}</Text>
        </Box>
        <Text dimColor>{ageLabel}</Text>
      </Box>
      <Box flexDirection="row" gap={2} paddingLeft={2}>
        <Button key={`reply-${item.id}`} plain label="Reply" onPress={() => act.reply(item.id)} />
        <Button key={`done-${item.id}`} plain label="Done" onPress={() => act.done(item.id)} />
        <Button key={`dismiss-${item.id}`} plain label="✕" {...(isKeyed ? { hotkey: pos } : {})} onPress={() => act.dismiss(item.id)} />
      </Box>
      {isFocusedItem && item.quote !== '' && (
        <Box paddingLeft={2}>
          <Text key={`quote-${item.id}`} dimColor>{`↳ Claude: "${clip(item.quote, 160)}"`}</Text>
        </Box>
      )}
      {isFocusedItem && item.carriedAt !== undefined && (
        <Box paddingLeft={2}>
          <Text dimColor>{`↳ from the ${new Date(item.firstSeenAt ?? item.carriedAt).toISOString().slice(0, 10)} session`}</Text>
        </Box>
      )}
      {isFocusedItem && item.source === 'manual' && (
        <Box paddingLeft={2}>
          <Text dimColor>↳ added by you</Text>
        </Box>
      )}
      {isResolving && (
        <Box paddingLeft={2}>
          <Text dimColor>checking your reply…</Text>
        </Box>
      )}
    </Box>
  )
}

function closedReason(i: Item): string {
  if (i.by === 'you') return i.note === '' || i.note === undefined ? 'you' : `you: ${i.note}`
  if (i.by === 'claude') return `Claude: ${i.note ?? ''}`
  return 'dismissed'
}

function closedRow(els: Els, g: CloseGroup, act: Actions) {
  const { Box, Text, Button } = els
  const first = g.items[0]
  if (first === undefined) return null
  const isBatch = first.by === 'clear'
  const label = isBatch ? `Reopen all (${g.items.length})` : 'Reopen'
  const line = isBatch ? `cleared ${g.items.length} items` : `${clip(first.text, 60)} — ${closedReason(first)}`
  return (
    <Box key={`closed-${g.closeSeq}`} flexDirection="row" gap={1}>
      <Button key={`reopen-${g.closeSeq}`} plain label={label} onPress={() => act.reopen(g.closeSeq)} />
      <Text dimColor>{line}</Text>
    </Box>
  )
}

function section(els: Els, title: string, items: readonly Item[], offset: number, s: DocketSession, live: Live, act: Actions) {
  const { Box, Text } = els
  if (items.length === 0) return null
  return (
    <Box key={`section-${title}`} flexDirection="column" marginTop={1}>
      <Text bold color="warning">{title}</Text>
      {items.map((item, i) => row(els, item, offset + i, s.turn, act, s.view.focusedId === item.id, live.isResolving, live.now))}
    </Box>
  )
}

// The carry switch, below the list: a setting sits under the content it is about.
function carryRow(els: Els, s: DocketSession, act: Actions) {
  const { Box, Text, Button } = els
  const where = folderName(s.root)
  const state = !s.carry.on
    ? 'off'
    : s.carryTaken
      ? 'on · taken by a later session · turn off and on to carry again'
      : s.carrySaveFailed
        ? 'on · last save failed'
        : 'on'
  return (
    <Box key="docket-carry" flexDirection="row" gap={1} marginTop={1}>
      <Text dimColor>{`Carry to the next session in ${where}: ${state} ·`}</Text>
      <Button key="docket-carry-toggle" plain label={s.carry.on ? 'turn off' : 'turn on'} onPress={() => act.toggleCarry()} />
    </Box>
  )
}

export function paneTree(els: Els, s: DocketSession, open: readonly Item[], groups: readonly CloseGroup[], live: Live, act: Actions) {
  const { Box, Text, Button } = els
  const list = ordered(open)
  const decide = list.filter(i => i.kind === 'decide')
  const doItems = list.filter(i => i.kind === 'do')
  const isPaused = s.view.keysPausedUntil !== null
  const keys = !live.isFocused
    ? 'ctrl+x tab gives this pane the keys'
    : isPaused
      ? 'keys paused a moment: the list changed'
      : list.length > 0
        ? `${list.length === 1 ? '1' : `1-${Math.min(9, list.length)}`} dismiss · Tab moves`
        : ''
  // The footer only speaks when there is something to know.
  const footer = !s.lastCheck.ok ? `last check failed: ${s.lastCheck.reason}` : live.isChecking ? 'checking…' : ''
  return (
    <Box key="docket-pane" flexDirection="column">
      {list.length === 0 ? (
        <Text key="docket-empty" dimColor>Nothing waiting on you.</Text>
      ) : (
        <Text key="docket-count" bold>{`${list.length} for you to decide or do`}</Text>
      )}
      {keys !== '' && <Text dimColor>{keys}</Text>}
      {section(els, 'Decide', decide, 0, s, live, act)}
      {section(els, 'Do', doItems, decide.length, s, live, act)}
      {groups.length > 0 && (
        <Box key="docket-closed" flexDirection="column" marginTop={1}>
          <Button
            key="docket-show-closed"
            plain
            label={s.view.showAllClosed ? `${groups.length} closed · hide` : `${groups.length} closed · show`}
            onPress={() => act.toggleClosed()}
          />
          {s.view.showAllClosed && groups.map(g => closedRow(els, g, act))}
        </Box>
      )}
      {carryRow(els, s, act)}
      {footer !== '' && <Text key="docket-footer" dimColor>{footer}</Text>}
    </Box>
  )
}
