import { onchainTable, index } from "ponder";

// ============ Carbon Credit Token ============

export const project = onchainTable("project", (t) => ({
  id: t.bigint().primaryKey(),
  name: t.text().notNull(),
  methodology: t.text().notNull(),
  verifier: t.text().notNull(),
  location: t.text().notNull(),
  category: t.integer().notNull(),
  vintage: t.integer().notNull(),
  qualityScore: t.integer().notNull(),
  verified: t.boolean().notNull(),
  active: t.boolean().notNull(),
  totalMinted: t.bigint().notNull(),
  totalRetired: t.bigint().notNull(),
  registeredBy: t.hex().notNull(),
  registeredAt: t.bigint().notNull(),
  verifiedAt: t.bigint(),
}));

export const carbonToken = onchainTable("carbon_token", (t) => ({
  id: t.bigint().primaryKey(), // tokenId
  projectId: t.bigint().notNull(),
  vintage: t.integer().notNull(),
  category: t.integer().notNull(),
  totalSupply: t.bigint().notNull(),
}));

export const carbonBalance = onchainTable(
  "carbon_balance",
  (t) => ({
    id: t.text().primaryKey(), // `${address}-${tokenId}`
    owner: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    balance: t.bigint().notNull(),
  }),
  (table) => ({
    ownerIdx: index().on(table.owner),
    tokenIdx: index().on(table.tokenId),
  })
);

export const retirement = onchainTable(
  "retirement",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    user: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    amount: t.bigint().notNull(),
    reason: t.text().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    tokenIdx: index().on(table.tokenId),
  })
);

// ============ Guardian NFT ============

export const guardian = onchainTable(
  "guardian",
  (t) => ({
    id: t.bigint().primaryKey(), // tokenId
    owner: t.hex().notNull(),
    tier: t.integer().notNull(),
    totalRetired: t.bigint().notNull(),
    nickname: t.text(),
    mintedAt: t.bigint().notNull(),
    lastUpdated: t.bigint().notNull(),
  }),
  (table) => ({
    ownerIdx: index().on(table.owner),
    tierIdx: index().on(table.tier),
  })
);

export const tierUpgrade = onchainTable("tier_upgrade", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  guardianId: t.bigint().notNull(),
  previousTier: t.integer().notNull(),
  newTier: t.integer().notNull(),
  totalRetired: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

// ============ Order Book ============

export const order = onchainTable(
  "order",
  (t) => ({
    id: t.bigint().primaryKey(), // orderId
    user: t.hex().notNull(),
    side: t.integer().notNull(), // 0 = BUY, 1 = SELL
    price: t.bigint().notNull(),
    quantity: t.bigint().notNull(),
    filled: t.bigint().notNull(),
    status: t.integer().notNull(), // 0 = OPEN, 1 = FILLED, 2 = CANCELLED
    orderType: t.integer().notNull(),
    category: t.integer().notNull(),
    projectId: t.bigint(),
    minVintage: t.integer(),
    maxVintage: t.integer(),
    minQualityScore: t.integer(),
    retireOnFill: t.boolean().notNull(),
    createdAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    statusIdx: index().on(table.status),
    sideIdx: index().on(table.side),
  })
);

export const trade = onchainTable(
  "trade",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    buyOrderId: t.bigint().notNull(),
    sellOrderId: t.bigint().notNull(),
    buyer: t.hex().notNull(),
    seller: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    price: t.bigint().notNull(),
    quantity: t.bigint().notNull(),
    buyerFee: t.bigint().notNull(),
    sellerFee: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    buyerIdx: index().on(table.buyer),
    sellerIdx: index().on(table.seller),
  })
);

// ============ KYC Service Manager ============

