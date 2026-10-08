import type { PluginOptions } from 'claude-code'

export type QmConfig = {
  warnAt: number
  heavyModels: string[]
  guardTypes: string[]
  requireModel: boolean
}

export const DEFAULTS: QmConfig = {
  warnAt: 75,
  heavyModels: ['opus', 'fable'],
  guardTypes: ['general-purpose', 'claude'],
  requireModel: true,
}

/** The live config, set by register() on every load; read by the hook handlers. */
export const current: { cfg: QmConfig; shapes: string } = {
  cfg: { ...DEFAULTS, heavyModels: [...DEFAULTS.heavyModels], guardTypes: [...DEFAULTS.guardTypes] },
  shapes: 'unknown',
}

/** A list option arrives as an array or as a comma-separated string; either reads the same. */
export function toList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(v => v !== '')
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(v => v !== '')
  return [...fallback]
}

/** How an option value arrived, for the debug log and /quartermaster (pins how list options arrive). */
export function shapeOf(value: unknown): string {
  return Array.isArray(value) ? 'array' : typeof value
}

function toPercent(value: unknown): number {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULTS.warnAt
}

export function parseConfig(options: PluginOptions): QmConfig {
  const requireModel = options['requireModel']
  return {
    warnAt: toPercent(options['warnAt']),
    // Lower-cased once here: heavy matching is a case-insensitive substring.
    heavyModels: toList(options['heavyModels'], DEFAULTS.heavyModels).map(m => m.toLowerCase()),
    guardTypes: toList(options['guardTypes'], DEFAULTS.guardTypes),
    requireModel: typeof requireModel === 'boolean' ? requireModel : DEFAULTS.requireModel,
  }
}
