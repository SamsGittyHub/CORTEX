/** The default process facts the startup provider reads. */

import { describe, expect, it } from 'vitest'
import { internals } from '../src/startup-internals.ts'

describe('startup internals', () => {
  it('reads the real environment and the pi-ai catalog', () => {
    expect(internals.env()).toBe(process.env)
    expect(internals.catalog.providers()).toContain('openai')
  })
})
