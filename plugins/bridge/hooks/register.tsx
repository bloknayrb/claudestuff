import type { EngineInterface, Register } from 'claude-code'

// Module variables are lost on hot reload and refilled by the next start or draw. Nothing the
// pane depends on lives here; that is in $.state.
let loadedAt = 0
let heartbeatFor = ''

async function writeHealth($: EngineInterface, error?: string): Promise<void> {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    if (home === undefined || home === '') return
    const sessionId = await $.session.id()
    const now = await $.clock.now()
    if (loadedAt === 0) loadedAt = now
    const body = { loadedAt, lastError: error === undefined ? null : { ts: now, message: error } }
    await $.fs.write(`${home.replace(/\\/g, '/')}/.claude/state/mods/bridge/${sessionId}.json`, JSON.stringify(body))
    heartbeatFor = sessionId
  } catch {
    // Best effort by convention (00-shared, Health file): a failed write is ignored.
  }
}

async function fail($: EngineInterface, where: string, err: unknown): Promise<void> {
  const message = `${where}: ${err instanceof Error ? err.message : String(err)}`
  try {
    $.ui.log(`bridge: ${message}`, { to: 'debug' })
  } catch {
    // A .catch handler's own $ calls can reject (2.1.292 re-entry); the health write below is best effort too.
  }
  await writeHealth($, message)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.tool.register({ name: 'decide', description: 'Scaffold.' })
      await $.command.register({
        name: 'bridge',
        description: 'Open the Bridge pane of pending decisions',
        immediate: true,
      })
      loadedAt = await $.clock.now()
    } catch (err) {
      await fail($, 'session.start', err)
    }
    await writeHealth($)
    return next(e)
  })

  // Scaffold only (Task 7 replaces the file and deletes the smoke test that relies on this): proves the
  // kit routes a tool call to this hook.
  on('tool.call', { tool: 'mcp__bridge__decide' }, () => ({ result: 'ok' })).catch(() => ({ deny: 'scaffold' }))
}
