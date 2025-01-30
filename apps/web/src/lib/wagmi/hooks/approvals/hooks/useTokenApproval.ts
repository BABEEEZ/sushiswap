'use client'

import { createErrorToast, createToast } from '@sushiswap/notifications'
import { InterfaceEventName, sendAnalyticsEvent } from '@sushiswap/telemetry'
import { useCallback, useMemo, useState } from 'react'
import { erc20Abi_approve } from 'sushi/abi'
import { Amount, Type } from 'sushi/currency'
import {
  Address,
  ContractFunctionZeroDataError,
  SendTransactionReturnType,
  UserRejectedRequestError,
  maxUint256,
} from 'viem'
import {
  useAccount,
  usePublicClient,
  useSimulateContract,
  useWriteContract,
} from 'wagmi'

import { ERC20ApproveABI, ERC20ApproveArgs } from './types'
import { useTokenAllowance } from './useTokenAllowance'

const old_erc20Abi_approve = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export enum ApprovalState {
  LOADING = 'LOADING',
  UNKNOWN = 'UNKNOWN',
  NOT_APPROVED = 'NOT_APPROVED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

interface UseTokenApprovalParams {
  spender: Address | undefined
  amount: Amount<Type> | undefined
  approveMax?: boolean
  enabled?: boolean
}

export const useTokenApproval = ({
  amount,
  spender,
  enabled = true,
  approveMax,
}: UseTokenApprovalParams) => {
  const { address } = useAccount()
  const [pending, setPending] = useState(false)
  const client = usePublicClient()
  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch,
  } = useTokenAllowance({
    token: amount?.currency?.wrapped,
    owner: address,
    spender,
    chainId: amount?.currency.chainId,
    enabled: Boolean(amount?.currency?.isToken && enabled),
  })

  const simulationEnabled = Boolean(
    amount && spender && address && allowance && enabled && !isAllowanceLoading,
  )

  const standardSimulation = useSimulateContract<
    ERC20ApproveABI,
    'approve',
    ERC20ApproveArgs
  >({
    chainId: amount?.currency.chainId,
    abi: erc20Abi_approve,
    address: amount?.currency?.wrapped?.address as Address,
    functionName: 'approve',
    args: [
      spender as Address,
      approveMax ? maxUint256 : amount ? amount.quotient : 0n,
    ],
    query: {
      enabled: simulationEnabled,
      retry: (failureCount, error) => {
        if (error instanceof ContractFunctionZeroDataError) return false
        return failureCount < 2
      },
    },
  })

  const fallbackSimulationEnabled = Boolean(
    standardSimulation.isError &&
      standardSimulation.error instanceof ContractFunctionZeroDataError &&
      simulationEnabled,
  )

  const fallbackSimulation = useSimulateContract<
    typeof old_erc20Abi_approve,
    'approve',
    ERC20ApproveArgs
  >({
    chainId: amount?.currency.chainId,
    abi: old_erc20Abi_approve,
    address: amount?.currency?.wrapped?.address as Address,
    functionName: 'approve',
    args: [
      spender as Address,
      approveMax ? maxUint256 : amount ? amount.quotient : 0n,
    ],
    query: {
      enabled: fallbackSimulationEnabled,
    },
  })

  const { data: simulation } = fallbackSimulationEnabled
    ? fallbackSimulation
    : standardSimulation

  const onSuccess = useCallback(
    async (data: SendTransactionReturnType) => {
      if (!amount) return

      sendAnalyticsEvent(InterfaceEventName.APPROVE_TOKEN_TXN_SUBMITTED, {
        chain_id: amount.currency.chainId,
        token_address: amount.currency.wrapped.address,
        token_symbol: amount.currency.symbol,
      })
      setPending(true)
      try {
        const ts = new Date().getTime()
        const receiptPromise = client.waitForTransactionReceipt({
          hash: data,
        })

        void createToast({
          account: address,
          type: 'approval',
          chainId: amount.currency.chainId,
          txHash: data,
          promise: receiptPromise,
          summary: {
            pending: `Approving ${amount.currency.symbol}`,
            completed: `Successfully approved ${amount.currency.symbol}`,
            failed: `Something went wrong approving ${amount.currency.symbol}`,
          },
          groupTimestamp: ts,
          timestamp: ts,
        })

        await receiptPromise
        await refetch()
      } finally {
        setPending(false)
      }
    },
    [refetch, client, amount, address],
  )

  const onError = useCallback((e: Error) => {
    if (e instanceof Error) {
      if (!(e.cause instanceof UserRejectedRequestError)) {
        createErrorToast(e.message, true)
      }
    }
  }, [])

  const execute = useWriteContract({
    // ...data?.request,
    mutation: {
      onError,
      onSuccess,
    },
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: Typecheck speedup
  const write = useMemo(
    () => {
      if (!execute.writeContract || !simulation?.request) return

      return () => execute.writeContract(simulation.request as any)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [execute.writeContract, simulation?.request] as const,
  )

  return useMemo<[ApprovalState, { write: undefined | (() => void) }]>(() => {
    let state = ApprovalState.UNKNOWN
    if (amount?.currency.isNative) state = ApprovalState.APPROVED
    else if (allowance && amount && allowance.greaterThan(amount))
      state = ApprovalState.APPROVED
    else if (allowance && amount && allowance.equalTo(amount))
      state = ApprovalState.APPROVED
    else if (pending) state = ApprovalState.PENDING
    else if (isAllowanceLoading) state = ApprovalState.LOADING
    else if (allowance && amount && allowance.lessThan(amount))
      state = ApprovalState.NOT_APPROVED

    return [state, { write }]
  }, [allowance, amount, write, isAllowanceLoading, pending])
}
