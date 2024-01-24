import {
  BONDS_SUBGRAPH_URL,
  type BondChainId,
  getBondDiscount,
  getMarketIdFromChainIdAuctioneerMarket,
  getMarketsPrices,
} from '@sushiswap/bonds-sdk'
import { createClient } from '@sushiswap/database'
import {
  type BondMarketsQueryVariables,
  getBuiltGraphSDK,
} from '@sushiswap/graph-client'
import { getSteerVaultReserves, getTotalSupply } from '@sushiswap/steer-sdk'
import { config } from '@sushiswap/viem-config'
import {
  getChainIdAddressFromId,
  getIdFromChainIdAddress,
  isPromiseFulfilled,
} from 'sushi'
import { type Address, createPublicClient, getAddress } from 'viem'
import { type BondsApiSchema } from '../../../pure/bonds/bonds/schema'
import { type Pools, getPools } from '../../../pure/pools/pools/pools'
import {
  type SteerVaults,
  getSteerVaults,
} from '../../../pure/steer-vault/vaults/vaults'
import { convertAuctionTypes } from '../common'
import { getTokenPricesChainV2 } from '../price'
import { BondSchema } from '../schema'

const isOpen = (start: bigint | null, end: bigint | null) =>
  (!start || Date.now() / 1000 > start) && end && Date.now() / 1000 < end

async function getQuoteToken({
  bond,
  prices,
  pools,
  vaults,
}: {
  bond: (typeof BondSchema)['_output']
  prices: Awaited<ReturnType<typeof getTokenPricesChainV2>>
  pools: Pools
  vaults: SteerVaults
}) {
  const quotePool = pools.find(
    (p) => p.address === bond.quoteToken.address.toLowerCase(),
  )

  const base = {
    ...bond.quoteToken,
    id: getIdFromChainIdAddress(bond.chainId, bond.quoteToken.address),
    decimals: Number(bond.quoteToken.decimals),
    chainId: bond.chainId,
    pool: undefined,
    vault: undefined,
  }

  if (quotePool) {
    const priceUSD =
      Number(quotePool.liquidityUSD) /
      (Number(quotePool.totalSupply) / 10 ** Number(bond.quoteToken.decimals))

    return {
      ...base,
      priceUSD,
      pool: {
        poolId: quotePool.id,
        token0: {
          ...quotePool.token0,
          address: quotePool.token0.address as Address,
          chainId: bond.chainId,
        },
        token1: {
          ...quotePool.token1,
          address: quotePool.token1.address as Address,
          chainId: bond.chainId,
        },
        liquidity: Number(quotePool.totalSupply),
        liquidityUSD: Number(quotePool.liquidityUSD),
        protocol: quotePool.protocol,
      },
    }
  }

  const quoteVault = vaults.find(
    (v) => v.address === bond.quoteToken.address.toLowerCase(),
  )

  if (quoteVault) {
    const client = createPublicClient(config[bond.chainId as BondChainId])
    const vaultId = getIdFromChainIdAddress(
      bond.chainId,
      quoteVault.address as Address,
    )

    const [{ reserve0, reserve1 }, totalSupply] = await Promise.all([
      getSteerVaultReserves({ client, vaultId }),
      getTotalSupply({ client, vaultId }),
    ])

    const token0PriceUSD = prices[getAddress(quoteVault.token0.address)]
    const token1PriceUSD = prices[getAddress(quoteVault.token1.address)]

    if (!token0PriceUSD || !token1PriceUSD)
      throw new Error(`Missing token prices for vaultId: ${vaultId}`)

    const reserve0USD =
      (Number(reserve0) / 10 ** quoteVault.token0.decimals) * token0PriceUSD
    const reserve1USD =
      (Number(reserve1) / 10 ** quoteVault.token1.decimals) * token1PriceUSD

    const reserveUSD = reserve0USD + reserve1USD

    const priceUSD = reserveUSD / (Number(totalSupply) / 10 ** base.decimals)

    return {
      ...base,
      name: 'Steer Vault',
      symbol: 'STEER',
      priceUSD,
      vault: {
        id: vaultId,
        poolId: quoteVault.pool.id,
        token0: {
          ...quoteVault.token0,
          address: quoteVault.token0.address as Address,
          chainId: bond.chainId,
          priceUSD: token0PriceUSD,
        },
        token1: {
          ...quoteVault.token1,
          address: quoteVault.token1.address as Address,
          chainId: bond.chainId,
          priceUSD: token1PriceUSD,
        },
      },
    }
  }

  const priceUSD = prices[getAddress(bond.quoteToken.address)]

  return {
    ...base,
    priceUSD,
  }
}

