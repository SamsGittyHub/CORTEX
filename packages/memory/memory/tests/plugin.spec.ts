/**
 * The plugin over the real tool registry, command registry, and Session store:
 * capture from Session events, the session-start index, the four tools, and the
 * three commands. Only the Agent is a stand-in.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@cortex-ai/cordis'
import type { Agent } from '@cortex-ai/cortex-agent'
import CommandRuntime from '@cortex-ai/cortex-commands'
import { ToolCallId, createAssistantMessage, createToolResultMessage } from '@cortex-ai/cortex-llm'
import type { UserMessage } from '@cortex-ai/cortex-session'
import SessionStore, { Session, SessionId } from '@cortex-ai/cortex-session'
import SessionProjectionRegistry from '@cortex-ai/cortex-session-projection'
import SystemPrompt from '@cortex-ai/cortex-system-prompt'
import ToolRuntime from '@cortex-ai/cortex-tools'
import * as memory from '../src/index.ts'
import type { Config } from '../src/index.ts'

const live: Context[] = []
afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
})

const baseConfig: Config = {
  enabled: true,
  path: ':memory:',
  capture: true,
  injectContext: true,
  contextMaxEntries: 20,
  contextMaxChars: 4000,
  maxBodyChars: 300,
  searchLimit: 8,
  ignoreTools: ['noisy'],
}

async function setup(over: Partial<Config> = {}, options: { commands?: boolean } = {}) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SessionStore)
  if (options.commands !== false) await ctx.plugin(CommandRuntime)
  await ctx.plugin(memory, Object.assign({}, baseConfig, over))
  live.push(ctx)
  return ctx
}

function agentOf(ctx: Context, id = 's1', cwd: string | null = '/p', extra: Record<string, unknown> = {}) {
  // A detached Session has no working directory; a stored one always records one.
  const session = cwd === null ? Session.create(SessionId(id)) : ctx.sessions.create(SessionId(id), { meta: { cwd, ...extra } })
  const injected: UserMessage[] = []
  const agent = { id: session.id, session, inject: (message: UserMessage) => { injected.push(message) }, followup() {} } as unknown as Agent
  return { agent, session, injected }
}

let counter = 0
async function call(ctx: Context, name: string, args: unknown, agent?: Agent) {
  return ctx.tools.execute({
    signal: new AbortController().signal,
    callId: ToolCallId(`call-${String(++counter)}`),
    name,
    arguments: args,
    ...agent === undefined ? {} : { agent },
  })
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.map(block => block.text ?? '').join('')
}

const userMessage = (words: string): UserMessage => ({
  role: 'user', content: [{ type: 'text', text: words }], source: { kind: 'user' }, id: `m-${words}`,
}) as unknown as UserMessage

/** Emit the events of one turn the way the Session store publishes them. */
function turn(ctx: Context, session: unknown, options: { request: string; tool?: { name: string; args: string; result: string; failed?: boolean }; outcome: string; end?: 'completed' | 'aborted' }): void {
  const at = (type: string, data: unknown, surfaceOp: unknown = 'append'): void => {
    ctx.emit('session/event', session as never, { type, data, surfaceOp } as never)
  }
  at('turn/start', { turn: 1 })
  at('user/message', userMessage(options.request))
  if (options.tool !== undefined) {
    at('tool/call', { turn: 1, step: 1, callId: 'c1', name: options.tool.name, arguments: options.tool.args })
    at('tool/result', {
      turn: 1, step: 1,
      message: createToolResultMessage({ callId: ToolCallId('c1'), content: [{ type: 'text', text: options.tool.result }], isError: options.tool.failed === true }),
    })
  }
  at('assistant/message', {
    turn: 1, step: 1, stream: [],
    message: createAssistantMessage({ content: [{ type: 'text', text: options.outcome }], source: { provider: 'p', model: 'm' } }),
  })
  at('turn/end', { turn: 1, reason: options.end === 'aborted' ? { kind: 'aborted', reason: { kind: 'user' } } : { kind: 'completed' } })
}

