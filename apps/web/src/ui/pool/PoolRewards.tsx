'use client'

import type { V2Pool } from '@sushiswap/graph-client/data-api'
import {
  Card,
  CardContent,
  CardCurrencyAmountItem,
  CardDescription,
  CardGroup,
  CardHeader,
  CardLabel,
  CardTitle,
} from '@sushiswap/ui'
import type { FC } from 'react'
import { incentiveRewardToToken } from 'src/lib/functions'
import { tryParseAmount } from 'sushi/currency'

export const PoolRewards: FC<{ pool: V2Pool }> = ({ pool }) => {
  const incentives = pool.incentives.filter(
    (incentive) => incentive.rewardPerDay > 0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rewards</CardTitle>
        <CardDescription>
          Distributed to everyone who provides liquidity to this pool. <br />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CardGroup>
          <CardLabel>Tokens (per day)</CardLabel>
          {incentives.map((incentive, index) => {
            const amount = tryParseAmount(
              incentive.rewardPerDay.toString(),
              incentiveRewardToToken(pool.chainId, incentive),
            )
            return <CardCurrencyAmountItem key={index} amount={amount} />
          })}
        </CardGroup>
      </CardContent>
    </Card>
  )
}
