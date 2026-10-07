import type { EngineInterface, Register } from 'claude-code'

const LEDGER = { plugin: 'claim-ledger', key: 'ledger' } as const

let home: string | null = null
let loadedAt = 0

async function homeOf($: EngineInterface): Promise<string | null> {
  const profile = await $.env.get('USERPROFILE')
  if (profile !== undefined && profile !== '') return profile.replace(/\\/g, '/')
  const posix = await $.env.get('HOME')
  return posix !== undefined && posix !== '' ? posix.replace(/\\/g, '/') : null
}

async function start($: EngineInterface, optionsText: string): Promise<void> {
  home = await homeOf($)
  loadedAt = await $.clock.now()
  await $.state.get(LEDGER)
  await $.command.register({ name: 'claim-ledger', description: 'Claim Ledger: how often a flagged claim was later backed by a run' })
  $.ui.log(`claim-ledger: loaded, options ${optionsText}`, { to: 'debug' })
  if (home !== null) {
    const id = await $.session.id()
    await $.fs.write(`${home}/.claude/state/mods/claim-ledger/${id}.json`, `${JSON.stringify({ loadedAt, lastError: null })}\n`)
  }
}

export const register: Register = (on, options) => {
  const optionsText = JSON.stringify({ tellModel: options.tellModel, testCommands: options.testCommands, buildCommands: options.buildCommands })

  on('session.start', async ($, e, next) => {
    await start($, optionsText)
    return next(e)
  })
}
