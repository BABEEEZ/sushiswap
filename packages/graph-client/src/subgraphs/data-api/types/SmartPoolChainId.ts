// This file is auto-generated by scripts/update-data-api-types.ts
import type { ChainId } from 'sushi/chain'

export const SmartPoolChainIds = [137,56,10,42161,1088,8453,43114,1101,2222,59144,534352,250,81457,30] as const
export type SmartPoolChainId = typeof SmartPoolChainIds[number]
export function isSmartPoolChainId(value: ChainId): value is SmartPoolChainId {return SmartPoolChainIds.includes(value as SmartPoolChainId)}