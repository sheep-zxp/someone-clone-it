import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getMainLoopModel, renderModelName } from '../../utils/model/model.js'
import { getEffectiveProviderLabel } from '../../utils/model/providers.js'

export default {
  type: 'local-jsx',
  name: 'model',
  get description() {
    return `Set the AI model for Claude Code (provider: ${getEffectiveProviderLabel()}, current: ${renderModelName(getMainLoopModel())})`
  },
  argumentHint: '[model]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./model.js'),
} satisfies Command