describe('capture', () => {
  it('records each tool call and a summary of each completed turn, and searches them', async () => {
    const ctx = await setup()
    const { agent, session } = agentOf(ctx)
    turn(ctx, session, { request: 'fix the login bug', tool: { name: 'edit', args: '{"path":"src/auth.ts"}', result: 'patched the token refresh' }, outcome: 'Fixed it.' })
    const found = await call(ctx, 'memory_search', { query: 'token refresh' }, agent)
    expect(found.isError).toBe(false)
    expect(text(found)).toContain('edit path=src/auth.ts')
    const summary = await call(ctx, 'memory_search', { query: 'login' }, agent)
    expect(text(summary)).toContain('summary: fix the login bug')
    const full = await call(ctx, 'memory_get', { ids: [1, 2] }, agent)
    expect(text(full)).toContain('files: src/auth.ts')
    expect(text(full)).toContain('Request: fix the login bug Outcome: Fixed it.')
  })

  it('does not record interrupted turns, ignored tools, unmatched results, replayed results, or memory tools', async () => {
    const ctx = await setup()
    const { agent, session } = agentOf(ctx)
    turn(ctx, session, { request: 'stopped early', outcome: 'x', end: 'aborted' })
    turn(ctx, session, { request: 'run noisy thing', tool: { name: 'noisy', args: '{}', result: 'loud output' }, outcome: 'done' })
    turn(ctx, session, { request: 'search memory', tool: { name: 'memory_search', args: '{"query":"x"}', result: 'No matching memory.' }, outcome: 'done' })
    ctx.emit('session/event', session as never, { type: 'tool/result', surfaceOp: { op: 'replace' }, data: { message: createToolResultMessage({ callId: ToolCallId('zz'), content: [{ type: 'text', text: 'replayed' }], isError: false }) } } as never)
    ctx.emit('session/event', session as never, { type: 'tool/result', surfaceOp: 'append', data: { message: createToolResultMessage({ callId: ToolCallId('never-called'), content: [{ type: 'text', text: 'orphan' }], isError: false }) } } as never)
    ctx.emit('session/event', session as never, { type: 'turn/start', surfaceOp: 'append', data: { turn: 2 } } as never)
    ctx.emit('session/event', session as never, { type: 'turn/end', surfaceOp: 'append', data: { turn: 2, reason: { kind: 'completed' } } } as never)
    ctx.emit('session/event', session as never, { type: 'step/start', surfaceOp: 'append', data: { turn: 2, step: 1 } } as never)
    expect(text(await call(ctx, 'memory_search', { query: 'loud replayed orphan stopped', scope: 'all' }, agent))).toBe('No matching memory.')
    expect(text(await call(ctx, 'memory_search', { query: 'noisy' }, agent))).toContain('summary: run noisy thing')
  })

  it('records only what the user typed as the request and ignores assistant text without content', async () => {
    const ctx = await setup()
    const { agent, session } = agentOf(ctx)
    const at = (type: string, data: unknown): void => {
      ctx.emit('session/event', session as never, { type, data, surfaceOp: 'append' } as never)
    }
    at('turn/start', { turn: 1 })
    at('user/message', { ...userMessage('system context'), source: { kind: 'hooks-claude-code' } })
    at('user/message', userMessage('the real request'))
    at('user/message', userMessage('a second message'))
    at('assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({ content: [{ type: 'tool-call', id: 't', name: 'x', arguments: '{}' } as never], source: { provider: 'p', model: 'm' } }) })
    at('turn/end', { turn: 1, reason: { kind: 'completed' } })
    const hit = text(await call(ctx, 'memory_search', { query: 'real request' }, agent))
    expect(hit).toContain('summary: the real request')
    expect(hit).not.toContain('a second message')
    expect(text(await call(ctx, 'memory_get', { ids: [1] }, agent))).toContain('Outcome: none')
  })

  it('records a session that has no working directory under an empty project, and skips a fully private request', async () => {
    const ctx = await setup()
    const bare = agentOf(ctx, 's9', null)
    turn(ctx, bare.session, { request: 'no directory here', outcome: 'ok' })
    turn(ctx, bare.session, { request: '<private>all private</private>', outcome: 'ok' })
    expect(text(await call(ctx, 'memory_search', { query: 'directory', scope: 'all' }))).toContain('summary: no directory here')
    expect(text(await call(ctx, 'memory_search', { query: 'private', scope: 'all' }))).toBe('No matching memory.')
  })

  it('records nothing when capture is off, but tools and notes still work', async () => {
    const ctx = await setup({ capture: false })
    const { agent, session } = agentOf(ctx)
    turn(ctx, session, { request: 'invisible', outcome: 'x' })
    expect(text(await call(ctx, 'memory_search', { query: 'invisible' }, agent))).toBe('No matching memory.')
    const saved = await call(ctx, 'memory_save', { text: 'still remembered' }, agent)
    expect(text(saved)).toBe('Saved as memory #1.')
  })
})

describe('session-start index', () => {
  it('shows the model the project index as a logged message of its own source', async () => {
    const ctx = await setup()
    const first = agentOf(ctx, 's1')
    turn(ctx, first.session, { request: 'add a flag', outcome: 'Added.' })
    await call(ctx, 'memory_save', { text: 'use pnpm in this repo', title: 'tooling' }, first.agent)
    const second = agentOf(ctx, 's2')
    await ctx.serial('agent/created', { agent: second.agent, source: 'startup' } as never)
    expect(second.injected).toHaveLength(1)
    const message = second.injected[0] as UserMessage
    expect(message.source).toEqual({ kind: 'memory-context' })
    const body = (message.content[0] as { text: string }).text
    expect(body).toContain('Memory index for this project')
    expect(body).toContain('note: tooling')
    expect(body).toContain('summary: add a flag')
  })

  it('shows another project nothing, and does nothing on resume, for a subagent, or when the store is empty', async () => {
    const ctx = await setup()
    const first = agentOf(ctx, 's1')
    await call(ctx, 'memory_save', { text: 'only for /p' }, first.agent)
    const elsewhere = agentOf(ctx, 's2', '/other')
    await ctx.serial('agent/created', { agent: elsewhere.agent, source: 'startup' } as never)
    expect(elsewhere.injected).toEqual([])
    const resumed = agentOf(ctx, 's3')
    await ctx.serial('agent/created', { agent: resumed.agent, source: 'resume' } as never)
    expect(resumed.injected).toEqual([])
    const child = agentOf(ctx, 's4', '/p', { origin: 'subagent' })
    await ctx.serial('agent/created', { agent: child.agent, source: 'startup' } as never)
    expect(child.injected).toEqual([])
    const cleared = agentOf(ctx, 's5')
    await ctx.serial('agent/created', { agent: cleared.agent, source: 'clear' } as never)
    expect(cleared.injected).toHaveLength(1)
  })

  it('shows a session without a working directory nothing to inherit', async () => {
    const ctx = await setup()
    const bare = agentOf(ctx, 's1', null)
    await ctx.serial('agent/created', { agent: bare.agent, source: 'startup' } as never)
    expect(bare.injected).toEqual([])
  })

  it('injects nothing when the index is turned off', async () => {
    const ctx = await setup({ injectContext: false })
    const first = agentOf(ctx, 's1')
    await call(ctx, 'memory_save', { text: 'anything' }, first.agent)
    const second = agentOf(ctx, 's2')
    await ctx.serial('agent/created', { agent: second.agent, source: 'startup' } as never)
    expect(second.injected).toEqual([])
  })
})

describe('tools', () => {
  it('registers exactly the four memory tools', async () => {
    const ctx = await setup()
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual(['memory_get', 'memory_save', 'memory_search', 'memory_timeline'])
  })

  it('searches this project by default and every project on request', async () => {
    const ctx = await setup()
    const here = agentOf(ctx, 's1', '/a')
    const there = agentOf(ctx, 's2', '/b')
    await call(ctx, 'memory_save', { text: 'needle in a' }, here.agent)
    await call(ctx, 'memory_save', { text: 'needle in b' }, there.agent)
    expect(text(await call(ctx, 'memory_search', { query: 'needle' }, here.agent)).match(/note:/gu)).toHaveLength(1)
    expect(text(await call(ctx, 'memory_search', { query: 'needle', scope: 'all' }, here.agent)).match(/note:/gu)).toHaveLength(2)
    expect(text(await call(ctx, 'memory_search', { query: 'needle' }))).toContain('needle')
  })

  it('shows the entries around one entry and reports an unknown one', async () => {
    const ctx = await setup()
    const { agent, session } = agentOf(ctx)
    turn(ctx, session, { request: 'first ask', tool: { name: 'read', args: '{"path":"a.ts"}', result: 'contents of a' }, outcome: 'ok' })
    const around = await call(ctx, 'memory_timeline', { id: 2, before: 1, after: 1 }, agent)
    expect(text(around)).toContain('#1')
    expect(text(around)).toContain('#2')
    expect(text(await call(ctx, 'memory_timeline', { id: 2 }, agent))).toContain('#2')
    expect(text(await call(ctx, 'memory_timeline', { id: 999 }, agent))).toBe('No such memory entry.')
    expect(text(await call(ctx, 'memory_timeline', { id: 2, before: 500, after: -4 }, agent))).toContain('#2')
  })

  it('fetches at most ten entries and reports when none exist', async () => {
    const ctx = await setup()
    const { agent } = agentOf(ctx)
    for (let index = 0; index < 12; index++) await call(ctx, 'memory_save', { text: `note number ${String(index)}` }, agent)
    const many = text(await call(ctx, 'memory_get', { ids: Array.from({ length: 12 }, (_, i) => i + 1) }, agent))
    expect(many.match(/^#\d+ /gmu)).toHaveLength(10)
    expect(text(await call(ctx, 'memory_get', { ids: [500] }, agent))).toBe('No such memory entries.')
  })

  it('saves a note with and without an agent, and refuses one that is only private text', async () => {
    const ctx = await setup()
    const { agent } = agentOf(ctx)
    expect(text(await call(ctx, 'memory_save', { text: 'remember this', title: 'a title' }, agent))).toBe('Saved as memory #1.')
    expect(text(await call(ctx, 'memory_save', { text: 'no agent' }))).toBe('Saved as memory #2.')
    expect(text(await call(ctx, 'memory_save', { text: '<private>secret</private>' }, agent)))
      .toBe('Nothing was saved: the text was empty after private content was removed.')
    expect(text(await call(ctx, 'memory_search', { query: 'title', scope: 'all' }, agent))).toContain('a title')
  })

  it('describes each call for a card', async () => {
    const ctx = await setup()
    const tools = ctx.tools.schemas()
    expect(tools.every(schema => schema.description.length > 0)).toBe(true)
  })
})

describe('commands', () => {
  async function run(ctx: Context, agent: Agent, line: string) {
    const execution = await ctx.commands.execute(agent, line, [], new AbortController().signal)
    return execution?.result
  }

  it('lists recent memory, searches it, and says when there is none', async () => {
    const ctx = await setup()
    const { agent } = agentOf(ctx)
    expect(await run(ctx, agent, '/memory')).toEqual({ kind: 'success', text: 'No memory for this project yet.' })
    await run(ctx, agent, '/remember use pnpm in this repo')
    const listed = await run(ctx, agent, '/memory')
    expect(listed?.kind).toBe('success')
    expect(listed?.text).toContain('note: use pnpm in this repo')
    expect((await run(ctx, agent, '/memory pnpm'))?.text).toContain('#1')
    expect(await run(ctx, agent, '/memory zzzz')).toEqual({ kind: 'success', text: 'No matching memory.' })
  })

  it('remembers a note and rejects an empty one', async () => {
    const ctx = await setup()
    const { agent } = agentOf(ctx, 's1', null)
    expect(await run(ctx, agent, '/remember keep this')).toEqual({ kind: 'success', text: 'remembered as #1' })
    expect(await run(ctx, agent, '/remember')).toEqual({ kind: 'error', text: 'usage: /remember <text>' })
  })

  it('forgets an entry by id, with or without a hash, and rejects bad ids', async () => {
    const ctx = await setup()
    const { agent } = agentOf(ctx)
    await run(ctx, agent, '/remember one')
    await run(ctx, agent, '/remember two')
    expect(await run(ctx, agent, '/forget 1')).toEqual({ kind: 'success', text: 'forgot #1' })
    expect(await run(ctx, agent, '/forget #2')).toEqual({ kind: 'success', text: 'forgot #2' })
    expect(await run(ctx, agent, '/forget 2')).toEqual({ kind: 'error', text: 'no memory #2' })
    expect(await run(ctx, agent, '/forget abc')).toEqual({ kind: 'error', text: 'usage: /forget <id>' })
    expect(await run(ctx, agent, '/forget 0')).toEqual({ kind: 'error', text: 'usage: /forget <id>' })
  })

  it('unregisters its commands when the plugin is disposed and works without a command registry', async () => {
    const ctx = await setup()
    expect(ctx.commands.list(agentOf(ctx).agent).map(row => row.name)).toEqual(['forget', 'memory', 'remember'])
    const bare = await setup({}, { commands: false })
    expect(bare.tools.schemas().length).toBe(4)
  })
})

describe('enabled', () => {
  it('registers nothing and opens no database when off', async () => {
    const ctx = await setup({ enabled: false })
    expect(ctx.tools.schemas()).toEqual([])
    expect(ctx.commands.list(agentOf(ctx).agent)).toEqual([])
  })
})

describe('Config', () => {
  it('requires every field and rejects values out of range', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    expect(() => memory.Config(Object.assign({}, baseConfig, { searchLimit: 0 }))).toThrow()
    expect(() => memory.Config(Object.assign({}, baseConfig, { contextMaxChars: 10 }))).toThrow()
    expect(() => memory.Config({ path: ':memory:' } as never)).toThrow()
    expect(memory.Config(baseConfig)).toMatchObject({ path: ':memory:' })
    expect(memory.name).toBe('memory')
    expect(memory.TOOL_NAMES).toHaveLength(4)
    expect(memory.inject).toEqual(['tools'])
  })
})
