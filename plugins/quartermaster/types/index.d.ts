export type QmGuard = 'model' | 'heavy'

/**
 * A spawn denied once and waiting for its re-issue: the full hash, the task hash, the loop it was
 * denied in (`parentAgentId`, or `main`), the guards that denied it, and when.
 */
export type QmDenial = { hash: string; task: string; loop: string; guards: QmGuard[]; ts: number }

/** What the heartbeat file says, and for which session. */
export type QmHealth = {
  sessionId: string
  loadedAt: number
  lastError: { ts: number; message: string } | null
}

declare module 'claude-code' {
  interface PluginState {
    quartermaster: {
      denied: QmDenial[]
      agents: Record<string, string>
      spawnModels: Record<string, string>
      sourceToasts: string[]
      sourceSpawns: Record<string, number>
      health: QmHealth | null
    }
  }
}
