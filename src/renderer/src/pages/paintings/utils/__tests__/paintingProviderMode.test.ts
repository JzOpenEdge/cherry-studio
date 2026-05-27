import { describe, expect, it } from 'vitest'

import { providerRegistry } from '../../providers/registry'
import { resolvePaintingTabForMode } from '../paintingProviderMode'

describe('resolvePaintingTabForMode', () => {
  const ppioProvider = providerRegistry.ppio
  const zhipuProvider = providerRegistry.zhipu

  it('returns the matching tab when a provider supports the requested db mode', () => {
    expect(resolvePaintingTabForMode(ppioProvider, 'generate')).toBe('generate')
  })

  it('treats generate and draw as compatible generation modes', () => {
    // ppio + zhipu single-tab providers map both `generate` and `draw` (legacy
    // alias from pre-v2 history rows) to their lone generate tab.
    expect(resolvePaintingTabForMode(ppioProvider, 'draw')).toBe('generate')
    expect(resolvePaintingTabForMode(zhipuProvider, 'draw')).toBe('default')
  })

  it('returns undefined when the provider does not support that db mode', () => {
    expect(resolvePaintingTabForMode(zhipuProvider, 'edit')).toBeUndefined()
    expect(resolvePaintingTabForMode(ppioProvider, 'edit')).toBeUndefined()
  })
})
