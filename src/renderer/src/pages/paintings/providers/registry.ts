import { aihubmixProvider } from './aihubmix'
import { ovmsProvider, siliconProvider, zhipuProvider } from './coreProviders'
import { dmxapiProvider } from './dmxapi'
import { ppioProvider } from './ppio'
import type { PaintingProviderDefinition } from './shared/provider'
import { tokenFluxProvider } from './tokenflux'

export const providerRegistry: Record<string, PaintingProviderDefinition> = {
  ovms: ovmsProvider,
  ppio: ppioProvider,
  zhipu: zhipuProvider,
  silicon: siliconProvider,
  aihubmix: aihubmixProvider,
  dmxapi: dmxapiProvider,
  tokenflux: tokenFluxProvider
}
