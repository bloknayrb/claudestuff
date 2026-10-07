import type { AgentSpawnInput } from 'claude-code'
import type { QmDenial, QmGuard } from '../types'
import type { QmConfig } from './config'

// The guards' decisions, with no `$`: register.ts reads the world and acts; this file only decides.

export const MODEL_TEXT =
  'Quartermaster: set `model` for this agent from its task (haiku: mechanical; sonnet: well-specified; opus: judgement). Re-issue unchanged to keep the inherited model.'

/** A denial answers a re-issue or a changed call only this long (Task 3, re-issue edges). */
export const DENIAL_TTL_MS = 10 * 60_000

/** What the guards read of a spawn. A blank model is unset; `loop` is `parentAgentId`, or `main`. */
export type SpawnView = {
  prompt: string
  description: string
  subagentType: string
  fork: boolean
  parentModel: string
  model: string | undefined
  loop: string
}

/** The guards that fired, with aligned texts (the deny for a model's call, the toast otherwise) and the window. */
export type Fired = { guards: QmGuard[]; denyTexts: string[]; toastTexts: string[]; windowKey: string | null }

type LooseSpawn = Partial<Record<keyof AgentSpawnInput, unknown>> & { subagent_type?: unknown }

/**
 * Reads a spawn event in either shape: AgentSpawnInput, or the Agent tool's input that the 2.1.292 test kit
 * gives a plugin's own spawn (`subagent_type`; no `subagentType`, `fork` or `parentModel`; 00-shared).
 */
export function viewOf(input: AgentSpawnInput): SpawnView {
  const e = input as unknown as LooseSpawn
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const type = text(e.subagentType) || text(e.subagent_type)
  const model = text(e.model).trim()
  return {
    prompt: text(e.prompt),
    description: text(e.description),
    // An Agent call with no subagent_type is general-purpose (Q8).
    subagentType: type === '' ? 'general-purpose' : type,
    fork: e.fork === true,
    parentModel: text(e.parentModel),
    model: model === '' ? undefined : model,
    loop: text(e.parentAgentId) || 'main',
  }
}

/**
 * Who can't re-issue a denied spawn (D4, D15): a workflow script's `agent()` (`e.workflow` set), or another
 * plugin's `$.agent.spawn` (`next.origin`). null is the model's own Agent call, the only one ever denied.
 */
export function sourceOf(isWorkflow: boolean, originPlugin: string): string | null {
  if (isWorkflow) return 'workflow'
  return originPlugin === 'engine' ? null : originPlugin
}

export function sourceLabel(source: string): string {
  return source === 'workflow' ? 'a workflow' : source
}

/** One toast per key per session: the model toast per (source, type), the heavy toast per (source, window). */
export function toastKey(guard: QmGuard, source: string, subagentType: string, window: string | null): string {
  return guard === 'model' ? `model/${source}/${subagentType}` : `heavy/${source}/${window ?? 'none'}`
}

export function modelGuardFires(view: SpawnView, cfg: QmConfig): boolean {
  return cfg.requireModel && !view.fork && view.model === undefined && cfg.guardTypes.includes(view.subagentType)
}

/**
 * The model a spawn will run on, where that is knowable before it starts (D2). A fork always inherits; an
 * unset model on a guarded type inherits the parent's (assuming no default subagent model is configured);
 * an unset model on any other type is its definition's, which no event shows, so it is unknown.
 */
export function effectiveModel(view: SpawnView, cfg: QmConfig): string | null {
  if (view.fork) return view.parentModel
  if (view.model !== undefined) return view.model
  return cfg.guardTypes.includes(view.subagentType) ? view.parentModel : null
}

/** Substring, any case (D3): `opus` matches the alias and `claude-opus-5-5`. heavyModels is lower-cased. */
export function isHeavy(model: string | null, heavyModels: readonly string[]): boolean {
  if (model === null || model === '') return false
  const id = model.toLowerCase()
  return heavyModels.some(token => id.includes(token))
}

/** A pending denial counts only in the loop it was denied in, and only for DENIAL_TTL_MS. */
export function isLive(d: QmDenial, loop: string, now: number): boolean {
  return d.loop === loop && now - d.ts <= DENIAL_TTL_MS
}

/** Removes the first entry `match` picks, and only that one: three identical denials answer three re-issues. */
export function takeOne(list: readonly QmDenial[], match: (d: QmDenial) => boolean): { rest: QmDenial[]; taken: QmDenial | undefined } {
  const i = list.findIndex(match)
  if (i < 0) return { rest: [...list], taken: undefined }
  return { rest: [...list.slice(0, i), ...list.slice(i + 1)], taken: list[i] }
}

/**
 * How a call repeating an earlier denial's task (D6) settles each guard (D16):
 * - a guard of the denial that the new call no longer trips is `changed`;
 * - after a heavy deny, a call that names a model itself and still trips the heavy guard is an informed
 *   override: `changed`, and it does not deny again;
 * - any guard that still trips otherwise denies again, as a fresh fire.
 */
export function settle(earlier: readonly QmGuard[], fired: readonly QmGuard[], view: SpawnView): { changed: QmGuard[]; deny: QmGuard[] } {
  // A fork ignores `model` and always runs on the parent's, so naming one is no override.
  const overridden = earlier.includes('heavy') && fired.includes('heavy') && view.model !== undefined && !view.fork
  const changed = earlier.filter(g => !fired.includes(g) || (g === 'heavy' && overridden))
  const deny = fired.filter(g => !(g === 'heavy' && overridden))
  return { changed, deny }
}
