/**
 * The interactive runner over the real Session, Agent, and command registries
 * around a small scripted Agent: typed messages become turns, streamed replies
 * and tool activity reach the terminal, `/plan` runs through the shared command
 * registry, approvals and questions are answered in the terminal, and resume
 * and failure paths exit with the right code.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@cortex-ai/cordis'
import { brandString } from '@cortex-ai/cortex-brand'
import AgentRegistry from '@cortex-ai/cortex-agent'
import type { Agent, AgentHandle, CreateAgentOptions, ResumeAgentOptions } from '@cortex-ai/cortex-agent'
import AgentDefaultModelConfig from '@cortex-ai/cortex-agent-default-model'
import CommandRuntime from '@cortex-ai/cortex-commands'
import {
  LlmAttemptId, ToolCallId, createAssistantMessage, createToolResultMessage, type StreamChunk,
} from '@cortex-ai/cortex-llm'
import { scopeTarget } from '@cortex-ai/cortex-scope'
import SessionStore from '@cortex-ai/cortex-session'
import SessionProjectionRegistry from '@cortex-ai/cortex-session-projection'
import type { Session, SessionId, UserMessage } from '@cortex-ai/cortex-session'
import { SessionQueryError } from '@cortex-ai/cortex-session-query'
import { createInboxStub } from '@cortex-ai/cortex-agent-loop-testkit'
import { apply } from '../src/index.ts'
import type { Config } from '../src/index.ts'
import { internals } from '../src/runner-internals.ts'
import type { TerminalIo } from '../src/repl.ts'

const originalInternals = { ...internals }
afterEach(() => { Object.assign(internals, originalInternals) })

interface Script {
  afterPrompt(session: Session, message: UserMessage, agent: Agent): Promise<void> | void
}

interface BenchOptions {
  lines: (string | undefined)[]
  config?: Config
  observe?: () => Promise<{ header: Record<string, unknown>; events: readonly { type: string }[]; [Symbol.dispose](): void }>
  noPersistence?: boolean
  noCommands?: boolean
  omitSessionQuery?: boolean
  color?: boolean
  /** Environment the runner reads, for example `COLORTERM` or `NO_COLOR`. */
  env?: Record<string, string>
  /** Fake timers, to drive the status animation. */
  fakeTimers?: boolean
  /** Provider-resolved cwd, which can differ from the host launch directory. */
  filesystemCwd?: string
}

const frames = new WeakMap<Agent, { attemptId: ReturnType<typeof LlmAttemptId>; revision: number; index: number }>()

function startFrames(agent: Agent): void {
  const state = { attemptId: LlmAttemptId(`${agent.id}:test`), revision: 1, index: 0 }
  frames.set(agent, state)
  agent.ctx.emit('agent/assistant-stream', {
    agent, frame: { type: 'start', attemptId: state.attemptId, revision: state.revision, turn: 1, step: 1 },
  })
}

function emitChunk(agent: Agent, chunk: StreamChunk): void {
  const state = frames.get(agent) as NonNullable<ReturnType<typeof frames.get>>
  agent.ctx.emit('agent/assistant-stream', {
    agent,
    frame: { type: 'chunk', attemptId: state.attemptId, revision: ++state.revision, index: state.index++, time: Date.now(), chunk },
  })
}

function endFrames(agent: Agent, outcome: 'abandoned' | 'committed'): void {
  const state = frames.get(agent) as NonNullable<ReturnType<typeof frames.get>>
  agent.ctx.emit('agent/assistant-stream', {
    agent,
    frame: {
      type: 'end', attemptId: state.attemptId, revision: state.revision, index: state.index,
      outcome: outcome === 'abandoned' ? { kind: 'abandoned' } : { kind: 'committed', eventType: 'assistant/message', seq: 0 as never },
    },
  })
}

