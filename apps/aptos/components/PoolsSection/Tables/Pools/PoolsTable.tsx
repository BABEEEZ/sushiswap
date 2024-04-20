import { useDebounce } from '@sushiswap/hooks'
import { Card, CardHeader, CardTitle, DataTable } from '@sushiswap/ui'
import {
  ColumnDef,
  PaginationState,
  SortingState,
  TableState,
} from '@tanstack/react-table'
import { usePoolFilters } from 'components/PoolFiltersProvider'
import React, { useCallback, useMemo, useState } from 'react'
import { useFarms } from 'utils/hooks/useFarms'
import { useNetwork } from 'utils/hooks/useNetwork'
import { Pool, usePools } from 'utils/hooks/usePools'
import { NAME_COLUMN, RESERVE_COLUMN, TVL_COLUMN } from './columns'

const COLUMNS = [
  NAME_COLUMN,
  TVL_COLUMN,
  // APR_COLUMN,
  RESERVE_COLUMN,
] satisfies ColumnDef<Pool, unknown>[]

export const PoolsTable = () => {
  const { tokenSymbols, farmsOnly } = usePoolFilters()

  const { data: pools, isLoading } = usePools()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'TVL', desc: true },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data: farms } = useFarms()

  const {
    contracts: { swap: swapContract },
  } = useNetwork()

  const farmFilter = useMemo(() => {
    return pools?.filter((pool) => {
      const lpAddress = pool.id
      const _isFarm = farms?.data?.lps.indexOf(
        `${swapContract}::swap::LPToken<${lpAddress}>`,
      )
      return _isFarm !== -1
    })
  }, [pools, farms, swapContract])

  const rowLink = useCallback((row: Pool) => {
    return `/pool/${row.id}`
  }, [])

  const data = useMemo(
    () =>
      !farmsOnly
        ? pools
            ?.flat()
            .filter((el) =>
              tokenSymbols.length > 0
                ? tokenSymbols.includes(
                    el.data.token_x_details.symbol.toLowerCase(),
                  ) ||
                  tokenSymbols.includes(
                    el.data.token_y_details.symbol.toLowerCase(),
                  )
                : true,
            ) || []
        : farmFilter?.flat() || [],
    [pools, farmsOnly, farmFilter, tokenSymbols],
  )

  const debouncedQuery = useDebounce(
    tokenSymbols.join(' ').trimStart().toLowerCase(),
    400,
  )

  const tableData = useMemo(() => {
    if (debouncedQuery.split(' ')[0] === '') return data
    return data.filter(
      (pool) =>
        debouncedQuery
          ?.split(' ')
          .includes(pool.data.token_x_details.symbol.toLowerCase()) ||
        debouncedQuery
          ?.split(' ')
          .includes(pool.data.token_y_details.symbol.toLowerCase()),
    )
  }, [debouncedQuery, data])

  const state: Partial<TableState> = useMemo(() => {
    return {
      sorting,
      pagination,
    }
  }, [sorting, pagination])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Pools{' '}
          {tableData?.length ? (
            <span className="text-gray-400 dark:text-slate-500">
              ({tableData?.length})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <DataTable
        state={state}
        onSortingChange={setSorting}
        onPaginationChange={setPagination}
        loading={!pools && isLoading}
        linkFormatter={rowLink}
        columns={COLUMNS}
        data={data}
        pagination={true}
      />
    </Card>
  )
}
