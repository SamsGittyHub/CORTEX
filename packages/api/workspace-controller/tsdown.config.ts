import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@cortex-ai/cortex-api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
