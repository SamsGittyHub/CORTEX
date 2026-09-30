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
import { LlmSelectionError, chooseLlm } from './llm-select.ts'
import type { LlmChoice } from './llm-select.ts'
import { internals } from './startup-internals.ts'

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
  /** Whether memory stays on; `--no-memory` turns it off for this run. */
  memory: boolean
  /** The model route and provider profiles chosen from the flags and the environment. */
  llm: LlmChoice
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
    .option('--no-memory', 'do not record or recall memory in this run')
    .option('--provider <name>', 'use this provider (anthropic, openai, google, openrouter, …) with its API key from the environment')
    .option('--model <id>', 'use this model instead of the provider default')
    .option('--base-url <url>', 'use an OpenAI-compatible endpoint; needs --model, and its key comes from CORTEX_API_KEY')
    .option('--api-key-env <name>', 'read the API key from this environment variable')
    .argument('[message...]', 'a first message to send; multiple words are joined by spaces')
    .addHelpText('after', `
Any API key works: with no flags the chat uses the first key it finds among DEEPSEEK_API_KEY, ANTHROPIC_API_KEY,
OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, and other providers'.

Examples:
  cortex --profile tui                          start a conversation
  cortex --profile tui "explain this repo"      start with a first message
  cortex --profile tui --resume session-…       continue an earlier conversation
  cortex --profile tui --provider openai --model gpt-5
  cortex --profile tui --base-url http://localhost:11434/v1 --model llama3.3

Inside the chat:
  /plan <task>   explore and present a plan for your review before acting
  /plan off      leave plan mode
  /memory        list what earlier sessions remembered about this project
  /remember <x>  save a note for future sessions
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
    const options = program.opts<{
      resume?: string
      color?: boolean
      memory?: boolean
      provider?: string
      model?: string
      baseUrl?: string
      apiKeyEnv?: string
    }>()
    const resume = options.resume
    if (resume !== undefined && resume.trim() === '') {
      program.error('error: --resume requires a non-empty session id')
    }
    let llm: LlmChoice
    try {
      llm = chooseLlm(internals.env(), options, internals.catalog)
    } catch (error: unknown) {
      if (!(error instanceof LlmSelectionError)) throw error
      program.error(`error: ${error.message}`)
      return
    }
    const joined = program.args.join(' ')
    ctx.provide(TUI_STARTUP_SERVICE, {
      message: joined.trim() === '' ? undefined : joined,
      resume,
      noColor: options.color === false,
      memory: options.memory !== false,
      llm,
    } satisfies TuiStartupValues)
  })
  parseCmdline(ctx, program)
}