function appendTurn(session: Session, message: UserMessage, text: string, reason: 'completed' | 'error' | 'aborted' = 'completed'): void {
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('user/message', message, { surfaceOp: 'append' })
  session.append('assistant/message', {
    stream: [], turn: 1, step: 1,
    message: createAssistantMessage({ content: [{ type: 'text', text }], source: { provider: 'test-provider', model: 'test-model' } }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', {
    turn: 1,
    reason: reason === 'completed'
      ? { kind: 'completed' }
      : reason === 'error'
        ? { kind: 'error', error: { code: 'E_TEST', message: 'model failed' } }
        : { kind: 'aborted', reason: { kind: 'user' } },
  } as never)
}

async function bench(script: Script, options: BenchOptions) {
  const ctx = new Context()
  const output: string[] = []
  const errors: string[] = []
  const prompts: string[] = []
  const flushes: string[] = []
  const queue = [...options.lines]
  let interrupt: (() => void) | undefined
  const term: TerminalIo = {
    async readLine(prompt) { prompts.push(prompt); return queue.shift() },
    out(text) { output.push(text) },
    onInterrupt(handler) { interrupt = handler; return () => {} },
    close() {},
  }
  let completer: ((line: string) => readonly string[]) | undefined
  internals.openTerminal = (complete) => { completer = complete; return term }
  let clock = 1000
  const intervals = new Map<number, () => void>()
  if (options.fakeTimers === true) {
    internals.timers = {
      now: () => clock,
      setInterval: (callback) => { intervals.set(intervals.size + 1, callback); return intervals.size },
      clearInterval: (handle) => { intervals.delete(handle as number) },
    }
  }
  internals.writeErr = (text) => { errors.push(text); return true }
  internals.stdoutIsTty = () => options.color === true
  internals.env = () => options.env ?? {}

  const mount = async (ownerCtx: Context, session: Session, createOptions: CreateAgentOptions | ResumeAgentOptions): Promise<Agent> => {
    const inbox = createInboxStub()
    let idle = Promise.resolve()
    const agent: Agent = {
      id: session.id,
      options: createOptions.agentOptions ?? {},
      session,
      inbox,
      status: 'idle',
      ctx: ownerCtx,
      cancel: () => { flushes.push('cancel') },
      runMaintenance: () => Promise.reject(new Error('not used')),
      send: () => {},
      followup: (message: UserMessage) => {
        idle = Promise.resolve().then(() => script.afterPrompt(session, message, agent))
      },
      steer: () => {},
      inject: () => {},
      whenIdle: () => idle,
    }
    await createOptions.setup?.(ownerCtx, agent)
    await ctx.agents.register(agent)
    return agent
  }

  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentDefaultModelConfig, { provider: 'test-provider', model: 'test-model' })
  if (options.noCommands !== true) await ctx.plugin(CommandRuntime)
  ctx.agents.setFactory({
    async createAgent(ownerCtx: Context, createOptions: CreateAgentOptions): Promise<AgentHandle> {
      const meta = createOptions.meta === undefined ? {} : { meta: createOptions.meta }
      const session = ctx.sessions.create(createOptions.sessionId, meta)
      return { agent: await mount(ownerCtx, session, createOptions), dispose: () => Promise.resolve() }
    },
    async resume(ownerCtx: Context, resumeOptions: ResumeAgentOptions): Promise<AgentHandle> {
      const session = ctx.sessions.get(resumeOptions.resumeSessionId)
      if (session === undefined) throw new Error(`no attached Session ${resumeOptions.resumeSessionId}`)
      return { agent: await mount(ownerCtx, session, resumeOptions), dispose: () => Promise.resolve() }
    },
  })
  if (options.config?.resume !== undefined && options.omitSessionQuery !== true) {
    const observe = options.observe ?? (() => Promise.reject(new SessionQueryError('missing', 'SESSION_QUERY_SESSION_NOT_FOUND')))
    ctx.provide('sessionQuery', { observeSession: () => observe() } as never)
  }
  if (options.noPersistence !== true) ctx.provide('sessionPersistence', {} as never)
  if (options.filesystemCwd !== undefined) {
    const cwd = options.filesystemCwd
    ctx.provide('fs', { resolve: async () => ({ targetKey: cwd, displayPath: cwd }), processPath: () => cwd } as never)
  }
  ctx.on('session/flush', () => { flushes.push('flush') })
  return {
    ctx,
    prompts,
    interrupt: () => { interrupt?.() },
    complete: (line: string) => completer?.(line) ?? [],
    advance: (ms: number) => { clock += ms },
    tick: () => { for (const callback of intervals.values()) callback() },
    cancelled: () => flushes.filter(entry => entry === 'cancel').length,
    async run(): Promise<{ code: number; out: string; err: string; flushes: string[] }> {
      const exited = new Promise<number>((resolve) => { ctx.provide('appExit', (code: number) => { resolve(code) }) })
      apply(ctx, options.config ?? {})
      const code = await exited
      return { code, out: output.join(''), err: errors.join(''), flushes }
    },
  }
}

