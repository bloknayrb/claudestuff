import type { Register } from 'claude-code'
import { current, parseConfig, shapeOf } from './config'

export const register: Register = (on, options) => {
  current.cfg = parseConfig(options)
  current.shapes = `heavyModels ${shapeOf(options['heavyModels'])}, guardTypes ${shapeOf(options['guardTypes'])}`

  on('session.start', async ($, e, next) => {
    $.ui.log(`quartermaster: list options arrived as ${current.shapes}`, { to: 'debug' })
    return next(e)
  })
}
