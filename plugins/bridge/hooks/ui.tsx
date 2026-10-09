import type { Elements } from 'claude-code'

import type { Decision, ViewState } from '../types'

export const PANE_ID = 'bridge'
export const PANE_TITLE = 'Bridge'

// After an answer, the keys are paused for this long, and each press during the pause restarts it (a
// debounce), so a double-tap or a held key's repeat cannot answer a card the user has not read.
// 1100 ms because a held key's first repeat comes only after the OS repeat delay, and Windows allows
// 250-1000 ms, so this is above its largest. A pause shorter than the delay ends before the first repeat,
// which then lands as a fresh press on the next card (seen live at 400 ms with a 500 ms delay). macOS and
// X11 can be set slower than 1100 ms, and there a held key can still answer the next card.
export const ARM_DELAY_MS = 1100

// What the trees need from a surface's table. Typing UI is gated on the surface, never on whether the
// table has an Input: every surface's table hands one out, and on mobile it draws nothing.
export type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Markdown'> & {
  Input?: Elements['terminal']['Input']
}

export function bandTree(els: Pick<Els, 'Box' | 'Text'>, count: number) {
  const { Box, Text } = els
  const noun = count === 1 ? 'decision' : 'decisions'
  return (
    <Box key="bridge-band">
      <Text>{`⚑ ${count} ${noun} pending · /bridge`}</Text>
    </Box>
  )
}

export type CardActions = {
  pick: (id: number, index: number) => void
  makeItSo: (id: number) => void
  toggleOther: (id: number) => void
  sendOther: (id: number, text: string) => void
}

function hotkey(isArmed: boolean, key: string): { hotkey?: string } {
  return isArmed ? { hotkey: key } : {}
}

function card(els: Els, d: Decision, isArmed: boolean, canType: boolean, isOtherOpen: boolean, act: CardActions) {
  const { Box, Text, Button, Markdown, Input } = els
  return (
    <Box key={`card-${d.id}`} flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{`#${d.id} ${d.question}`}</Text>
      <Markdown key={`context-${d.id}`} text={d.context} />
      {d.options.map((option, i) => (
        <Box key={`option-${d.id}-${i}`} flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button
              key={`pick-${d.id}-${i}`}
              plain
              label={option.label}
              {...hotkey(isArmed, String(i + 1))}
              onPress={() => act.pick(d.id, i)}
            />
            {i === d.recommend && <Text bold>(recommended)</Text>}
          </Box>
          {option.detail !== undefined && option.detail !== '' && <Text dimColor>{option.detail}</Text>}
        </Box>
      ))}
      <Text>{`Why ${d.recommend + 1}: ${d.why}`}</Text>
      <Text dimColor>{`Why it is yours: ${d.why_yours}`}</Text>
      <Box flexDirection="row" gap={2}>
        <Button
          key={`make-${d.id}`}
          variant="primary"
          label="Make it so"
          {...hotkey(isArmed, 'm')}
          onPress={() => act.makeItSo(d.id)}
        />
        {canType && (
          <Button key={`other-${d.id}`} label="Other" {...hotkey(isArmed, 'o')} onPress={() => act.toggleOther(d.id)} />
        )}
      </Box>
      {canType && isOtherOpen && Input !== undefined && (
        <Input
          key={`other-text-${d.id}`}
          placeholder="Your answer; Enter sends it"
          submitLabel="send"
          autoFocus
          onSubmit={value => act.sendOther(d.id, value)}
        />
      )}
    </Box>
  )
}

// canType: false on mobile, where an Input draws nothing (gate on the surface, not the table).
export function paneTree(
  els: Els,
  open: readonly Decision[],
  view: Pick<ViewState, 'otherFor' | 'keysPausedUntil'>,
  canType: boolean,
  act: CardActions,
) {
  const { Box, Text } = els
  const first = open[0]
  if (first === undefined) {
    return (
      <Box key="bridge-empty">
        <Text dimColor>No decisions pending.</Text>
      </Box>
    )
  }
  // The hotkeys stay bound during a pause: a press then only restarts the pause (see register.tsx).
  const isArmed = view.otherFor === null
  const keysLine = view.otherFor !== null
    ? 'Typing an Other answer: Enter sends it; Tab to Other and press Enter (or click it) to cancel.'
    : view.keysPausedUntil !== null
      ? 'Keys paused a moment: let go of the key.'
      : `Keys answer #${first.id}: 1-${first.options.length} pick · m make it so${canType ? ' · o other' : ''}`
  return (
    <Box key="bridge-pane" flexDirection="column">
      <Text bold>{`${open.length} pending`}</Text>
      <Text dimColor>{keysLine}</Text>
      {open.map((d, n) => card(els, d, n === 0 && isArmed, canType, view.otherFor === d.id, act))}
    </Box>
  )
}
