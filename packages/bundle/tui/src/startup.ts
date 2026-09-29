/**
 * The terminal app's command-line provider: it parses the optional first
 * message, `--resume`, `--no-color`, and `--help`, then publishes
 * {@link TUI_STARTUP_SERVICE}. The runner is an ordinary consumer whose lazy
 * config waits for that service.
 * @module @cortex-ai/cortex-tui/startup
 */

import { Command } from 'commander'
import type { Context } from '@cortex-ai/cordis'
import { parseCmdline } from '@cortex-ai/cortex-cmdline'

/** Stable Cordis plugin name. */
export const name = 'tui-startup'

/** Services required before the arguments can be parsed. */
export const inject = ['cmdlineArgs']

/** Service provided by this plugin and injected by the terminal runner. */
export const TUI_STARTUP_SERVICE = 'tuiStartup'

/** What the runner row reads from {@link TUI_STARTUP_SERVICE}. */
export interface TuiStartupValues {
  /** A message to send before the first prompt; absent for an empty start. */
  message: string | undefined
  /** Exact Session identity to continue; absent for a new conversation. */
  resume: string | undefined
  /** Whether the user asked for plain output with `--no-color`. */
  noColor: boolean
}

/**
 * This app's command: the optional message positional, its options, and its help text.
 * @returns a fresh program, so one process can parse more than once (tests).
 */
function tuiCommand(): Command {
  return new Command()
    .name('cortex --profile tui')
    .description('Chat with the agent in this terminal. Type /help for commands and /plan to plan before acting.')
    .helpOption('-h, --help', 'show this help')
    .option('--resume <id>', 'continue the persisted Session with this id; an unknown id is an error')
    .option('--no-color', 'print without ANSI colors (NO_COLOR is also honored)')
    .argument('[message...]', 'a first message to send; multiple words are joined by spaces')
    .addHelpText('after', `
Examples:
  cortex --profile tui                          start a conversation
  cortex --profile tui "explain this repo"      start with a first message
  cortex --profile tui --resume session-…       continue an earlier conversation

Inside the chat:
  /plan <task>   explore and present a plan for your review before acting
  /plan off      leave plan mode
  /help          list every command
  /exit          leave (Ctrl-D also works)
`)
}

/**
 * Parse and provide the terminal app's arguments as an ordinary Cordis service.
 * On a usage error or `--help` nothing is provided and the launcher exits.
 * @param ctx - plugin context carrying the command line.
 */
export function apply(ctx: Context): void {
  const program = tuiCommand()
  program.action(() => {
    const options = program.opts<{ resume?: string; color?: boolean }>()
    const resume = options.resume
    if (resume !== undefined && resume.trim() === '') {
      program.error('error: --resume requires a non-empty session id')
    }
    const joined = program.args.join(' ')
    ctx.provide(TUI_STARTUP_SERVICE, {
      message: joined.trim() === '' ? undefined : joined,
      resume,
      noColor: options.color === false,
    } satisfies TuiStartupValues)
  })
  parseCmdline(ctx, program)
}
