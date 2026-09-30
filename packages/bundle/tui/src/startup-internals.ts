/**
 * Process facts the startup provider reads, kept out of the `./startup` entry
 * so substituting them in tests adds no public package API.
 * @module @cortex-ai/cortex-tui/startup-internals
 */

import { piAiCatalog } from './catalog.ts'
import type { Catalog } from './llm-select.ts'

/** The process facts the provider reads; tests substitute them. */
export const internals: {
  env: () => Readonly<Record<string, string | undefined>>
  catalog: Catalog
} = {
  env: () => process.env,
  catalog: piAiCatalog,
}
