/** Choosing the model route from the flags and whichever API key is set. */

import { describe, expect, it } from 'vitest'
import { piAiCatalog } from '../src/catalog.ts'
import { CUSTOM_ROUTE, DEEPSEEK_ROUTE, LlmSelectionError, chooseLlm, knownKeyNames } from '../src/llm-select.ts'
import type { Catalog } from '../src/llm-select.ts'

const catalog: Catalog = {
  providers: () => ['anthropic', 'openai', 'google', 'openrouter', 'amazon-bedrock', 'acme', 'empty', 'deepseek', 'fireworks'],
  firstModel: provider => (provider === 'empty' ? undefined : `${provider}-first`),
}

describe('chooseLlm without flags', () => {
  it('keeps the DeepSeek route when its key is set, even beside other keys', () => {
    const choice = chooseLlm({ DEEPSEEK_API_KEY: 'k', OPENAI_API_KEY: 'k' }, {}, catalog)
    expect(choice).toEqual({ provider: DEEPSEEK_ROUTE, model: 'deepseek-flash', providers: {}, source: 'DEEPSEEK_API_KEY' })
  })

  it('uses the first provider with a key, in preference order', () => {
    expect(chooseLlm({ OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' }, {}, catalog)).toEqual({
      provider: 'anthropic', model: 'claude-sonnet-4-6', providers: { anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY' } }, source: 'ANTHROPIC_API_KEY',
    })
    expect(chooseLlm({ OPENAI_API_KEY: 'k' }, {}, catalog).model).toBe('gpt-5')
  })

  it('accepts an alternate key variable, skips empty values, and honors --model', () => {
    const choice = chooseLlm({ GEMINI_API_KEY: '', GOOGLE_API_KEY: 'k', OPENAI_API_KEY: '' }, { model: 'gemini-2.5-flash' }, catalog)
    expect(choice).toMatchObject({ provider: 'google', model: 'gemini-2.5-flash', providers: { google: { apiKeyEnv: 'GOOGLE_API_KEY' } } })
  })

  it('finds providers outside the preference list by their conventional variable, in name order', () => {
    const choice = chooseLlm({ ACME_API_KEY: 'k', AMAZON_BEDROCK_API_KEY: 'k' }, {}, catalog)
    expect(choice).toMatchObject({ provider: 'acme', model: 'acme-first', providers: { acme: { apiKeyEnv: 'ACME_API_KEY' } } })
  })

  it('falls back to a provider first model and skips preferred providers the catalog lacks', () => {
    expect(chooseLlm({ FIREWORKS_API_KEY: 'k' }, {}, catalog).model).toBe('fireworks-first')
    expect(chooseLlm({ XAI_API_KEY: 'k' }, {}, catalog)).toMatchObject({ provider: DEEPSEEK_ROUTE })
  })

  it('starts on the DeepSeek route with an explanation when no key is found', () => {
    const choice = chooseLlm({}, { model: 'x' }, catalog)
    expect(choice).toMatchObject({ provider: DEEPSEEK_ROUTE, model: 'x', providers: {}, source: 'none' })
    expect(choice.missing).toContain('ANTHROPIC_API_KEY')
    expect(choice.missing).toContain('--base-url')
  })

  it('rejects a provider without models', () => {
    expect(() => chooseLlm({ EMPTY_API_KEY: 'k' }, {}, catalog)).toThrow('provider "empty" has no models')
  })
})

describe('chooseLlm with --provider', () => {
  it('uses the named provider with its own key and default model', () => {
    expect(chooseLlm({ OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' }, { provider: 'openai' }, catalog)).toEqual({
      provider: 'openai', model: 'gpt-5', providers: { openai: { apiKeyEnv: 'OPENAI_API_KEY' } }, source: 'OPENAI_API_KEY',
    })
  })

  it('reads the key from --api-key-env and reports a variable that is not set', () => {
    expect(chooseLlm({ MY_KEY: 'k' }, { provider: 'openrouter', apiKeyEnv: 'MY_KEY' }, catalog).providers).toEqual({ openrouter: { apiKeyEnv: 'MY_KEY' } })
    expect(() => chooseLlm({}, { provider: 'openrouter', apiKeyEnv: 'MY_KEY' }, catalog)).toThrow('no API key for openrouter: set MY_KEY')
  })

  it('names the variables to set when the provider has no key', () => {
    expect(() => chooseLlm({}, { provider: 'google' }, catalog)).toThrow('set GEMINI_API_KEY or GOOGLE_API_KEY')
  })

  it('rejects an unknown provider and maps deepseek to the shipped route', () => {
    expect(() => chooseLlm({}, { provider: 'nope' }, catalog)).toThrow(LlmSelectionError)
    expect(chooseLlm({}, { provider: 'deepseek' }, catalog)).toMatchObject({ provider: DEEPSEEK_ROUTE, model: 'deepseek-flash', providers: {} })
    expect(chooseLlm({}, { provider: DEEPSEEK_ROUTE, model: 'deepseek-v4-pro' }, catalog).model).toBe('deepseek-v4-pro')
  })
})

describe('chooseLlm with an endpoint', () => {
  it('declares an OpenAI-compatible route, with a key when CORTEX_API_KEY is set', () => {
    const choice = chooseLlm({ CORTEX_API_KEY: 'k' }, { baseUrl: 'http://localhost:11434/v1', model: 'llama3.3' }, catalog)
    expect(choice).toEqual({
      provider: CUSTOM_ROUTE,
      model: 'llama3.3',
      providers: {
        custom: {
          displayName: 'Custom endpoint', api: 'openai-completions', baseURL: 'http://localhost:11434/v1', apiKeyEnv: 'CORTEX_API_KEY', models: [{ id: 'llama3.3' }],
        },
      },
      source: 'endpoint http://localhost:11434/v1',
    })
  })

  it('needs no key for a local server, and reads the endpoint and model from the environment', () => {
    const choice = chooseLlm({ CORTEX_BASE_URL: 'http://x/v1', CORTEX_MODEL: 'm' }, {}, catalog)
    expect(choice.providers['custom']).not.toHaveProperty('apiKeyEnv')
    expect(choice.model).toBe('m')
  })

  it('uses --api-key-env, and fails when that variable is empty or the model is missing', () => {
    expect(chooseLlm({ GW_KEY: 'k' }, { baseUrl: 'http://x', model: 'm', apiKeyEnv: 'GW_KEY' }, catalog).providers['custom']).toHaveProperty('apiKeyEnv', 'GW_KEY')
    expect(() => chooseLlm({}, { baseUrl: 'http://x', model: 'm', apiKeyEnv: 'GW_KEY' }, catalog)).toThrow('--api-key-env GW_KEY is not set')
    expect(() => chooseLlm({}, { baseUrl: 'http://x' }, catalog)).toThrow('--base-url needs a model')
    expect(() => chooseLlm({ CORTEX_BASE_URL: '', CORTEX_MODEL: '' }, {}, catalog)).not.toThrow()
    expect(() => chooseLlm({ CORTEX_BASE_URL: 'http://x', CORTEX_MODEL: '' }, {}, catalog)).toThrow('--base-url needs a model')
  })
})

describe('key names and the real catalog', () => {
  it('lists the variables a user can set', () => {
    const names = knownKeyNames()
    expect(names).toContain('DEEPSEEK_API_KEY')
    expect(names).toContain('OPENAI_API_KEY')
    expect(names).toContain('GEMINI_API_KEY')
    expect(names.at(-1)).toBe('CORTEX_API_KEY')
  })

  it('reads providers and models from pi-ai', () => {
    expect(piAiCatalog.providers()).toContain('anthropic')
    expect(typeof piAiCatalog.firstModel('anthropic')).toBe('string')
    expect(piAiCatalog.firstModel('not-a-provider')).toBeUndefined()
  })
})
