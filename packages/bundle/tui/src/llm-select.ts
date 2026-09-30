/**
 * Choosing the model route for a chat from what the user has: an API key in the
 * environment for any of the providers pi-ai knows, a `--provider` flag, or an
 * OpenAI-compatible endpoint given by `--base-url`. The result feeds the
 * `agent-default-model` and `llm-pi-ai` rows of the profile, so the chat works
 * with whichever key is set instead of only DeepSeek's.
 * @module @cortex-ai/cortex-tui/llm-select
 */

/** The DeepSeek routes the base profile ships. */
export const DEEPSEEK_ROUTE = 'deepseek-official'

/** The route name used for a `--base-url` endpoint. */
export const CUSTOM_ROUTE = 'custom'

/** Environment variables that hold the key of an endpoint given by `--base-url`, tried in order. */
export const CUSTOM_KEY_ENV = 'CORTEX_API_KEY'

/**
 * Providers tried in this order when no flag names one. DeepSeek comes first so
 * an existing `DEEPSEEK_API_KEY` keeps the behavior it always had.
 */
const PREFERENCE = [
  'anthropic', 'openai', 'google', 'openrouter', 'xai', 'groq', 'mistral', 'together', 'fireworks',
  'cerebras', 'zai', 'moonshotai', 'minimax', 'huggingface', 'nvidia', 'baseten',
] as const

/** Environment variables that hold each provider's key, in the order they are tried. */
const KEY_ENV: Readonly<Record<string, readonly string[]>> = {
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_OAUTH_TOKEN'],
  openai: ['OPENAI_API_KEY'],
  google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  xai: ['XAI_API_KEY'],
  groq: ['GROQ_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  together: ['TOGETHER_API_KEY'],
  fireworks: ['FIREWORKS_API_KEY'],
  cerebras: ['CEREBRAS_API_KEY'],
  zai: ['ZAI_API_KEY'],
  moonshotai: ['MOONSHOT_API_KEY'],
  minimax: ['MINIMAX_API_KEY'],
  huggingface: ['HF_TOKEN'],
  nvidia: ['NVIDIA_API_KEY'],
  baseten: ['BASETEN_API_KEY'],
}

/** The model a provider starts on when the user names none; providers absent here start on their first catalog model. */
const DEFAULT_MODEL: Readonly<Record<string, string>> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5',
  google: 'gemini-2.5-pro',
  openrouter: 'anthropic/claude-sonnet-4.6',
  xai: 'grok-4.3',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-large-latest',
  together: 'moonshotai/Kimi-K2.6',
  cerebras: 'gpt-oss-120b',
  zai: 'glm-5.2',
  moonshotai: 'kimi-k2.6',
}

/** The pi-ai catalog facts the choice needs. */
export interface Catalog {
  /** Every provider name the catalog knows. */
  providers(): readonly string[]
  /** The first model id of a provider, or `undefined` when it has none. */
  firstModel(provider: string): string | undefined
}

/** What the user asked for on the command line. */
export interface LlmFlags {
  readonly provider?: string | undefined
  readonly model?: string | undefined
  readonly baseUrl?: string | undefined
  readonly apiKeyEnv?: string | undefined
}

/** One provider profile in the `llm-pi-ai` configuration. */
export interface ProviderProfile {
  readonly apiKeyEnv?: string
  readonly displayName?: string
  readonly api?: string
  readonly baseURL?: string
  readonly models?: readonly { readonly id: string }[]
}

/** The chosen route and the pi-ai provider profiles it needs. */
export interface LlmChoice {
  /** The route fresh agents start on. */
  readonly provider: string
  /** The model fresh agents start on. */
  readonly model: string
  /** Profiles for `llm-pi-ai`; empty when the DeepSeek routes serve. */
  readonly providers: Readonly<Record<string, ProviderProfile>>
  /** A short phrase naming where the choice came from, for the banner. */
  readonly source: string
  /** Set when nothing usable was found; the chat still starts and the first request explains. */
  readonly missing?: string
}

/** Thrown for a request the flags and environment cannot satisfy. */
export class LlmSelectionError extends Error {}

function firstSet(env: Readonly<Record<string, string | undefined>>, names: readonly string[]): string | undefined {
  return names.find(name => (env[name] ?? '') !== '')
}

function keyEnvOf(provider: string): readonly string[] {
  return KEY_ENV[provider] ?? [`${provider.replace(/[^A-Za-z0-9]+/gu, '_').toUpperCase()}_API_KEY`]
}