export async function getBondsFromSubgraph(
  args: typeof BondsApiSchema._output,
) {
  const auctioneers =
    args.ids?.map(({ auctioneerAddress }) => auctioneerAddress) || null
  const marketIdFilter =
    args.ids?.map(({ marketNumber }) => Number(marketNumber)) || null

  const auctionTypes = convertAuctionTypes(args.auctionTypes)

  const query = {
    first: args.take,
    where: {
      auctioneer_in: auctioneers,
      marketId_in: marketIdFilter,
      hasClosed: args.onlyOpen ? false : null,
      type_in: auctionTypes,
    },
  } satisfies BondMarketsQueryVariables

  Object.entries(query.where).map(([key, value]) => {
    if (value === null) delete query.where[key as keyof typeof query.where]
  })

  const client = await createClient()
  const issuersP = client.bondIssuer
    .findMany({
      select: {
        name: true,
        link: true,
        ids: {
          select: {
            id: true,
          },
        },
      },
      where: {
        isApproved: true,
      },
      cacheStrategy: {
        swr: 900,
        ttl: 300,
      },
    })
    .then((d) =>
      d.map((issuer) => ({ ...issuer, ids: issuer.ids.map(({ id }) => id) })),
    )

  const bonds = await Promise.allSettled(
    args.chainIds.map(async (chainId) => {
      const sdk = getBuiltGraphSDK({ url: BONDS_SUBGRAPH_URL[chainId] })

      const [{ bonds }, prices, issuers] = await Promise.all([
        sdk.BondMarkets(query),
        getTokenPricesChainV2({ chainId }),
        issuersP,
      ])

      const bondsParsed = bonds
        .map((bond) => BondSchema.safeParse(bond))
        .flatMap((bond) => {
          if (!bond.success) {
            console.error(bond.error)
            return []
          }
          return bond.data
        })
        .filter((bond) => {
          if (
            !args.anyIssuer &&
            !issuers.some((issuer) =>
              issuer.ids.some((id) => {
                const { chainId, address } = getChainIdAddressFromId(id)
                return (
                  chainId === bond.chainId &&
                  address.toLowerCase() === bond.owner.toLowerCase()
                )
              }),
            )
          ) {
            return false
          }

          if (auctioneers && !auctioneers?.includes(bond.auctioneer)) {
            return false
          }

          if (
            marketIdFilter &&
            !marketIdFilter?.includes(Number(bond.marketId))
          ) {
            return false
          }

          if (args.onlyOpen && !isOpen(bond.start, bond.conclusion)) {
            return false
          }

          return true
        })

      const marketIds = bondsParsed.map((bond) =>
        getMarketIdFromChainIdAuctioneerMarket({
          chainId,
          auctioneerAddress: bond.auctioneer,
          marketNumber: bond.marketId,
        }),
      )

      const [marketPricesS, poolsS, vaultsS] = await Promise.allSettled([
        getMarketsPrices({
          client: createPublicClient(config[chainId]),
          marketIds,
        }),
        getPools({
          chainIds: [chainId],
          ids: bondsParsed.map((bond) =>
            getIdFromChainIdAddress(chainId, bond.quoteToken.address),
          ),
        }),
        getSteerVaults({
          chainIds: [chainId],
          ids: bondsParsed.map((bond) =>
            getIdFromChainIdAddress(chainId, bond.quoteToken.address),
          ),
        }),
      ])

      if (!isPromiseFulfilled(marketPricesS))
        throw new Error(`Failed to fetch marketPrices on ${chainId}`)

      const marketPrices = marketPricesS.value
      const pools = isPromiseFulfilled(poolsS) ? poolsS.value : []
      const vaults = isPromiseFulfilled(vaultsS) ? vaultsS.value : []

      const processed = Promise.allSettled(
        bondsParsed.flatMap(async (bond, i) => {
          const quoteToken = await getQuoteToken({
            bond,
            prices,
            pools,
            vaults,
          })

          const payoutTokenPriceUSD =
            prices[getAddress(bond.payoutToken.address)]

          const marketId = marketIds[i]!
          const marketPrice = marketPrices.find(
            (el) => el.marketId === marketId,
          )?.marketPrice

          const issuer = issuers.find((issuer) =>
            issuer.ids.some((id) => {
              const { chainId, address } = getChainIdAddressFromId(id)
              return (
                chainId === bond.chainId &&
                address.toLowerCase() === bond.owner.toLowerCase()
              )
            }),
          )

          if (
            !quoteToken.priceUSD ||
            !payoutTokenPriceUSD ||
            !marketPrice ||
            !bond.scale
          )
            return []

          const { discount, discountedPrice, quoteTokensPerPayoutToken } =
            getBondDiscount({
              marketScale: bond.scale,
              marketPrice: marketPrice,
              payoutToken: {
                priceUSD: payoutTokenPriceUSD,
                decimals: Number(bond.payoutToken.decimals),
              },
              quoteToken: {
                priceUSD: quoteToken.priceUSD,
                decimals: Number(bond.quoteToken.decimals),
              },
            })

          return {
            id: marketId,
            chainId,

            marketId: Number(bond.marketId),
            auctionType: bond.type,

            tellerAddress: bond.teller,
            auctioneerAddress: bond.auctioneer,

            start: Number(bond.start),
            end: Number(bond.conclusion),

            marketScale: String(bond.scale),
            discount,

            price: marketPrice ? String(marketPrice) : null,
            minPrice: bond.minPrice ? String(bond.minPrice) : null,

            capacity:
              Number(bond.capacity) / 10 ** Number(bond.payoutToken.decimals),
            capacityInQuote: bond.capacityInQuote,

            vesting: Number(bond.vesting),
            vestingType: bond.vestingType,

            issuerAddress: bond.owner,
            issuer,

            quoteToken,

            payoutToken: {
              ...bond.payoutToken,
              id: getIdFromChainIdAddress(chainId, bond.payoutToken.address),
              decimals: Number(bond.payoutToken.decimals),
              chainId,
              priceUSD: payoutTokenPriceUSD,
              discountedPriceUSD: discountedPrice,
            },

            quoteTokensPerPayoutToken,

            totalBondedAmount: bond.totalBondedAmount,
            totalPayoutAmount: bond.totalPayoutAmount,
          }
        }),
      )

      const processedAwaited = (await processed).flatMap((bond) => {
        if (isPromiseFulfilled(bond)) return bond.value
        console.error(bond.reason)
        return []
      })

      return processedAwaited.filter((bond) => {
        if (typeof args.onlyDiscounted !== 'undefined') {
          return args.onlyDiscounted ? bond.discount > 0 : true
        }

        return true
      })
    }),
  )

  await client.$disconnect()

  return bonds.filter(isPromiseFulfilled).flatMap((bond) => bond.value)
}
