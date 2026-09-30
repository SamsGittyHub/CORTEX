/**
 * Boots the plugin from a cordis.yml through the real Loader: the config block
 * is validated by the schema, the tools register, a bad value fails at load,
 * and a saved note survives into a second boot that reads the same file.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@cortex-ai/cordis'
import Loader from '@cortex-ai/cordis-plugin-loader'
import Include from '@cortex-ai/cordis-plugin-include'
import { ToolCallId } from '@cortex-ai/cortex-llm'
import SystemPrompt from '@cortex-ai/cortex-system-prompt'
import ToolRuntime from '@cortex-ai/cortex-tools'
import * as Memory from '../src/index.ts'

let root: string | undefined
const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function boot(configLines: readonly string[]): Promise<Context> {
  root ??= await mkdtemp(join(tmpdir(), 'cortex-memory-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@cortex-ai/cortex-system-prompt'",
    "- name: '@cortex-ai/cortex-tools'",
    "- name: '@cortex-ai/cortex-memory'",
    '  config:',
    ...configLines,
    '',
  ].join('\n'))
  const ctx = new Context()
  contexts.push(ctx)
  ctx.baseUrl = `${pathToFileURL(root).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@cortex-ai/cortex-system-prompt', SystemPrompt],
    ['@cortex-ai/cortex-tools', ToolRuntime],
    ['@cortex-ai/cortex-memory', Memory],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return ctx
}

function block(path: string, override: Record<string, string> = {}): string[] {
  const fields: Record<string, string> = {
    enabled: 'true', path: JSON.stringify(path), capture: 'true', injectContext: 'true', contextMaxEntries: '20', contextMaxChars: '4000',
    maxBodyChars: '300', searchLimit: '8', ignoreTools: '[]', ...override,
  }
  return Object.entries(fields).map(([key, value]) => `    ${key}: ${value}`)
}

async function save(ctx: Context, words: string) {
  return ctx.tools.execute({ signal: new AbortController().signal, callId: ToolCallId(`c-${words}`), name: 'memory_save', arguments: { text: words } })
}

describe('memory through a real Loader boot', () => {
  it('registers the tools from a cordis.yml block and keeps notes across boots', async () => {
    root = await mkdtemp(join(tmpdir(), 'cortex-memory-loader-'))
    const path = join(root, 'data', 'memory.db')
    const first = await boot(block(path))
    expect(first.tools.schemas().map(schema => schema.name).sort()).toEqual(['memory_get', 'memory_save', 'memory_search', 'memory_timeline'])
    expect((await save(first, 'durable fact about pnpm')).isError).toBe(false)
    await first.fiber.dispose()
    contexts.length = 0

    const second = await boot(block(path))
    const found = await second.tools.execute({ signal: new AbortController().signal, callId: ToolCallId('s'), name: 'memory_search', arguments: { query: 'pnpm', scope: 'all' } })
    expect(found.isError).toBe(false)
    expect(found.content.map(part => (part as { text?: string }).text ?? '').join('')).toContain('durable fact about pnpm')
  })

  it('fails at load for a value out of range instead of running with a default', async () => {
    await expect(boot(block(':memory:', { searchLimit: '0' }))).rejects.toThrow('$.searchLimit expected number >= 1')
  })
})
