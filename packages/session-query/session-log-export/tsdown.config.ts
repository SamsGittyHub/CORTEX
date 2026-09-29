import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@cortex-ai/cortex-session-log-export',
  ['lib/types/index.js'],
  { hostPhase: true },
)
