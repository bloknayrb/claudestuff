import type { BridgeOption, DecideInput } from '../types'

export const TOOL_NAME = 'decide'

export const TOOL_DESCRIPTION = [
  'Queue a decision for the user and keep working: the call returns at once with the decision number,',
  'and the answer arrives later as a user message `Bridge decision: {json}`.',
  'The user answers only from the Bridge pane (`/bridge`); the band above the prompt only shows how many are pending.',
  'A prompt the user types, such as "make it so", does not answer a decision: treat it as an ordinary message.',
  'Use it only for a call that is really the user\'s. Procedural calls are yours: make them.',
  'If you cannot go on at all without the answer, use AskUserQuestion instead; use this tool when other work does not depend on it.',
  'Put everything needed to judge on the card, since the user should not have to recall anything:',
  '`context` (Markdown), 2 to 4 `options` (a short `label`, an optional `detail`),',
  '`recommend` (the 0-based index of the option you recommend), `why` (why that one),',
  'and `why_yours` (why this is the user\'s call and not yours).',
  'In the answer, only `text` (present when `choice` is "other") is the user\'s own words; `question` and `label` are yours.',
  'Main loop only: a subagent\'s call is refused.',
].join(' ')

export const INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['question', 'context', 'options', 'recommend', 'why', 'why_yours'],
  properties: {
    question: { type: 'string', minLength: 1, description: 'The decision, as one question.' },
    context: { type: 'string', minLength: 1, description: 'Everything needed to judge it, as Markdown.' },
    options: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label'],
        properties: { label: { type: 'string', minLength: 1 }, detail: { type: 'string' } },
      },
    },
    recommend: { type: 'integer', minimum: 0, maximum: 3, description: '0-based index into options.' },
    why: { type: 'string', minLength: 1, description: 'Why you recommend that option.' },
    why_yours: { type: 'string', minLength: 1, description: "Why this is the user's call and not yours." },
  },
}

export type Checked = { isValid: true; input: DecideInput } | { isValid: false; problems: string[] }

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

// The engine documents no check of a plugin tool's input against its schema, so the hook checks every
// field itself.
export function validateDecide(raw: Record<string, unknown>): Checked {
  const problems: string[] = []
  for (const key of ['question', 'context', 'why', 'why_yours'] as const) {
    if (!isText(raw[key])) problems.push(`${key} must be a non-empty string`)
  }
  const options: BridgeOption[] = []
  const given = raw.options
  if (!Array.isArray(given) || given.length < 2 || given.length > 4) {
    problems.push('options must be an array of 2 to 4 items')
  } else {
    given.forEach((option: unknown, i) => {
      const o = (option ?? {}) as Record<string, unknown>
      if (!isText(o.label)) problems.push(`options[${i}].label must be a non-empty string`)
      if (o.detail !== undefined && typeof o.detail !== 'string') problems.push(`options[${i}].detail must be a string`)
      options.push({ label: String(o.label ?? ''), ...(typeof o.detail === 'string' ? { detail: o.detail } : {}) })
    })
    if (new Set(options.map(o => o.label.trim())).size !== options.length) problems.push('option labels must differ')
  }
  const count = Array.isArray(given) ? given.length : 0
  const recommend = raw.recommend
  if (typeof recommend !== 'number' || !Number.isInteger(recommend) || recommend < 0 || recommend >= Math.max(count, 1)) {
    problems.push(`recommend must be 0 to ${Math.max(count - 1, 0)}, the 0-based index of an option`)
  }
  if (problems.length > 0) return { isValid: false, problems }
  return {
    isValid: true,
    input: {
      question: raw.question as string,
      context: raw.context as string,
      options,
      recommend: recommend as number,
      why: raw.why as string,
      why_yours: raw.why_yours as string,
    },
  }
}

export function denialFor(problems: string[]): string {
  return `Bridge did not queue the decision: ${problems.join('; ')}. Fix the input and call again.`
}

export const SUBAGENT_DENIAL =
  'Bridge: only the main loop can queue decisions, since a subagent may be gone when the answer arrives. Put the question in your report and let the main loop queue it.'

export function isSubagentCall(e: { agentId?: string }): boolean {
  return e.agentId !== undefined
}

export function receipt(id: number): string {
  return `Logged as decision #${id}. Keep going on what doesn't depend on it; the answer arrives as a message.`
}
