// Origins the engine stamps as the user's own gesture. ORIGIN_REMOTE_CONTROL is the engine's name for
// Remote Control (phone or web), which happens to be spelt like this plugin. This plugin's own prompts
// arrive as { kind: 'plugin', name: 'bridge' }, so always compare kind, never name. Channels are
// refused: a relayed channel can carry text from people other than the user (see the plan's Task 6).
export const ORIGIN_COMPOSER = 'composer'
export const ORIGIN_REMOTE_CONTROL = 'bridge'

const GO_AHEAD = /^\s*(make it so|engage)[\s.!]*$/i

export function isFromUser(origin: { kind: string }): boolean {
  return origin.kind === ORIGIN_COMPOSER || origin.kind === ORIGIN_REMOTE_CONTROL
}

export function isGoAhead(text: string): boolean {
  return GO_AHEAD.test(text)
}

// Whether my last turn's text asks something in prose. Code (fenced, tilde-fenced, unclosed, inline)
// and the inside of a URL carry '?' that asks nothing. The URL match ends on a character that is not
// trailing punctuation, so "Shall I merge https://.../7?" keeps its question mark.
export function asksQuestion(text: string): boolean {
  const prose = text
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(~~~|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*[^\s?!.,;:)\]]/gi, ' ')
  return /[?\uff1f]/.test(prose)
}

// Appended as Bridge's own row (isMeta, plugin origin), never attached to the user's prompt.
export function stillPendingLine(id: number): string {
  return `Bridge: decision #${id} is still pending; that prompt did not resolve it.`
}
