/** Palettes, painter modes, and color detection. */

import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, THEME_FLAVOR, THEME_NAMES, colorEnabled, createPainter, detectColorMode, isThemeName } from '../src/theme.ts'

describe('createPainter', () => {
  it('emits 16-color codes for true and the ansi mode', () => {
    expect(createPainter(true)('red', 'x')).toBe('\u001b[31mx\u001b[39m')
    expect(createPainter('ansi', THEMES.aurora)('accent', 'x')).toBe('\u001b[96mx\u001b[39m')
  })

  it('emits 24-bit codes for truecolor', () => {
    expect(createPainter('truecolor')('accent', 'x')).toBe('\u001b[38;2;167;139;250mx\u001b[39m')
    expect(createPainter('truecolor', THEMES.ember)('motor', 'x')).toBe('\u001b[38;2;248;113;113mx\u001b[39m')
  })

  it('applies bold and dim in every color mode but none', () => {
    expect(createPainter('truecolor')('bold', 'x')).toBe('\u001b[1mx\u001b[22m')
    expect(createPainter('ansi')('dim', 'x')).toBe('\u001b[2mx\u001b[22m')
  })

  it('returns text unchanged for false and none', () => {
    expect(createPainter(false)('red', 'x')).toBe('x')
    expect(createPainter('none')('bold', 'x')).toBe('x')
  })
})

describe('themes', () => {
  it('lists the palettes in cycling order and recognizes only those names', () => {
    expect(THEME_NAMES).toEqual(['cyberpunk', 'cortex', 'aurora', 'ember', 'mono'])
    expect(DEFAULT_THEME).toBe('cyberpunk')
    expect(isThemeName('ember')).toBe(true)
    expect(isThemeName('toString')).toBe(false)
    expect(isThemeName('nope')).toBe(false)
  })

  it('gives every palette every style, so no lobe is ever unpainted', () => {
    for (const palette of Object.values(THEMES)) {
      expect(Object.keys(palette).sort()).toEqual(['accent', 'cyan', 'delegate', 'green', 'memory', 'motor', 'planning', 'red', 'sensory', 'yellow'])
    }
  })
})

describe('Cyberpunk 2077 theme', () => {
  it('uses neon yellow, cyan, and hot red, in truecolor and in the 16-color fallback', () => {
    const truecolor = createPainter('truecolor', THEMES.cyberpunk)
    expect(truecolor('accent', 'x')).toBe('\u001b[38;2;252;238;10mx\u001b[39m')
    expect(truecolor('sensory', 'x')).toBe('\u001b[38;2;0;240;255mx\u001b[39m')
    expect(truecolor('motor', 'x')).toBe('\u001b[38;2;255;0;60mx\u001b[39m')
    expect(createPainter('ansi', THEMES.cyberpunk)('accent', 'x')).toBe('\u001b[93mx\u001b[39m')
  })

  it('speaks like a netrunner while the other palettes keep the plain wording', () => {
    expect(THEME_FLAVOR.cyberpunk.tagline).toBe('// NEURAL LINK ESTABLISHED')
    expect(THEME_FLAVOR.cyberpunk.verbs).toContain('breaching ICE')
    expect(THEME_FLAVOR.cortex.tagline).toBe('')
    expect(THEME_FLAVOR.mono.verbs).toContain('synapsing')
  })
})

describe('color detection', () => {
  const tty = { isTty: true, noColorFlag: false, env: {} }

  it('enables color only for a terminal that was not told otherwise', () => {
    expect(colorEnabled(tty)).toBe(true)
    expect(colorEnabled({ ...tty, isTty: false })).toBe(false)
    expect(colorEnabled({ ...tty, noColorFlag: true })).toBe(false)
    expect(colorEnabled({ ...tty, env: { NO_COLOR: '1' } })).toBe(false)
    expect(colorEnabled({ ...tty, env: { NO_COLOR: '' } })).toBe(true)
  })

  it('picks the richest mode the terminal advertises', () => {
    expect(detectColorMode(tty)).toBe('ansi')
    expect(detectColorMode({ ...tty, env: { COLORTERM: 'truecolor' } })).toBe('truecolor')
    expect(detectColorMode({ ...tty, env: { COLORTERM: '24BIT' } })).toBe('truecolor')
    expect(detectColorMode({ ...tty, env: { COLORTERM: 'yes' } })).toBe('ansi')
    expect(detectColorMode({ ...tty, isTty: false, env: { COLORTERM: 'truecolor' } })).toBe('none')
  })
})
