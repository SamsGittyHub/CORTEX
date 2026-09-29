/**
 * The Node terminal behind {@link TerminalIo}: a readline interface over the
 * process streams. Lines are read through the interface's async iterator, which
 * buffers input that arrives before the next read, so piped input is never lost.
 * @module @cortex-ai/cortex-tui/terminal
 */

import { createInterface } from 'node:readline'
import type { TerminalIo } from './repl.ts'

/** The streams the terminal reads and writes. */
export interface TerminalStreams {
  readonly stdin: NodeJS.ReadableStream & { readonly isTTY?: boolean }
  readonly stdout: NodeJS.WritableStream
}

/**
 * Open the terminal.
 * @param streams - the input and output streams.
 * @param complete - Tab completions for the line typed so far; only used by an interactive terminal.
 * @returns the terminal, whose `readLine` shows its prompt only for an interactive input.
 */
export function createTerminal(streams: TerminalStreams, complete: (line: string) => readonly string[]): TerminalIo {
  const interactive = streams.stdin.isTTY === true
  const rl = createInterface({
    input: streams.stdin,
    output: streams.stdout,
    terminal: interactive,
    completer: (line: string): [string[], string] => [[...complete(line)], line],
  })
  const lines = rl[Symbol.asyncIterator]()
  return {
    async readLine(prompt) {
      if (interactive) {
        rl.setPrompt(prompt)
        rl.prompt()
      }
      const next = await lines.next()
      return next.done === true ? undefined : next.value
    },
    out(text) {
      streams.stdout.write(text)
    },
    onInterrupt(handler) {
      rl.on('SIGINT', handler)
      return () => { rl.off('SIGINT', handler) }
    },
    close() {
      rl.close()
    },
  }
}
