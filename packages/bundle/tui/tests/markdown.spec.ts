/** Streaming Markdown styling. */

import { describe, expect, it } from 'vitest'
import { MarkdownStream } from '../src/markdown.ts'
import type { Painter } from '../src/theme.ts'

/** A painter that names the style instead of emitting escapes. */
const tag: Painter = (style, text) => `<${style}>${text}</${style}>`

/** Merge adjacent runs of the same style so chunking cannot show through. */
function normalize(text: string): string {
  let previous = ''
  let current = text
  while (previous !== current) {
    previous = current
    current = current.replace(/<\/(\w+)><\1>/gu, '')
  }
  return current
}

function render(text: string, chunkSize = text.length): string {
  const stream = new MarkdownStream(tag)
  let out = ''
  for (let index = 0; index < text.length; index += chunkSize) out += stream.write(text.slice(index, index + chunkSize))
  return normalize(out + stream.end())
}

describe('MarkdownStream', () => {
  it('passes plain text through unstyled', () => {
    expect(render('hello world\n')).toBe('hello world\n')
  })

  it('styles headings of any level as bold accent text and drops the marker', () => {
    expect(render('# Title\n')).toBe('<bold><accent>Title</accent></bold>\n')
    expect(render('###### Deep\n')).toBe('<bold><accent>Deep</accent></bold>\n')
  })

  it('keeps a # that is not followed by a space as text', () => {
    expect(render('#hashtag\n')).toBe('#hashtag\n')
    expect(render('``\n')).toBe('\n')
    expect(render('####### seven\n')).toBe('####### seven\n')
  })

  it('turns list markers into bullets and keeps the indent', () => {
    expect(render('- one\n')).toBe('<accent>•</accent> one\n')
    expect(render('  * two\n')).toBe('  <accent>•</accent> two\n')
    expect(render('+ three\n')).toBe('<accent>•</accent> three\n')
  })

  it('keeps a lone marker character as text', () => {
    expect(render('-x\n')).toBe('-x\n')
    expect(render('-\n')).toBe('-\n')
    expect(render('*\n')).toBe('*\n')
  })

  it('renders block quotes dim after a rail', () => {
    expect(render('> quoted\n')).toBe('<dim>▎ quoted</dim>\n')
    expect(render('>\n')).toBe('>\n')
  })

  it('styles inline code and bold, and lets bold contain code', () => {
    expect(render('use `npm test` now\n')).toBe('use <accent>npm test</accent> now\n')
    expect(render('a **big** deal\n')).toBe('a <bold>big</bold> deal\n')
    expect(render('**run `x`**\n')).toBe('<bold>run <accent>x</accent></bold>\n')
  })

  it('does not treat * inside code or a lone * as bold', () => {
    expect(render('`a*b`\n')).toBe('<accent>a*b</accent>\n')
    expect(render('2 * 3\n')).toBe('2 * 3\n')
    expect(render('end*')).toBe('end*')
  })

  it('does not let an unterminated span leak into the next line', () => {
    expect(render('`open\nnext\n')).toBe('<accent>open</accent>\nnext\n')
    expect(render('**open\nnext\n')).toBe('<bold>open</bold>\nnext\n')
  })

  it('draws fenced code blocks with a rail and the language', () => {
    expect(render('```ts\nconst a = 1\n```\nafter\n')).toBe('<dim>╭─ ts</dim>\n<dim>│ </dim><cyan>const a = 1</cyan>\n<dim>╰─</dim>\nafter\n')
  })

  it('does not style Markdown inside a fenced block', () => {
    expect(render('```\n# not a heading\n- nor a bullet\n```\n')).toBe('<dim>╭─ </dim>\n<dim>│ </dim><cyan># not a heading</cyan>\n<dim>│ </dim><cyan>- nor a bullet</cyan>\n<dim>╰─</dim>\n')
  })

  it('reads an empty backtick pair as an empty code span and draws an empty fenced line as a rail', () => {
    expect(render('``x\n')).toBe('x\n')
    expect(render('```\n\n```\n')).toBe('<dim>╭─ </dim>\n<dim>│ </dim>\n<dim>╰─</dim>\n')
  })

  it('finishes a text that ends mid-line, mid-marker, or inside a fence', () => {
    expect(render('# Head')).toBe('<bold><accent>Head</accent></bold>')
    expect(render('##')).toBe('##')
    expect(render('```py')).toBe('<dim>╭─ py</dim>')
    expect(render('```\ncode')).toBe('<dim>╭─ </dim>\n<dim>│ </dim><cyan>code</cyan>')
    expect(render('')).toBe('')
  })

  it('holds back a line-start marker until it is decided', () => {
    const stream = new MarkdownStream(tag)
    expect(stream.write('#')).toBe('')
    expect(stream.write('# T')).toBe('<bold><accent>T</accent></bold>')
    expect(stream.write('itle')).toBe('<bold><accent>itle</accent></bold>')
    expect(stream.write('\n')).toBe('\n')
  })

  it.each([
    '# Title\n\nSome **bold** and `code` text.\n- item one\n- item **two**\n> quote\n```ts\nlet x = `y`\n```\nDone.\n',
    'no trailing newline with `code` and **bold**',
    '```\nunterminated *fence*\n',
    '2 * 3 ** 4 `` ` ** *\n',
  ])('styles the same at every chunk size: %j', (text) => {
    const whole = render(text)
    for (const size of [1, 2, 3, 5, 7]) expect(render(text, size)).toBe(whole)
  })
})
