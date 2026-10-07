import type { Elements } from 'claude-code'

export const PANE_ID = 'bridge'
export const PANE_TITLE = 'Bridge'

// After an answer, the keys are paused for this long, and each press during the pause restarts it (a
// debounce), so a double-tap or a held key's repeat cannot answer a card the user has not read.
export const ARM_DELAY_MS = 400

// What the trees need from a surface's table. Typing UI is gated on the surface, never on whether the
// table has an Input: every surface's table hands one out, and on mobile it draws nothing (00-shared).
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
