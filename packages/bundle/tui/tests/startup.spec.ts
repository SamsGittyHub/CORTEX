/**
 * The terminal app's ordinary command-line provider over a real Loader tree:
 * the first message, `--resume`, and `--no-color` become injected runner
 * config, while help and usage errors leave the consumer pending.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@cortex-ai/cordis'
import Loader from '@cortex-ai/cordis-plugin-loader'
import Include from '@cortex-ai/cordis-plugin-include'
import { internals as cmdlineInternals, provideCmdline } from '@cortex-ai/cortex-cmdline'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, TUI_STARTUP_SERVICE, type TuiStartupValues } from '../src/startup.ts'

/** What one boot of the fixture tree observed. */
interface Observed {
  exits: number[]
  out: string
  runnerConfig?: unknown
}

const disposers: (() => Promise<void>)[] = []
const tempDirs: string[] = []

afterEach(async () => {
  for (const dispose of disposers.splice(0)) await dispose()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  cmdlineInternals.stdout = process.stdout
  cmdlineInternals.stderr = process.stderr
})

/**
 * Mount the real provider over a runner stand-in.
 * @param args - the invocation's inner arguments.
 * @returns the resolved service value and the observed runner and process effects.
 */
async function bootStartup(args: string[]): Promise<{ values: TuiStartupValues | undefined; observed: Observed }> {
  const dir = mkdtempSync(join(tmpdir(), 'cortex-tui-startup-'))
  tempDirs.push(dir)
  const observed: Observed = { exits: [], out: '' }
  writeFileSync(join(dir, 'row.mjs'), 'export function apply(_ctx, config) { globalThis.__tuiStartupObserved.runnerConfig = config }\n')
  // Loader imports through Node's resolver, so this fixture delegates to the
  // source-plane plugin already imported by the test.
  writeFileSync(join(dir, 'startup.mjs'), `
export const name = 'tui-startup'
export const inject = ['cmdlineArgs']
export const apply = ctx => globalThis.__tuiStartupApply(ctx)
`)
  writeFileSync(join(dir, 'cordis.yml'), [
    '- id: tui-runner',
    `  name: ${pathToFileURL(join(dir, 'row.mjs')).href}`,
    `  inject: [${TUI_STARTUP_SERVICE}]`,
    '  config:',
    '    message: !!js ctx.tuiStartup.message',
    '    resume: !!js ctx.tuiStartup.resume',
    '    noColor: !!js ctx.tuiStartup.noColor',
    '- id: tui-startup',
    `  name: ${pathToFileURL(join(dir, 'startup.mjs')).href}`,
    '',
  ].join('\n'))
  const capture = { write: (chunk: string) => { observed.out += chunk; return true } }
  cmdlineInternals.stdout = capture
  cmdlineInternals.stderr = capture
  const globals = globalThis as unknown as { __tuiStartupApply: typeof apply; __tuiStartupObserved: Observed }
  globals.__tuiStartupApply = apply
  globals.__tuiStartupObserved = observed

  const ctx = new Context()
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  provideCmdline(ctx, { args, exit: code => void observed.exits.push(code) })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(join(dir, 'cordis.yml')).href } })
  await ctx.loader.await()
  disposers.push(async () => { await ctx.fiber.dispose() })
  return { values: ctx.get(TUI_STARTUP_SERVICE) as TuiStartupValues | undefined, observed }
}

describe('terminal app command-line provider', () => {
  it('starts an empty conversation with no arguments', async () => {
    const { values, observed } = await bootStartup([])
    expect(values).toEqual({ message: undefined, resume: undefined, noColor: false })
    expect(observed.runnerConfig).toMatchObject({ noColor: false })
    expect(observed.exits).toEqual([])
  })

  it('joins the message positional into the runner config', async () => {
    const { values, observed } = await bootStartup(['explain', 'this', 'repo'])
    expect(values).toEqual({ message: 'explain this repo', resume: undefined, noColor: false })
    expect(observed.runnerConfig).toMatchObject({ message: 'explain this repo' })
  })

  it('treats an all-whitespace message as no message', async () => {
    const { values } = await bootStartup(['  '])
    expect(values?.message).toBeUndefined()
  })

  it('publishes the exact Session identity and the plain-output switch', async () => {
    const { values, observed } = await bootStartup(['--resume', ' session-x ', '--no-color', '/plan', 'add', 'tests'])
    expect(values).toEqual({ message: '/plan add tests', resume: ' session-x ', noColor: true })
    expect(observed.runnerConfig).toMatchObject({ resume: ' session-x ', noColor: true })
  })

  it('rejects an empty Session identity', async () => {
    const { values, observed } = await bootStartup(['--resume', ''])
    expect(observed.out).toContain('--resume requires a non-empty session id')
    expect(values).toBeUndefined()
    expect(observed.runnerConfig).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })

  it('prints help that names /plan and provides nothing', async () => {
    const { values, observed } = await bootStartup(['--help'])
    expect(observed.out).toContain('/plan <task>')
    expect(observed.out).toContain('--resume <id>')
    expect(values).toBeUndefined()
    expect(observed.exits).toEqual([0])
  })

  it('rejects an unknown option', async () => {
    const { values, observed } = await bootStartup(['--bogus'])
    expect(observed.out).toContain("unknown option '--bogus'")
    expect(values).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })
})
