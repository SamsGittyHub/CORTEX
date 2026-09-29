import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@cortex-ai/cortex-client-modules',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
