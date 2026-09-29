/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@cortex-ai/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('cortex-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      cortex?: { bundle?: { patch?: string } }
    }
    expect(manifest.cortex?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.cortex!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@cortex-ai/cortex-sdk-app'],
      ['sdk-jsonrpc-server', '@cortex-ai/cortex-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@cortex-ai/cortex-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@cortex-ai/cortex-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@cortex-ai/cortex-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@cortex-ai/cortex-llm-deepseek-api-key'],
      ['sandbox', '@cortex-ai/cortex-sandbox-local'],
      ['session-projection', '@cortex-ai/cortex-session-projection'],
      ['sandbox-policy', '@cortex-ai/cortex-sandbox-policy'],
      ['subprocess', '@cortex-ai/cortex-subprocess-local'],
      ['pty', '@cortex-ai/cortex-terminal'],
      ['terminal-bash', '@cortex-ai/cortex-terminal-bash'],
      ['terminal-pwsh', '@cortex-ai/cortex-terminal-bash'],
      ['timer', '@cortex-ai/cordis-plugin-timer'],
      ['llm', '@cortex-ai/cortex-llm'],
      ['session', '@cortex-ai/cortex-session'],
      ['session-title', '@cortex-ai/cortex-session-title'],
      ['system-prompt', '@cortex-ai/cortex-system-prompt'],
      ['tools', '@cortex-ai/cortex-tools'],
      ['mcp-resources', '@cortex-ai/cortex-mcp-resources'],
      ['agent', '@cortex-ai/cortex-agent'],
      ['llm-retry', '@cortex-ai/cortex-llm-retry'],
      ['jobs', '@cortex-ai/cortex-jobs-local'],
      ['invariants', '@cortex-ai/cortex-invariants'],
      ['session-invariant', '@cortex-ai/cortex-session/invariant'],
      ['agent-invariant', '@cortex-ai/cortex-agent/invariant'],
      ['scope-invariant', '@cortex-ai/cortex-scope/invariant'],
      ['agent-loop-invariant', '@cortex-ai/cortex-agent-loop/invariant'],
      ['agent-loop', '@cortex-ai/cortex-agent-loop'],
      ['persistent-bash', '@cortex-ai/cortex-tool-bash-persistent'],
      ['persistent-pwsh', '@cortex-ai/cortex-tool-pwsh-persistent'],
      ['sessions', '@cortex-ai/cortex-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-deepseek')?.config).toEqual({
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.CORTEX_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.CORTEX_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