function modelFor(provider: string, flags: LlmFlags, catalog: Catalog): string {
  const model = flags.model ?? DEFAULT_MODEL[provider] ?? catalog.firstModel(provider)
  if (model === undefined) throw new LlmSelectionError(`provider "${provider}" has no models; pass --model`)
  return model
}

/** Every environment variable name that could hold a key, for the "no key found" message. */
export function knownKeyNames(): string[] {
  return ['DEEPSEEK_API_KEY', ...PREFERENCE.flatMap(provider => keyEnvOf(provider)), CUSTOM_KEY_ENV]
}

/**
 * Decide which route the chat starts on.
 * @param env - the process environment.
 * @param flags - `--provider`, `--model`, `--base-url`, and `--api-key-env`.
 * @param catalog - the providers and models pi-ai ships.
 * @returns the route, model, and provider profiles to configure.
 * @throws {LlmSelectionError} when a flag cannot be satisfied: an unknown provider,
 *   a missing key for a named provider, or an endpoint without a model.
 */
export function chooseLlm(env: Readonly<Record<string, string | undefined>>, flags: LlmFlags, catalog: Catalog): LlmChoice {
  const baseUrl = flags.baseUrl ?? (env['CORTEX_BASE_URL'] === '' ? undefined : env['CORTEX_BASE_URL'])
  if (baseUrl !== undefined) {
    const model = flags.model ?? (env['CORTEX_MODEL'] === '' ? undefined : env['CORTEX_MODEL'])
    if (model === undefined) throw new LlmSelectionError('--base-url needs a model: pass --model or set CORTEX_MODEL')
    const keyName = flags.apiKeyEnv ?? CUSTOM_KEY_ENV
    if (flags.apiKeyEnv !== undefined && (env[keyName] ?? '') === '') {
      throw new LlmSelectionError(`--api-key-env ${keyName} is not set`)
    }
    const keyed = (env[keyName] ?? '') !== ''
    return {
      provider: CUSTOM_ROUTE,
      model,
      providers: {
        [CUSTOM_ROUTE]: {
          displayName: 'Custom endpoint',
          api: 'openai-completions',
          baseURL: baseUrl,
          ...keyed ? { apiKeyEnv: keyName } : {},
          models: [{ id: model }],
        },
      },
      source: `endpoint ${baseUrl}`,
    }
  }

  if (flags.provider !== undefined) {
    const provider = flags.provider
    if (provider === 'deepseek' || provider === DEEPSEEK_ROUTE) {
      return { provider: DEEPSEEK_ROUTE, model: flags.model ?? 'deepseek-flash', providers: {}, source: 'DEEPSEEK_API_KEY' }
    }
    if (!catalog.providers().includes(provider)) {
      throw new LlmSelectionError(`unknown provider "${provider}"; known providers include ${PREFERENCE.join(', ')}`)
    }
    const names = flags.apiKeyEnv === undefined ? keyEnvOf(provider) : [flags.apiKeyEnv]
    const found = firstSet(env, names)
    if (found === undefined) throw new LlmSelectionError(`no API key for ${provider}: set ${names.join(' or ')}`)
    return { provider, model: modelFor(provider, flags, catalog), providers: { [provider]: { apiKeyEnv: found } }, source: found }
  }

  if ((env['DEEPSEEK_API_KEY'] ?? '') !== '') {
    return { provider: DEEPSEEK_ROUTE, model: flags.model ?? 'deepseek-flash', providers: {}, source: 'DEEPSEEK_API_KEY' }
  }

  const known = new Set(catalog.providers())
  const others = catalog.providers().filter(name => !(PREFERENCE as readonly string[]).includes(name) && name !== 'deepseek').sort()
  for (const provider of [...PREFERENCE, ...others]) {
    if (!known.has(provider)) continue
    const found = firstSet(env, keyEnvOf(provider))
    if (found === undefined) continue
    return { provider, model: modelFor(provider, flags, catalog), providers: { [provider]: { apiKeyEnv: found } }, source: found }
  }

  return {
    provider: DEEPSEEK_ROUTE,
    model: flags.model ?? 'deepseek-flash',
    providers: {},
    source: 'none',
    missing: `no API key found; set one of ${knownKeyNames().join(', ')}, or pass --base-url and --model for an OpenAI-compatible endpoint`,
  }
}
