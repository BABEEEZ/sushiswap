import type { Pool } from '@sushiswap/graph-client/data-api'
import {
  Currency,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sushiswap/ui'
import type { FC, ReactNode } from 'react'
import React from 'react'
import { formatPercent } from 'sushi/format'

interface APRWithRewardsHoverCardProps {
  children: ReactNode
  pool: Pool
  showEmissions?: boolean
  smartPoolAPR?: number
}

export const APRWithRewardsHoverCard: FC<APRWithRewardsHoverCardProps> = ({
  children,
  pool,
  smartPoolAPR,
}) => {
  const feeApr1d =
    typeof smartPoolAPR === 'number' ? smartPoolAPR : pool.feeApr1d

  const totalAPR = (feeApr1d + pool.incentiveApr) * 100

  const card = (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">
          APR is calculated based on the fees
          {pool.isIncentivized ? ' and rewards' : ''} generated by the pool over
          the last 24 hours. The APR displayed is algorithmic and subject to
          change.
        </span>
        <div className="flex flex-col gap-6 bg-background px-4 py-2 rounded-xl">
          <div className="flex flex-col gap-3">
            {typeof smartPoolAPR === 'number' ? (
              <div className="flex justify-between gap-1 items-center">
                <span className="font-medium">Smart pool APR</span>
                <span className="text-muted-foreground">
                  {formatPercent(smartPoolAPR)}
                </span>
              </div>
            ) : (
              <div className="flex justify-between gap-1 items-center">
                <span className="font-medium">Fees</span>
                <span className="text-muted-foreground">
                  {formatPercent(pool.feeApr1d)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-1 items-center">
              <span className="font-medium ">Rewards</span>
              <span className="text-muted-foreground">
                {formatPercent(pool.incentiveApr)}
              </span>
            </div>
          </div>

          <div className="flex justify-between gap-1 items-center">
            <span className="font-medium">Total</span>
            <span className="font-bold">{formatPercent(totalAPR / 100)}</span>
          </div>
        </div>
      </div>

      {pool.incentives.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Reward per day</span>
          <div className="flex flex-col gap-6 bg-background px-4 py-2 rounded-xl">
            {pool.incentives.map((incentive) => (
              <div
                key={incentive.id}
                className="flex justify-between gap-1 items-center"
              >
                <span className="flex gap-1.5 items-center">
                  <Currency.Icon
                    width={28}
                    height={28}
                    currency={incentive.rewardToken}
                  />
                  <span className="font-medium">
                    {incentive.rewardPerDay} {incentive.rewardToken.symbol}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {formatPercent(incentive.apr)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <div className="hidden sm:block">
        <HoverCard openDelay={300} closeDelay={0}>
          <HoverCardTrigger asChild className="cursor-pointer">
            {children}
          </HoverCardTrigger>
          <HoverCardContent side="right" className="!p-0 max-w-[320px]">
            {card}
          </HoverCardContent>
        </HoverCard>
      </div>
      <div className="block sm:hidden">
        <Popover>
          <PopoverTrigger
            onClick={(e) => e.stopPropagation()}
            asChild
            className="cursor-pointer"
          >
            {children}
          </PopoverTrigger>
          <PopoverContent side="right" className="!p-0 max-w-[320px]">
            {card}
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
