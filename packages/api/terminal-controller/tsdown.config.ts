import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@cortex-ai/cortex-api-terminal-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