export const kycTask = onchainTable(
  "kyc_task",
  (t) => ({
    id: t.integer().primaryKey(), // taskId
    user: t.hex().notNull(),
    requiredLevel: t.integer().notNull(),
    status: t.integer().notNull(), // 0 = PENDING, 1 = COMPLETED, 2 = EXPIRED
    createdAt: t.bigint().notNull(),
    completedAt: t.bigint(),
    respondedBy: t.hex(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    statusIdx: index().on(table.status),
  })
);

export const kycResult = onchainTable("kyc_result", (t) => ({
  id: t.hex().primaryKey(), // user address
  level: t.integer().notNull(),
  verifiedAt: t.bigint().notNull(),
  expiresAt: t.bigint().notNull(),
  isValid: t.boolean().notNull(),
}));

export const operator = onchainTable("operator", (t) => ({
  id: t.hex().primaryKey(), // operator address
  registered: t.boolean().notNull(),
  registeredAt: t.bigint().notNull(),
  deregisteredAt: t.bigint(),
}));

// ============ AMM Pools ============

export const pool = onchainTable(
  "pool",
  (t) => ({
    id: t.hex().primaryKey(), // pool address
    carbonTokenId: t.bigint().notNull(),
    tier: t.integer().notNull(),
    reserveCarbon: t.bigint().notNull(),
    reserveQuote: t.bigint().notNull(),
    totalSupply: t.bigint().notNull(),
    swapFeeBps: t.integer().notNull(),
    spotPrice: t.bigint().notNull(),
    totalVolume: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    lastUpdated: t.bigint().notNull(),
  }),
  (table) => ({
    tokenIdx: index().on(table.carbonTokenId),
    tierIdx: index().on(table.tier),
  })
);

export const liquidityPosition = onchainTable(
  "liquidity_position",
  (t) => ({
    id: t.text().primaryKey(), // `${pool}-${provider}`
    pool: t.hex().notNull(),
    provider: t.hex().notNull(),
    lpTokens: t.bigint().notNull(),
    carbonDeposited: t.bigint().notNull(),
    quoteDeposited: t.bigint().notNull(),
    carbonWithdrawn: t.bigint().notNull(),
    quoteWithdrawn: t.bigint().notNull(),
  }),
  (table) => ({
    poolIdx: index().on(table.pool),
    providerIdx: index().on(table.provider),
  })
);

export const liquidityEvent = onchainTable(
  "liquidity_event",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    pool: t.hex().notNull(),
    provider: t.hex().notNull(),
    eventType: t.text().notNull(), // "add" | "remove"
    carbonAmount: t.bigint().notNull(),
    quoteAmount: t.bigint().notNull(),
    lpTokens: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    poolIdx: index().on(table.pool),
    providerIdx: index().on(table.provider),
  })
);

export const swap = onchainTable(
  "swap",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    pool: t.hex().notNull(),
    user: t.hex().notNull(),
    carbonToQuote: t.boolean().notNull(),
    amountIn: t.bigint().notNull(),
    amountOut: t.bigint().notNull(),
    fee: t.bigint().notNull(),
    discountBps: t.integer().notNull(),
    spotPriceBefore: t.bigint().notNull(),
    spotPriceAfter: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    poolIdx: index().on(table.pool),
    userIdx: index().on(table.user),
  })
);

// ============ User Stats ============

export const user = onchainTable("user", (t) => ({
  id: t.hex().primaryKey(), // address
  totalRetired: t.bigint().notNull(),
  totalTraded: t.bigint().notNull(),
  totalLiquidityProvided: t.bigint().notNull(),
  guardianId: t.bigint(),
  kycLevel: t.integer().notNull(),
  firstSeenAt: t.bigint().notNull(),
  lastActiveAt: t.bigint().notNull(),
}));

// ============ Protocol Stats ============

export const protocolStats = onchainTable("protocol_stats", (t) => ({
  id: t.integer().primaryKey(), // always 1
  totalProjects: t.integer().notNull(),
  totalCarbonMinted: t.bigint().notNull(),
  totalCarbonRetired: t.bigint().notNull(),
  totalGuardians: t.integer().notNull(),
  totalPools: t.integer().notNull(),
  totalTrades: t.integer().notNull(),
  totalSwaps: t.integer().notNull(),
  totalVolume: t.bigint().notNull(),
  lastUpdated: t.bigint().notNull(),
}));

// ============ Daily Stats ============

export const dailyStats = onchainTable("daily_stats", (t) => ({
  id: t.text().primaryKey(), // date string YYYY-MM-DD
  date: t.bigint().notNull(),
  carbonMinted: t.bigint().notNull(),
  carbonRetired: t.bigint().notNull(),
  trades: t.integer().notNull(),
  swaps: t.integer().notNull(),
  volume: t.bigint().notNull(),
  newUsers: t.integer().notNull(),
  newGuardians: t.integer().notNull(),
}));