const noConfig: Config = {}

describe('tui runner', () => {
  it('prints a plain banner, submits a typed message, and streams the reply with tool activity', async () => {
    const test = await bench({
      async afterPrompt(session, message, agent) {
        session.append('turn/start', { turn: 1 })
        session.append('step/start', { turn: 1, step: 1 })
        session.append('user/message', message, { surfaceOp: 'append' })
        startFrames(agent)
        emitChunk(agent, { type: 'block-start', index: 0, blockType: 'reasoning' })
        emitChunk(agent, { type: 'reasoning-delta', index: 0, text: '' })
        emitChunk(agent, { type: 'reasoning-delta', index: 0, text: 'hmm' })
        emitChunk(agent, { type: 'reasoning-delta', index: 0, text: ' more' })
        emitChunk(agent, { type: 'text-delta', index: 1, text: 'Looking at ' })
        emitChunk(agent, { type: 'text-delta', index: 1, text: 'the repo.' })
        emitChunk(agent, { type: 'block-end', index: 1, block: { type: 'text', text: 'Looking at the repo.' } })
        emitChunk(agent, { type: 'tool-call-delta', index: 2, id: ToolCallId('c1'), name: 'read', argumentsDelta: '{}' })
        emitChunk(agent, { type: 'usage', usage: { inputTokens: 1, outputTokens: 2 } })
        emitChunk(agent, { type: 'finish', reason: 'stop' as never })
        endFrames(agent, 'committed')
        session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('c1'), name: 'read', arguments: '{"path":"a.ts"}' })
        session.append('tool/result', {
          turn: 1, step: 1,
          message: createToolResultMessage({ callId: ToolCallId('c1'), content: [{ type: 'text', text: 'line1\nline2' }], isError: false }),
        }, { surfaceOp: 'append' })
        session.append('tool/call', { turn: 1, step: 2, callId: ToolCallId('c2'), name: 'bash', arguments: '{"command":"false"}' })
        session.append('tool/result', {
          turn: 1, step: 2,
          message: createToolResultMessage({ callId: ToolCallId('c2'), content: [{ type: 'text', text: 'exit 1' }], isError: true }),
        }, { surfaceOp: 'append' })
        session.append('step/end', { turn: 1, step: 2 })
        session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      },
    }, { lines: ['read the repo', undefined], config: noConfig })
    try {
      const result = await test.run()
      expect(result.err).toBe('')
      expect(result.code).toBe(0)
      expect(result.out).toContain('◈ CORTEX  ━━━━━━━━━━━━━━━\n  model test-model')
      expect(result.out).toContain('/plan <task> plans first')
      expect(result.out).toContain('Looking at the repo.\n┃ ◉ read path=a.ts\n')
      expect(result.out).toContain('┃   ⎿ line1…\n')
      expect(result.out).toContain('┃ ▲ bash command=false\n┃   ⎿ error: exit 1\n')
      expect(result.out).toMatch(/└─ \d+ms · 1 step {2}◉1 ▲1\n/u)
      expect(result.out).not.toContain('thought for')
      expect(result.out).toMatch(/resume with: cortex --profile tui --resume session-/u)
      expect(result.flushes).toEqual(['flush'])
      expect(test.prompts).toEqual(['› ', '› '])
    } finally { await test.ctx.fiber.dispose() }
  })

  it('shows an abandoned attempt as a retry and reports how a turn failed or was interrupted', async () => {
    const test = await bench({
      async afterPrompt(session, message, agent) {
        startFrames(agent)
        emitChunk(agent, { type: 'text-delta', index: 0, text: 'partial' })
        endFrames(agent, 'abandoned')
        appendTurn(session, message, 'ok', message.content[0]?.type === 'text' && message.content[0].text === 'fail' ? 'error' : 'aborted')
      },
    }, { lines: ['fail', undefined], config: noConfig })
    try {
      const result = await test.run()
      expect(result.out).toContain('partial\n(retrying)\n')
      expect(result.out).toContain('error: E_TEST: model failed\n')
    } finally { await test.ctx.fiber.dispose() }

    const interrupted = await bench({
      afterPrompt(session, message) { appendTurn(session, message, 'x', 'aborted') },
    }, { lines: ['go', undefined], config: noConfig })
    try { expect((await interrupted.run()).out).toContain('(interrupted)\n') }
    finally { await interrupted.ctx.fiber.dispose() }
  })

  it('sends a first message from the launch options before the first prompt', async () => {
    const seen: string[] = []
    const test = await bench({
      afterPrompt(session, message) {
        seen.push(message.content[0]?.type === 'text' ? message.content[0].text : '')
        appendTurn(session, message, 'done')
      },
    }, { lines: [undefined], config: { message: 'explain this repo' } })
    try {
      expect((await test.run()).code).toBe(0)
      expect(seen).toEqual(['explain this repo'])
      expect(test.prompts).toEqual(['› '])
    } finally { await test.ctx.fiber.dispose() }
  })

  it('runs /plan through the shared command registry and waits for the turn it starts', async () => {
    const seen: string[] = []
    const test = await bench({
      afterPrompt(session, message) {
        seen.push(message.content[0]?.type === 'text' ? message.content[0].text : '')
        appendTurn(session, message, 'planned')
      },
    }, { lines: ['/help', '/plan add tests', '/plan off', '/nope', undefined], config: noConfig })
    test.ctx.commands.register({
      name: 'plan',
      description: 'plan before acting',
      handler: ({ agent, rawInput }) => {
        if (rawInput.trim() === 'off') return { kind: 'success', text: 'plan mode off' }
        agent.followup({
          role: 'user', content: [{ type: 'text', text: rawInput.trim() }], source: { kind: 'user' },
          id: brandString('plan-message'),
        } as UserMessage)
        return { kind: 'success', text: 'plan mode on' }
      },
    })
    try {
      const result = await test.run()
      expect(result.out).toContain('/plan     plan before acting')
      expect(result.out).toContain('plan mode on\n')
      expect(result.out).toContain('plan mode off\n')
      expect(result.out).toContain('unknown command: /nope (try /help)\n')
      expect(seen).toEqual(['add tests'])
    } finally { await test.ctx.fiber.dispose() }
  })

  it('reports an unavailable command registry instead of failing', async () => {
    const test = await bench({ afterPrompt() {} }, { lines: ['/plan x', '/help', undefined], config: noConfig, noCommands: true })
    try {
      const result = await test.run()
      expect(result.code).toBe(0)
      expect(result.out).toContain('commands are not available in this composition\n')
      expect(result.out).toContain('/exit')
    } finally { await test.ctx.fiber.dispose() }
  })

  it('answers approval and question requests in the terminal', async () => {
    let approval: unknown
    let answer: unknown
    const test = await bench({
      async afterPrompt(session, message, agent) {
        const unanswered = () => Promise.reject(new Error('no answerer'))
        approval = await agent.ctx.waterfall(scopeTarget(agent, agent), 'approval/request', { agent, toolName: 'bash', reason: 'runs a command' }, unanswered)
        answer = await agent.ctx.waterfall(scopeTarget(agent, agent), 'user-questions/request', {
          agent,
          questions: [{ id: 'plan-review', question: 'Approve this plan?', options: [{ label: 'Approve' }, { label: 'Keep planning' }] }],
        }, unanswered)
        appendTurn(session, message, 'ok')
      },
    }, { lines: ['do it', 'y', '1', undefined], config: noConfig })
    try {
      const result = await test.run()
      expect(approval).toBe('allowed-once')
      expect(answer).toEqual({ answers: [{ id: 'plan-review', selected: ['Approve'] }] })
      expect(result.out).toContain('approval needed')
      expect(result.out).toContain('Approve this plan?')
    } finally { await test.ctx.fiber.dispose() }
  })

  it('colors output only when the terminal asks for it', async () => {
    const test = await bench({ afterPrompt() {} }, { lines: [undefined], config: noConfig, color: true })
    try { expect((await test.run()).out).toContain('\u001b[1mCORTEX\u001b[22m') }
    finally { await test.ctx.fiber.dispose() }
    const flagged = await bench({ afterPrompt() {} }, { lines: [undefined], config: { noColor: true }, color: true })
    try { expect((await flagged.run()).out).not.toContain('\u001b[') }
    finally { await flagged.ctx.fiber.dispose() }
  })

  it('shows session facts and stats, and reports that colors are off in a plain terminal', async () => {
    const test = await bench({
      afterPrompt(session, message) { appendTurn(session, message, 'ok') },
    }, { lines: ['hi', '/session', '/stats', '/theme', '/clear', undefined], config: noConfig })
    try {
      const result = await test.run()
      expect(result.out).toContain('  model    test-model')
      expect(result.out).toContain('  theme    cortex')
      expect(result.out).toMatch(/resume {3}cortex --profile tui --resume session-/u)
      expect(result.out).toContain('turns   1 · 1 steps')
      expect(result.out).toContain('colors are off')
      expect(result.out).not.toContain('\u001b[2J')
    } finally { await test.ctx.fiber.dispose() }
  })

  it('cycles and selects themes, rejects an unknown one, and clears the screen on a terminal', async () => {
    const test = await bench({ afterPrompt() {} }, {
      lines: ['/theme', '/theme MONO', '/theme nope', '/theme aurora', '/session', '/clear', undefined],
      config: noConfig,
      color: true,
    })
    try {
      const result = await test.run()
      expect(result.out).toContain('theme \u001b[1maurora')
      expect(result.out).toContain('theme \u001b[1mmono')
      expect(result.out).toContain('unknown theme "nope"')
      expect(result.out).toContain('(cortex, aurora, ember, mono)')
      expect(result.out).toContain('theme   \u001b[22m aurora')
      expect(result.out).toContain('\u001b[2J\u001b[3J\u001b[H')
    } finally { await test.ctx.fiber.dispose() }
  })

  it('wraps a theme name after the last palette', async () => {
    const test = await bench({ afterPrompt() {} }, { lines: ['/theme mono', '/theme', undefined], config: noConfig, color: true })
    try { expect((await test.run()).out).toContain('theme \u001b[1mcortex') }
    finally { await test.ctx.fiber.dispose() }
  })

  it('uses truecolor when the terminal advertises it', async () => {
    const test = await bench({ afterPrompt() {} }, { lines: [undefined], config: noConfig, color: true, env: { COLORTERM: 'truecolor' } })
    try { expect((await test.run()).out).toContain('\u001b[38;2;167;139;250m◈') }
    finally { await test.ctx.fiber.dispose() }
  })

  it('shows the plan-mode prompt while the Session log says plan mode is on', async () => {
    const test = await bench({
      afterPrompt(session, message) {
        session.append('plan/mode', { active: true })
        appendTurn(session, message, 'planning')
        session.append('plan/mode', { active: false })
      },
    }, { lines: ['go', 'again', undefined], config: noConfig })
    try {
      const result = await test.run()
      expect(result.out).toContain('▤ plan mode on\n')
      expect(result.out).toContain('▤ plan mode off\n')
      expect(test.prompts).toEqual(['› ', '› ', '› '])
    } finally { await test.ctx.fiber.dispose() }
  })

  it('switches the prompt to plan mode between turns', async () => {
    const test = await bench({
      afterPrompt(session, message) { appendTurn(session, message, 'planning') },
    }, { lines: ['/plan on', 'next', undefined], config: noConfig })
    test.ctx.commands.register({
      name: 'plan',
      description: 'plan before acting',
      handler: ({ agent }) => {
        agent.session.append('plan/mode', { active: true })
        return { kind: 'success' }
      },
    })
    try {
      await test.run()
      expect(test.prompts).toEqual(['› ', '▤ plan › ', '▤ plan › '])
    } finally { await test.ctx.fiber.dispose() }
  })

  it('completes slash commands from the terminal and the command registry', async () => {
    const test = await bench({ afterPrompt() {} }, { lines: [undefined], config: noConfig })
    test.ctx.commands.register({ name: 'plan', description: 'plan before acting', handler: () => ({ kind: 'success' }) })
    try {
      await test.run()
      expect(test.complete('/p')).toEqual(['/plan'])
      expect(test.complete('/st')).toEqual(['/stats'])
      expect(test.complete('hello')).toEqual([])
    } finally { await test.ctx.fiber.dispose() }
  })

  it('animates a status line with elapsed time on a terminal and reports token usage', async () => {
    const test = await bench({
      afterPrompt(session, message) {
        session.append('turn/start', { turn: 1 })
        session.append('step/start', { turn: 1, step: 1 })
        session.append('user/message', message, { surfaceOp: 'append' })
        test.advance(1500)
        test.tick()
        session.append('assistant/message', {
          stream: [], turn: 1, step: 1,
          message: createAssistantMessage({ content: [{ type: 'text', text: 'done' }], source: { provider: 'test-provider', model: 'test-model' } }),
          usage: { inputTokens: 1200, outputTokens: 300 },
        }, { surfaceOp: 'append' })
        session.append('step/end', { turn: 1, step: 1 })
        session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      },
    }, { lines: ['go', undefined], config: noConfig, color: true, fakeTimers: true })
    try {
      const result = await test.run()
      expect(result.out).toContain('\r\u001b[2K')
      expect(result.out).toContain('synapsing… 1.5s')
      expect(result.out).toContain('1.2k in · 300 out')
    } finally { await test.ctx.fiber.dispose() }
  })

  it('cancels the active turn and its command signal on Ctrl-C', async () => {
    const gate = Promise.withResolvers<undefined>()
    const test = await bench({
      async afterPrompt(session, message) {
        await gate.promise
        appendTurn(session, message, 'late', 'aborted')
      },
    }, { lines: ['long task', undefined], config: noConfig })
    const running = test.run()
    await new Promise(resolve => setTimeout(resolve, 10))
    test.interrupt()
    gate.resolve(undefined)
    try {
      const result = await running
      expect(result.code).toBe(0)
      expect(test.cancelled()).toBe(1)
      expect(result.out).toContain('(interrupted)')
    } finally { await test.ctx.fiber.dispose() }
  })

  it('records the Session in the filesystem provider working directory', async () => {
    const test = await bench({ afterPrompt() {} }, { lines: [undefined], config: noConfig, filesystemCwd: '/remote/workspace' })
    try { expect((await test.run()).out).toContain('dir /remote/workspace') }
    finally { await test.ctx.fiber.dispose() }
  })

  it('ignores activity of other Agents and Sessions, empty text, and replayed tool results', async () => {
    const test = await bench({
      async afterPrompt(session, message, agent) {
        const other = { ...agent, id: brandString<SessionId>('session-other') } as Agent
        startFrames(other)
        emitChunk(other, { type: 'text-delta', index: 0, text: 'from another agent' })
        const foreign = agent.ctx.sessions.create(brandString<SessionId>('session-foreign'), {})
        foreign.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('f1'), name: 'foreign_tool', arguments: '{}' })
        startFrames(agent)
        emitChunk(agent, { type: 'text-delta', index: 0, text: '' })
        emitChunk(agent, { type: 'text-delta', index: 0, text: 'mine' })
        endFrames(agent, 'committed')
        session.append('turn/start', { turn: 1 })
        session.append('step/start', { turn: 1, step: 1 })
        session.append('user/message', message, { surfaceOp: 'append' })
        session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('c1'), name: 'read', arguments: '{}' })
        session.append('tool/result', {
          turn: 1, step: 1,
          message: createToolResultMessage({ callId: ToolCallId('c1'), content: [{ type: 'text', text: 'first result' }], isError: false }),
        }, { surfaceOp: 'append' })
        // Compaction publishes replacement events for older results; they are history, not this turn's output.
        const compacted = { type: 'tool/result', surfaceOp: { op: 'replace', startSeq: 0, endSeq: 0 }, data: {
          turn: 1, step: 1,
          message: createToolResultMessage({ callId: ToolCallId('c1'), content: [{ type: 'text', text: 'compacted result' }], isError: false }),
        } }
        agent.ctx.emit('session/event', session, compacted as never)
        session.append('tool/call', { turn: 1, step: 2, callId: ToolCallId('c3'), name: 'view', arguments: '{}' })
        session.append('tool/result', {
          turn: 1, step: 2,
          message: createToolResultMessage({
            callId: ToolCallId('c3'),
            content: [{ type: 'image' } as never, { type: 'text', text: 'caption' }],
            isError: false,
          }),
        }, { surfaceOp: 'append' })
        session.append('step/end', { turn: 1, step: 2 })
        session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      },
    }, { lines: ['go', undefined], config: noConfig })
    try {
      const result = await test.run()
      expect(result.out).toContain('mine')
      expect(result.out).not.toContain('from another agent')
      expect(result.out).not.toContain('foreign_tool')
      expect(result.out).toContain('first result')
      expect(result.out).not.toContain('compacted result')
      expect(result.out).toContain('⎿ caption\n')
    } finally { await test.ctx.fiber.dispose() }
  })

  describe('--resume', () => {
    const cwd = process.cwd()
    const observation = (header: Record<string, unknown>, events: { type: string }[] = []) =>
      async () => ({ header, events, [Symbol.dispose]() {} })

    it('continues an existing Session recorded in this directory', async () => {
      const test = await bench({
        afterPrompt(session, message) { appendTurn(session, message, 'resumed') },
      }, { lines: ['hi', undefined], config: { resume: 'session-old' }, observe: observation({ cwd, origin: 'user' }) })
      test.ctx.sessions.create(brandString<SessionId>('session-old'), { meta: { cwd } })
      try {
        const result = await test.run()
        expect(result.code).toBe(0)
        expect(result.out).toContain('session session-old')
        expect(result.out).toContain('--resume session-old')
      } finally { await test.ctx.fiber.dispose() }
    })

    it.each([
      ['an unknown id', undefined, 'session "session-old" does not exist; omit --resume to start a new Session'],
      ['another directory', observation({ cwd: '/elsewhere' }), 'was recorded in "/elsewhere"'],
      ['no recorded directory', observation({}), 'recorded no working directory'],
      ['a subagent', observation({ cwd, origin: 'subagent' }), 'is a subagent or forked session'],
      ['a forked session', observation({ cwd, parentSession: 'session-parent' }), 'is a subagent or forked session'],
      ['an agent preset', observation({ cwd }, [{ type: 'agent-preset/selected' }]), 'runs under an agent preset'],
    ])('exits 1 for %s', async (_label, observe, message) => {
      const test = await bench({ afterPrompt() {} }, { lines: [], config: { resume: 'session-old' }, ...observe === undefined ? {} : { observe } })
      try {
        const result = await test.run()
        expect(result.code).toBe(1)
        expect(result.err).toContain(message)
      } finally { await test.ctx.fiber.dispose() }
    })

    it('rethrows a query failure other than a missing Session, including a non-Error rejection', async () => {
      const other = await bench({ afterPrompt() {} }, {
        lines: [], config: { resume: 'session-old' },
        observe: async () => { throw new SessionQueryError('locked', 'SESSION_QUERY_LOCKED' as never) },
      })
      try { expect((await other.run()).err).toContain('locked') }
      finally { await other.ctx.fiber.dispose() }

      const thrown = await bench({ afterPrompt() {} }, {
        lines: [], config: { resume: 'session-old' },
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- exercises the non-Error rejection path
        observe: () => Promise.reject('plain string failure'),
      })
      try { expect((await thrown.run()).err).toBe('cortex: plain string failure\n') }
      finally { await thrown.ctx.fiber.dispose() }
    })

    it('refuses a live Session and a composition without persistence', async () => {
      const live = await bench({ afterPrompt() {} }, { lines: [], config: { resume: 'session-live' }, observe: observation({ cwd }) })
      await live.ctx.agents.create({ sessionId: brandString<SessionId>('session-live'), meta: { cwd }, agentOptions: { provider: 'p', model: 'm' } })
      try { expect((await live.run()).err).toContain('already live in this process') }
      finally { await live.ctx.fiber.dispose() }

      const bare = await bench({ afterPrompt() {} }, { lines: [], config: { resume: 'session-old' }, noPersistence: true })
      try { expect((await bare.run()).err).toContain('requires the sessionPersistence service') }
      finally { await bare.ctx.fiber.dispose() }
    })

    it('continues a Session whose log holds ordinary events', async () => {
      const test = await bench({ afterPrompt() {} }, {
        lines: [undefined], config: { resume: 'session-old' },
        observe: observation({ cwd }, [{ type: 'user/message' }]),
      })
      test.ctx.sessions.create(brandString<SessionId>('session-old'), { meta: { cwd } })
      try { expect((await test.run()).code).toBe(0) }
      finally { await test.ctx.fiber.dispose() }
    })

    it('fails loud when the query service is not composed', async () => {
      const test = await bench({ afterPrompt() {} }, { lines: [], config: { resume: 'session-old' }, omitSessionQuery: true })
      try { expect((await test.run()).err).toContain('requires the sessionQuery service') }
      finally { await test.ctx.fiber.dispose() }
    })

    it('rejects a blank id set through overlay config', async () => {
      const test = await bench({ afterPrompt() {} }, { lines: [], config: { resume: '  ' } })
      try { expect((await test.run()).err).toContain('resume must not be blank') }
      finally { await test.ctx.fiber.dispose() }
    })
  })

  it('fails loud when the launcher provides no exit request', () => {
    expect(() => { apply(new Context(), {}) }).toThrow('the launcher must provide ctx.appExit')
  })
})
