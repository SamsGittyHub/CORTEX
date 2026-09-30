/**
 * The pi-ai provider and model catalog, read where the launch options are parsed.
 * @module @cortex-ai/cortex-tui/catalog
 */

import { getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all'
import type { Catalog } from './llm-select.ts'

/** The catalog pi-ai ships with this installation. */
export const piAiCatalog: Catalog = {
  providers: () => getBuiltinProviders(),
  firstModel: provider => getBuiltinModels(provider as Parameters<typeof getBuiltinModels>[0])[0]?.id,
}
