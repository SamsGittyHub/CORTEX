/** Private and secret-shaped text never reaches the database. */

import { describe, expect, it } from 'vitest'
import { REDACTED, scrub } from '../src/privacy.ts'

describe('scrub', () => {
  it('removes private blocks, including across lines and in any case', () => {
    expect(scrub('keep <private>hide</private> keep')).toBe('keep  keep')
    expect(scrub('a<PRIVATE>x\ny</Private>b')).toBe('ab')
  })

  it('removes everything after an unclosed private tag', () => {
    expect(scrub('keep <private>hide forever')).toBe('keep ')
  })

  it.each([
    'sk-abcdefghijklmnop1234',
    'ghp_abcdefghijklmnopqrstuvwx',
    'AKIAABCDEFGHIJKLMNOP',
    'Bearer abcdefghijklmnop.qrstuv',
    'api_key=abcd1234efgh',
    'password: "hunter2hunter2"',
  ])('replaces the credential-shaped string %s', (secret) => {
    expect(scrub(`use ${secret} now`)).toBe(`use ${REDACTED} now`)
  })

  it('leaves ordinary text alone', () => {
    expect(scrub('the token budget is small')).toBe('the token budget is small')
  })
})
