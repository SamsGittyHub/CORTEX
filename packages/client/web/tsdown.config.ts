import { staticLinked } from '../tsdown.client.ts'

export default staticLinked(
  '@cortex-ai/cortex-client-web',
  ['lib/types/index.js', 'lib/types/apply-injections.js'],
)
