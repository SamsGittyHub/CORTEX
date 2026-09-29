/**
 * Terminal colors: palettes that name each color by what it means (a lobe of
 * activity, an error, muted text), a painter that emits truecolor, 16-color
 * ANSI, or nothing, and detection of what the terminal supports.
 * @module @cortex-ai/cortex-tui/theme
 */

/** How much color the output can carry. */
export type ColorMode = 'none' | 'ansi' | 'truecolor'

/** Text attributes that do not depend on the palette. */
export type AttributeStyle = 'bold' | 'dim'

/** Palette entries: standard status colors plus one color per activity lobe. */
export type PaletteStyle =
  | 'red' | 'green' | 'yellow' | 'cyan'
  | 'accent' | 'sensory' | 'motor' | 'memory' | 'planning' | 'delegate'

/** Named terminal styles used by the runner. */
export type Style = AttributeStyle | PaletteStyle

/** One palette color: its truecolor value and its 16-color fallback code. */
export interface PaletteColor {
  readonly rgb: readonly [number, number, number]
  /** SGR foreground code (30-37 or 90-97) used when truecolor is unavailable. */
  readonly ansi: number
}

/** A palette: every {@link PaletteStyle} mapped to a color. */
export type Palette = Readonly<Record<PaletteStyle, PaletteColor>>

/** Styles a string, or returns it unchanged when color is off. */
export type Painter = (style: Style, text: string) => string

const ATTRIBUTE_CODES: Record<AttributeStyle, readonly [number, number]> = {
  bold: [1, 22],
  dim: [2, 22],
}

const STATUS = {
  red: { rgb: [239, 83, 80], ansi: 31 },
  green: { rgb: [102, 187, 106], ansi: 32 },
  yellow: { rgb: [255, 202, 40], ansi: 33 },
  cyan: { rgb: [77, 208, 225], ansi: 36 },
} as const satisfies Partial<Palette>

/** The selectable palettes. `cortex` is the default. */
export const THEMES = {
  cortex: {
    ...STATUS,
    accent: { rgb: [167, 139, 250], ansi: 95 },
    sensory: { rgb: [56, 189, 248], ansi: 96 },
    motor: { rgb: [251, 146, 60], ansi: 33 },
    memory: { rgb: [232, 121, 249], ansi: 35 },
    planning: { rgb: [250, 204, 21], ansi: 93 },
    delegate: { rgb: [74, 222, 128], ansi: 92 },
  },
  aurora: {
    ...STATUS,
    accent: { rgb: [45, 212, 191], ansi: 96 },
    sensory: { rgb: [96, 165, 250], ansi: 94 },
    motor: { rgb: [163, 230, 53], ansi: 92 },
    memory: { rgb: [192, 132, 252], ansi: 95 },
    planning: { rgb: [253, 224, 71], ansi: 93 },
    delegate: { rgb: [52, 211, 153], ansi: 32 },
  },
  ember: {
    ...STATUS,
    accent: { rgb: [251, 113, 133], ansi: 91 },
    sensory: { rgb: [253, 186, 116], ansi: 93 },
    motor: { rgb: [248, 113, 113], ansi: 31 },
    memory: { rgb: [244, 114, 182], ansi: 95 },
    planning: { rgb: [252, 211, 77], ansi: 33 },
    delegate: { rgb: [190, 242, 100], ansi: 92 },
  },
  mono: {
    ...STATUS,
    accent: { rgb: [229, 231, 235], ansi: 97 },
    sensory: { rgb: [209, 213, 219], ansi: 37 },
    motor: { rgb: [209, 213, 219], ansi: 37 },
    memory: { rgb: [209, 213, 219], ansi: 37 },
    planning: { rgb: [209, 213, 219], ansi: 37 },
    delegate: { rgb: [209, 213, 219], ansi: 37 },
  },
} as const satisfies Record<string, Palette>

/** Name of a selectable palette. */
export type ThemeName = keyof typeof THEMES

/** The palette names, in the order `/theme` cycles them. */
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[]

/**
 * Whether a string names a palette.
 * @param name - the candidate.
 * @returns `true` when `name` is a key of {@link THEMES}.
 */
export function isThemeName(name: string): name is ThemeName {
  return Object.hasOwn(THEMES, name)
}

/**
 * Build a painter.
 * @param mode - how much color to emit; `true` means 16-color ANSI and `false` none.
 * @param palette - the colors to use; defaults to the `cortex` theme.
 * @returns a function wrapping text in escape codes, or the identity when there is no color.
 */
export function createPainter(mode: ColorMode | boolean, palette: Palette = THEMES.cortex): Painter {
  const resolved: ColorMode = mode === true ? 'ansi' : mode === false ? 'none' : mode
  if (resolved === 'none') return (_style, text) => text
  return (style, text) => {
    if (style === 'bold' || style === 'dim') {
      const [open, close] = ATTRIBUTE_CODES[style]
      return `\u001b[${String(open)}m${text}\u001b[${String(close)}m`
    }
    const color = palette[style]
    if (resolved === 'truecolor') {
      const [r, g, b] = color.rgb
      return `\u001b[38;2;${String(r)};${String(g)};${String(b)}m${text}\u001b[39m`
    }
    return `\u001b[${String(color.ansi)}m${text}\u001b[39m`
  }
}

/** The terminal facts and user switches that decide color. */
export interface ColorFacts {
  readonly isTty: boolean
  readonly noColorFlag: boolean
  readonly env: Readonly<Record<string, string | undefined>>
}

/**
 * Whether the process should color its output: only for a terminal, and never
 * when the user set `NO_COLOR` or passed `--no-color`.
 * @param facts - the terminal facts and user switches.
 * @returns whether ANSI escapes are appropriate.
 */
export function colorEnabled(facts: ColorFacts): boolean {
  if (facts.noColorFlag) return false
  const noColor = facts.env['NO_COLOR']
  if (noColor !== undefined && noColor !== '') return false
  return facts.isTty
}

/**
 * Choose the richest color mode the terminal advertises.
 * @param facts - the terminal facts and user switches.
 * @returns `none` when color is off, `truecolor` when `COLORTERM` says `truecolor` or `24bit`, otherwise `ansi`.
 */
export function detectColorMode(facts: ColorFacts): ColorMode {
  if (!colorEnabled(facts)) return 'none'
  const colorterm = facts.env['COLORTERM']?.toLowerCase()
  return colorterm === 'truecolor' || colorterm === '24bit' ? 'truecolor' : 'ansi'
}
