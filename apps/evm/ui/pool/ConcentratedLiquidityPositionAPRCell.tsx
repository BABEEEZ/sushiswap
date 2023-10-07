import { CardDescription, CardHeader, CardTitle, HoverCard, HoverCardContent, HoverCardTrigger } from '@sushiswap/ui'
import { ConcentratedLiquidityPositionWithV3Pool } from '@sushiswap/wagmi/future'
import { Row } from '@tanstack/react-table'
import { FC } from 'react'

export const ConcentratedLiquidityPositionAPRCell: FC<Row<ConcentratedLiquidityPositionWithV3Pool>> = () => {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <span className="underline decoration-dotted underline-offset-2">
          {/*{formatPercent(props.row.original.totalApr1d)}*/}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="right" className="!p-0 max-w-[320px]">
        <CardHeader>
          <CardTitle>
            {/*{formatPercent(props.row.original.totalApr1d)}{' '}*/}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {/*Fees {props.row.original.incentives.length > 0 ? '+ Rewards' : ''}*/}
            </span>
          </CardTitle>
          <CardDescription className="text-xs font-normal">
            {/*APR is calculated based on the fees{props.row.original.incentives.length > 0 ? ' and rewards' : ''}{' '}*/}
            {/*generated by the pool over the last 24 hours. <b>The APR displayed is algorithmic and subject to change.</b>*/}
          </CardDescription>
        </CardHeader>
        {/*{props.row.original.incentives.length > 0 ? (*/}
        {/*  <CardContent>*/}
        {/*    <Reply>*/}
        {/*      <ReplyContent>*/}
        {/*        <p className="text-xs text-muted-foreground mb-1">Reward emissions (per day)</p>*/}
        {/*        <ul className="list-disc space-y-1">*/}
        {/*          {props.row.original.incentives.map((el, i) => {*/}
        {/*            const amount = tryParseAmount(*/}
        {/*              el.rewardPerDay.toString(),*/}
        {/*              incentiveRewardToToken(props.row.original.chainId as ChainId, el)*/}
        {/*            )*/}
        {/*            if (!amount) return null*/}

        {/*            return (*/}
        {/*              <li key={i} className="flex items-center gap-1">*/}
        {/*                <Currency.Icon currency={amount?.currency} width={12} height={12} />*/}
        {/*                {amount?.toSignificant(6)} {amount?.currency.symbol}*/}
        {/*              </li>*/}
        {/*            )*/}
        {/*          })}*/}
        {/*        </ul>*/}
        {/*      </ReplyContent>*/}
        {/*    </Reply>*/}
        {/*  </CardContent>*/}
        {/*) : null}*/}
      </HoverCardContent>
    </HoverCard>
  )
}
