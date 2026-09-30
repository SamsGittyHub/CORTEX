/**
 * The interactive read-eval loop, written against two narrow interfaces so it
 * runs without a Cordis tree: the terminal it reads from and writes to, and the
 * Agent operations it drives. The runner in `index.ts` binds both to real
 * services.
 * @module @cortex-ai/cortex-tui/repl
 */

import { assertNever } from '@cortex-ai/cortex-util-values'
import { lobeLegend } from './banner.ts'
import { classifyLine } from './render.ts'
import type { LocalCommandName } from './render.ts'
import type { Painter } from './render.ts'

/** The terminal the loop reads lines from and writes to. */
export interface TerminalIo {
  /**
   * Print `prompt` and read one line.
   * @param prompt - text shown before the cursor.
   * @returns the typed line, or `undefined` at end of input or after `close()`.
   */
  readLine(prompt: string): Promise<string | undefined>
  /** Write text to stdout. */
  out(text: string): void
  /**
   * Register the Ctrl-C handler.
   * @param handler - called for each interrupt.
   * @returns a function that unregisters it.
   */
  onInterrupt(handler: () => void): () => void
  /** End input: a pending `readLine` settles with `undefined`. */
  close(): void
}

/** One row of the `/help` listing. */
export interface CommandRow {
  readonly name: string
  readonly description: string
}

/** The settled outcome of one agent command, as printed. */
export interface CommandOutcome {
  readonly kind: 'success' | 'error'
  readonly text?: string
}

/** The Agent operations the loop drives. */
export interface ReplAgent {
  /** Queue one ordinary message as its own turn. */
  submit(text: string): void
  /**
   * Run one registered agent command.
   * @param line - the full line including the leading slash.
   * @returns the outcome, or `undefined` when no such command is registered.
   */
  runCommand(line: string): Promise<CommandOutcome | undefined>
  /** The agent commands available for `/help`. */
  commands(): readonly CommandRow[]
  /** Resolve once the agent has no active work. */
  idle(): Promise<void>
  /** Cancel the active turn on the user's behalf. */
  cancel(): void
  /** Make the Session log durable. */
  flush(): Promise<void>
}

/** Terminal-owned commands shown ahead of the agent's. */
export const LOCAL_COMMANDS: readonly CommandRow[] = [
  { name: 'help', description: 'show this list' },
  { name: 'session', description: 'show the session id and how to resume it' },
  { name: 'stats', description: 'show turns, tokens, and activity so far' },
  { name: 'theme', description: 'switch colors: /theme [cyberpunk|cortex|aurora|ember|mono]' },
  { name: 'clear', description: 'clear the screen' },
  { name: 'exit', description: 'leave (also /quit, Ctrl-D)' },
]

/**
 * Format the `/help` listing.
 * @param rows - agent command rows.
 * @param paint - the color painter.
 * @returns the listing text, ending in a newline.
 */
export function formatHelp(rows: readonly CommandRow[], paint: Painter): string {
  const all = [...LOCAL_COMMANDS, ...rows]
  const width = Math.max(...all.map(row => row.name.length))
  const lines = all.map(row => `  ${paint('cyan', `/${row.name.padEnd(width)}`)}  ${row.description}`)
  return `${lines.join('\n')}\n  ${paint('dim', 'Start a line with // to send a message that begins with a slash.')}\n\n${paint('bold', '  Lobes')}\n${lobeLegend(paint)}`
}

/** Options for {@link runRepl}. */
export interface ReplOptions {
  /** The prompt printed before each read; called anew for each read so it can show the current mode. */
  readonly prompt: () => string
  /**
   * Run a terminal-owned command such as `/stats`.
   * @param name - the command.
   * @param args - the text after the name.
   * @returns text to print, or an empty string to print nothing.
   */
  readonly local: (name: LocalCommandName, args: string) => string
  /** A line handled as if typed before the first read, for `cortex --profile tui "task"`. */
  readonly initialLine?: string | undefined
}

/**
 * Run the loop until end of input, `/exit`, or a second Ctrl-C at an idle prompt.
 * Ctrl-C during a turn cancels that turn only.
 * @param agent - the operations the loop drives.
 * @param io - the terminal.
 * @param paint - the color painter.
 * @param options - the prompt and optional first message.
 */
export async function runRepl(agent: ReplAgent, io: TerminalIo, paint: Painter, options: ReplOptions): Promise<void> {
  let busy = false
  let interruptArmed = false
  const stopInterrupts = io.onInterrupt(() => {
    if (busy) {
      agent.cancel()
      return
    }
    if (interruptArmed) {
      io.close()
      return
    }
    interruptArmed = true
    io.out(`\n${paint('dim', '(press Ctrl-C again or Ctrl-D to exit)')}\n`)
  })

  const settle = async (work: () => void | Promise<void>): Promise<void> => {
    busy = true
    try {
      await work()
      await agent.idle()
      await agent.flush()
    } finally {
      busy = false
    }
  }

  /** Handle one typed line; `false` ends the loop. */
  const handle = async (raw: string): Promise<boolean> => {
    interruptArmed = false
    const action = classifyLine(raw)
    switch (action.kind) {
      case 'empty':
        return true
      case 'exit':
        return false
      case 'help':
        io.out(formatHelp(agent.commands(), paint))
        return true
      case 'local':
        io.out(options.local(action.name, action.args))
        return true
      case 'message':
        await settle(() => { agent.submit(action.text) })
        return true
      case 'command':
        await settle(async () => {
          const outcome = await agent.runCommand(action.line)
          if (outcome === undefined) {
            io.out(`${paint('red', 'unknown command')}: ${action.line.split(/\s/u, 1)[0] as string} ${paint('dim', '(try /help)')}\n`)
          } else if (outcome.text !== undefined && outcome.text !== '') {
            io.out(`${paint(outcome.kind === 'error' ? 'red' : 'dim', outcome.text)}\n`)
          }
        })
        return true
      /* v8 ignore next -- closed-union exhaustiveness guard */
      default:
        return assertNever(action, 'tui line action')
    }
  }

  try {
    if (options.initialLine !== undefined && !await handle(options.initialLine)) return
    for (;;) {
      const raw = await io.readLine(options.prompt())
      if (raw === undefined || !await handle(raw)) break
    }
  } finally {
    stopInterrupts()
  }
}

/**
 * Tab completions for a line that starts a slash command.
 * @param line - the text typed so far.
 * @param rows - the agent commands available now.
 * @returns the `/name` candidates that extend `line`; none once the line has a space or does not start with a slash.
 */
export function completeCommand(line: string, rows: readonly CommandRow[]): string[] {
  if (!line.startsWith('/') || /\s/u.test(line)) return []
  const names = [...LOCAL_COMMANDS, ...rows].map(row => `/${row.name}`)
  return [...new Set(names)].filter(name => name.startsWith(line.toLowerCase())).sort()
}
