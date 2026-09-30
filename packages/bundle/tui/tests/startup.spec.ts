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
import { internals } from '../src/startup-internals.ts'

/** What one boot of the fixture tree observed. */
interface Observed {
  exits: number[]
  out: string
  runnerConfig?: unknown
}

const disposers: (() => Promise<void>)[] = []
const realInternals = { ...internals }
const catalog = { providers: () => ['anthropic', 'openai'], firstModel: (provider: string) => `${provider}-model` }
const tempDirs: string[] = []

afterEach(async () => {
  Object.assign(internals, realInternals)
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
async function bootStartup(
  args: string[],
  env: Record<string, string> = { DEEPSEEK_API_KEY: 'k' },
): Promise<{ values: TuiStartupValues | undefined; observed: Observed }> {
  internals.env = () => env
  internals.catalog = catalog
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
    '    notice: !!js ctx.tuiStartup.llm.missing ?? ""',
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

const deepseek = { provider: 'deepseek-official', model: 'deepseek-flash', providers: {}, source: 'DEEPSEEK_API_KEY' }

describe('terminal app command-line provider', () => {
  it('starts an empty conversation with no arguments', async () => {
    const { values, observed } = await bootStartup([])
    expect(values).toEqual({ message: undefined, resume: undefined, noColor: false, memory: true, llm: deepseek })
    expect(observed.runnerConfig).toMatchObject({ noColor: false })
    expect(observed.exits).toEqual([])
  })

  it('joins the message positional into the runner config', async () => {
    const { values, observed } = await bootStartup(['explain', 'this', 'repo'])
    expect(values).toEqual({ message: 'explain this repo', resume: undefined, noColor: false, memory: true, llm: deepseek })
    expect(observed.runnerConfig).toMatchObject({ message: 'explain this repo' })
  })

  it('treats an all-whitespace message as no message', async () => {
    const { values } = await bootStartup(['  '])
    expect(values?.message).toBeUndefined()
  })

  it('publishes the exact Session identity and the plain-output switch', async () => {
    const { values, observed } = await bootStartup(['--resume', ' session-x ', '--no-color', '/plan', 'add', 'tests'])
    expect(values).toEqual({ message: '/plan add tests', resume: ' session-x ', noColor: true, memory: true, llm: deepseek })
    expect(observed.runnerConfig).toMatchObject({ resume: ' session-x ', noColor: true })
  })

  it('turns memory off for the run with --no-memory', async () => {
    const { values } = await bootStartup(['--no-memory'])
    expect(values).toEqual({ message: undefined, resume: undefined, noColor: false, memory: false, llm: deepseek })
  })

  it('follows the API key that is set, and passes a warning to the runner when there is none', async () => {
    const keyed = await bootStartup([], { ANTHROPIC_API_KEY: 'k' })
    expect(keyed.values?.llm).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-6' })
    const bare = await bootStartup([], {})
    expect(bare.values?.llm.missing).toContain('no API key found')
    expect((bare.observed.runnerConfig as { notice: string }).notice).toContain('no API key found')
  })

  it('takes --provider, --model, --base-url and --api-key-env', async () => {
    const chosen = await bootStartup(['--provider', 'openai', '--model', 'gpt-5-mini'], { OPENAI_API_KEY: 'k' })
    expect(chosen.values?.llm).toMatchObject({ provider: 'openai', model: 'gpt-5-mini' })
    const endpoint = await bootStartup(['--base-url', 'http://x/v1', '--model', 'm', '--api-key-env', 'GW'], { GW: 'k' })
    expect(endpoint.values?.llm).toMatchObject({ provider: 'custom', model: 'm' })
  })

  it.each([
    [['--provider', 'openai'], {}, 'no API key for openai'],
    [['--provider', 'nope'], {}, 'unknown provider "nope"'],
    [['--base-url', 'http://x'], {}, '--base-url needs a model'],
  ])('reports %j as a usage error', async (args, env, message) => {
    const { values, observed } = await bootStartup(args, env)
    expect(observed.out).toContain(message)
    expect(values).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })

  it('rethrows an unexpected failure while choosing the route', () => {
    internals.env = () => { throw new Error('env exploded') }
    const ctx = new Context()
    provideCmdline(ctx, { args: [], exit: () => {} })
    expect(() => { apply(ctx) }).toThrow('env exploded')
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
    expect(observed.out).toContain('--no-memory')
    expect(observed.out).toContain('/remember <x>')
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
