'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { Amount, Token } from 'sushi/currency'
import { Address, erc20Abi } from 'viem'
import { useBlockNumber, useReadContracts } from 'wagmi'

function bigIntToCurrencyAmount(totalSupply?: bigint, token?: Token) {
  return token?.isToken && totalSupply
    ? Amount.fromRawAmount(token, totalSupply.toString())
    : undefined
}

export const useMultipleTotalSupply = (
  tokens?: Token[],
): Record<string, Amount<Token> | undefined> | undefined => {
  const contracts = useMemo(() => {
    return (
      tokens?.map((token) => {
        return {
          address: token.wrapped.address as Address,
          chainId: token.chainId,
          abi: erc20Abi,
          functionName: 'totalSupply' as const,
        }
      }) || []
    )
  }, [tokens])

  const queryClient = useQueryClient()

  const { data, ...query } = useReadContracts({
    contracts,
    query: {
      enabled: tokens && tokens.length > 0,
      keepPreviousData: true,
    },
  })

  const { data: blockNumber } = useBlockNumber({ watch: true })

  useEffect(() => {
    if (blockNumber) {
      queryClient.invalidateQueries(
        query.queryKey,
        {},
        { cancelRefetch: false },
      )
    }
  }, [blockNumber, queryClient, query.queryKey])

  return useMemo(() => {
    return data
      ?.map((cs, i) => bigIntToCurrencyAmount(cs.result, tokens?.[i]))
      .reduce<Record<string, Amount<Token> | undefined>>((acc, curr, i) => {
        if (curr && tokens?.[i]) {
          acc[tokens[i]?.wrapped.address] = curr
        }
        return acc
      }, {})
  }, [data, tokens])
}

// returns undefined if input token is undefined, or fails to get token contract,
// or contract total supply cannot be fetched
export const useTotalSupply = (token?: Token): Amount<Token> | undefined => {
  const tokens = useMemo(() => (token ? [token] : undefined), [token])
  const resultMap = useMultipleTotalSupply(tokens)
  return useMemo(
    () => (token ? resultMap?.[token.wrapped.address] : undefined),
    [resultMap, token],
  )
}
