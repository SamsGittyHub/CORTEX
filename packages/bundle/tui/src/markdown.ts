/**
 * Streaming Markdown styling for terminal output. Text arrives in arbitrary
 * chunks, so the renderer decides each line's kind from its first characters
 * and styles inline code and bold as the closing marker arrives, holding back
 * only the few characters that could still begin a marker. Feeding a text in
 * one piece or one character at a time styles every character the same way.
 * @module @cortex-ai/cortex-tui/markdown
 */

import type { Painter } from './theme.ts'

type LineKind = 'plain' | 'heading' | 'bullet' | 'quote' | 'fence-body' | 'fence-edge'

/** The result of inspecting the start of a line. */
type Decision = { readonly wait: true } | { readonly wait: false; readonly kind: LineKind; readonly rest: string; readonly lead: string }

/** Glyph that replaces a bullet marker. */
const BULLET = '•'

/**
 * Decide what kind of line begins with `prefix`.
 * @param prefix - the characters of the line seen so far.
 * @param inFence - whether the line is inside a fenced code block.
 * @param final - whether the line has ended, so no more characters can arrive.
 * @returns `wait` when more characters are needed; otherwise the line kind, the text
 * printed in place of a list marker, and the text after the marker.
 */
function decide(prefix: string, inFence: boolean, final: boolean): Decision {
  const trimmed = prefix.trimStart()
  const indent = prefix.slice(0, prefix.length - trimmed.length)
  const plain: Decision = { wait: false, kind: inFence ? 'fence-body' : 'plain', rest: prefix, lead: '' }
  if (trimmed === '') return final ? plain : { wait: true }
  if (trimmed.startsWith('```')) return { wait: false, kind: 'fence-edge', rest: trimmed.slice(3), lead: '' }
  if ('```'.startsWith(trimmed)) return final ? plain : { wait: true }
  if (inFence) return plain
  if (/^#{1,6} /u.test(trimmed)) return { wait: false, kind: 'heading', rest: trimmed.replace(/^#+ /u, ''), lead: '' }
  if (/^#{1,6}$/u.test(trimmed)) return final ? plain : { wait: true }
  if (/^[-*+] /u.test(trimmed)) return { wait: false, kind: 'bullet', rest: trimmed.slice(2), lead: indent }
  if (/^[-*+]$/u.test(trimmed)) return final ? plain : { wait: true }
  if (trimmed.startsWith('> ')) return { wait: false, kind: 'quote', rest: trimmed.slice(2), lead: '' }
  if (trimmed === '>') return final ? plain : { wait: true }
  return plain
}

/** Incremental Markdown-to-ANSI converter for one reply. */
export class MarkdownStream {
  private prefix = ''
  private kind: LineKind | undefined
  private inFence = false
  private code = false
  private bold = false
  private star = false
  private edge = ''
  private edgeOpens = false
  private run = ''
  private runStyle = ''
  private out = ''

  constructor(private readonly paint: Painter) {}

  /**
   * Convert the next chunk of text.
   * @param chunk - text as produced by the model.
   * @returns styled text ready to print; characters that may start a marker are held until the next call.
   */
  write(chunk: string): string {
    for (const char of chunk) this.push(char)
    this.flushRun()
    const ready = this.out
    this.out = ''
    return ready
  }

  /**
   * Finish the reply: emit held characters and reset inline styles.
   * @returns the remaining styled text; an unclosed code block gets no closing rail.
   */
  end(): string {
    if (this.kind === undefined && this.prefix !== '') this.startLine(true)
    this.endInline()
    if (this.kind === 'fence-edge') this.endEdge()
    this.inFence = false
    this.kind = undefined
    this.prefix = ''
    this.flushRun()
    const ready = this.out
    this.out = ''
    return ready
  }

  private emitPlain(text: string): void {
    this.flushRun()
    this.out += text
  }

  private styleKey(): string {
    return `${String(this.kind)}|${this.code ? 'c' : ''}${this.bold ? 'b' : ''}`
  }

  private style(text: string): string {
    if (this.kind === 'fence-body') return this.paint('cyan', text)
    let styled = text
    if (this.code) styled = this.paint('accent', styled)
    if (this.bold) styled = this.paint('bold', styled)
    if (this.kind === 'heading') styled = this.paint('bold', this.paint('accent', styled))
    if (this.kind === 'quote') styled = this.paint('dim', styled)
    return styled
  }

  private append(text: string): void {
    const key = this.styleKey()
    if (key !== this.runStyle) this.flushRun()
    this.runStyle = key
    this.run += text
  }

  private flushRun(): void {
    if (this.run !== '') this.out += this.style(this.run)
    this.run = ''
  }

  private endInline(): void {
    if (this.star) this.append('*')
    this.star = false
    this.flushRun()
    this.code = false
    this.bold = false
  }

  private endEdge(): void {
    this.emitPlain(this.paint('dim', this.edgeOpens ? `╭─ ${this.edge.trim()}` : '╰─'))
    this.edge = ''
  }

  private startLine(final: boolean): void {
    const decision = decide(this.prefix, this.inFence, final)
    if (decision.wait) return
    this.prefix = ''
    this.kind = decision.kind
    if (decision.kind === 'fence-edge') {
      this.inFence = !this.inFence
      this.edgeOpens = this.inFence
      this.edge = decision.rest
      return
    }
    if (decision.kind === 'fence-body') this.emitPlain(this.paint('dim', '│ '))
    if (decision.kind === 'bullet') this.emitPlain(`${decision.lead}${this.paint('accent', BULLET)} `)
    if (decision.kind === 'quote') this.emitPlain(this.paint('dim', '▎ '))
    for (const char of decision.rest) this.inline(char)
  }

  private push(char: string): void {
    if (char === '\n') {
      if (this.kind === undefined) this.startLine(true)
      this.endInline()
      if (this.kind === 'fence-edge') this.endEdge()
      this.out += '\n'
      this.kind = undefined
      return
    }
    if (this.kind === undefined) {
      this.prefix += char
      this.startLine(false)
      return
    }
    this.inline(char)
  }

  private inline(char: string): void {
    if (this.kind === 'fence-edge') {
      this.edge += char
      return
    }
    if (this.kind === 'fence-body') {
      this.append(char)
      return
    }
    if (this.star) {
      this.star = false
      if (char === '*' && !this.code) {
        this.flushRun()
        this.bold = !this.bold
        return
      }
      this.append('*')
    }
    if (char === '`') {
      this.flushRun()
      this.code = !this.code
      return
    }
    if (char === '*' && !this.code) {
      this.star = true
      return
    }
    this.append(char)
  }
}

/**
 * Convert a complete text at once.
 * @param text - Markdown text.
 * @param paint - the color painter.
 * @returns the styled text.
 */
export function renderMarkdown(text: string, paint: Painter): string {
  const stream = new MarkdownStream(paint)
  return stream.write(text) + stream.end()
}
