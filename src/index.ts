import { ponder } from "ponder:registry";
import * as schema from "../ponder.schema";

// Helper to get or create user
async function getOrCreateUser(
  context: any,
  address: `0x${string}`,
  timestamp: bigint
) {
  let user = await context.db.find(schema.user, { id: address });
  if (!user) {
    user = await context.db.insert(schema.user).values({
      id: address,
      totalRetired: 0n,
      totalTraded: 0n,
      totalLiquidityProvided: 0n,
      kycLevel: 0,
      firstSeenAt: timestamp,
      lastActiveAt: timestamp,
    });
  }
  return user;
}

// Helper to get or create protocol stats
async function getOrCreateProtocolStats(context: any) {
  let stats = await context.db.find(schema.protocolStats, { id: 1 });
  if (!stats) {
    stats = await context.db.insert(schema.protocolStats).values({
      id: 1,
      totalProjects: 0,
      totalCarbonMinted: 0n,
      totalCarbonRetired: 0n,
      totalGuardians: 0,
      totalPools: 0,
      totalTrades: 0,
      totalSwaps: 0,
      totalVolume: 0n,
      lastUpdated: 0n,
    });
  }
  return stats;
}

// Helper to get date string
function getDateString(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toISOString().split("T")[0];
}

// ============ Carbon Credit Token Events ============

ponder.on("CarbonCreditToken:ProjectRegistered", async ({ event, context }) => {
  const { projectId, name, category, vintage, registeredBy } = event.args;

  await context.db.insert(schema.project).values({
    id: projectId,
    name,
    methodology: "",
    verifier: "",
    location: "",
    category: Number(category),
    vintage: Number(vintage),
    qualityScore: 0,
    verified: false,
    active: true,
    totalMinted: 0n,
    totalRetired: 0n,
    registeredBy,
    registeredAt: event.block.timestamp,
  });

  // Update protocol stats
  const stats = await getOrCreateProtocolStats(context);
  await context.db.update(schema.protocolStats, { id: 1 }).set({
    totalProjects: stats.totalProjects + 1,
    lastUpdated: event.block.timestamp,
  });

  // Ensure user exists
  await getOrCreateUser(context, registeredBy, event.block.timestamp);
});

ponder.on("CarbonCreditToken:ProjectVerified", async ({ event, context }) => {
  const { projectId, qualityScore } = event.args;

  await context.db.update(schema.project, { id: projectId }).set({
    qualityScore: Number(qualityScore),
    verified: true,
    verifiedAt: event.block.timestamp,
  });
});

ponder.on("CarbonCreditToken:CarbonMinted", async ({ event, context }) => {
  const { tokenId, to, amount, projectId, vintage, category } = event.args;

  // Update or create carbon token
  let token = await context.db.find(schema.carbonToken, { id: tokenId });
  if (!token) {
    await context.db.insert(schema.carbonToken).values({
      id: tokenId,
      projectId,
      vintage: Number(vintage),
      category: Number(category),
      totalSupply: amount,
    });
  } else {
    await context.db.update(schema.carbonToken, { id: tokenId }).set({
      totalSupply: token.totalSupply + amount,
    });
  }

  // Update carbon balance
  const balanceId = `${to}-${tokenId}`;
  let balance = await context.db.find(schema.carbonBalance, { id: balanceId });
  if (!balance) {
    await context.db.insert(schema.carbonBalance).values({
      id: balanceId,
      owner: to,
      tokenId,
      balance: amount,
    });
  } else {
    await context.db.update(schema.carbonBalance, { id: balanceId }).set({
      balance: balance.balance + amount,
    });
  }

  // Update project total minted
  const project = await context.db.find(schema.project, { id: projectId });
  if (project) {
    await context.db.update(schema.project, { id: projectId }).set({
      totalMinted: project.totalMinted + amount,
    });
  }

  // Update protocol stats
  const stats = await getOrCreateProtocolStats(context);
  await context.db.update(schema.protocolStats, { id: 1 }).set({
    totalCarbonMinted: stats.totalCarbonMinted + amount,
    lastUpdated: event.block.timestamp,
  });

  // Ensure user exists
  await getOrCreateUser(context, to, event.block.timestamp);
});

ponder.on("CarbonCreditToken:CarbonRetired", async ({ event, context }) => {
  const { tokenId, user: userAddr, amount, reason } = event.args;

  // Create retirement record
  const retirementId = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(schema.retirement).values({
    id: retirementId,
    user: userAddr,
    tokenId,
    amount,
    reason,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });

  // Update carbon balance
  const balanceId = `${userAddr}-${tokenId}`;
  const balance = await context.db.find(schema.carbonBalance, { id: balanceId });
  if (balance) {
    await context.db.update(schema.carbonBalance, { id: balanceId }).set({
      balance: balance.balance - amount,
    });
  }

  // Update user stats
  const user = await getOrCreateUser(context, userAddr, event.block.timestamp);
  await context.db.update(schema.user, { id: userAddr }).set({
    totalRetired: user.totalRetired + amount,
    lastActiveAt: event.block.timestamp,
  });

  // Update protocol stats
  const stats = await getOrCreateProtocolStats(context);
  await context.db.update(schema.protocolStats, { id: 1 }).set({
    totalCarbonRetired: stats.totalCarbonRetired + amount,
    lastUpdated: event.block.timestamp,
  });
});

// ============ Guardian NFT Events ============

ponder.on("GuardianNFT:GuardianMinted", async ({ event, context }) => {
  const { tokenId, owner, initialRetired } = event.args;

  // Calculate initial tier based on retired amount
  let tier = 0;
  if (initialRetired >= 500n * 10n ** 18n) tier = 4; // LEGENDARY
  else if (initialRetired >= 200n * 10n ** 18n) tier = 3; // EPIC
  else if (initialRetired >= 50n * 10n ** 18n) tier = 2; // RARE
  else if (initialRetired >= 10n * 10n ** 18n) tier = 1; // UNCOMMON

  await context.db.insert(schema.guardian).values({
    id: tokenId,
    owner,
    tier,
    totalRetired: initialRetired,
    mintedAt: event.block.timestamp,
    lastUpdated: event.block.timestamp,
  });

  // Update user
  const user = await getOrCreateUser(context, owner, event.block.timestamp);
  await context.db.update(schema.user, { id: owner }).set({
    guardianId: tokenId,
    lastActiveAt: event.block.timestamp,
  });

  // Update protocol stats
  const stats = await getOrCreateProtocolStats(context);
  await context.db.update(schema.protocolStats, { id: 1 }).set({
    totalGuardians: stats.totalGuardians + 1,
    lastUpdated: event.block.timestamp,
  });
});

ponder.on("GuardianNFT:GuardianUpgraded", async ({ event, context }) => {
  const { tokenId, previousTier, newTier, totalRetired } = event.args;

  // Update guardian
  await context.db.update(schema.guardian, { id: tokenId }).set({
    tier: Number(newTier),
    totalRetired,
    lastUpdated: event.block.timestamp,
  });

  // Create tier upgrade record
  const upgradeId = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(schema.tierUpgrade).values({
    id: upgradeId,
    guardianId: tokenId,
    previousTier: Number(previousTier),
    newTier: Number(newTier),
    totalRetired,
    timestamp: event.block.timestamp,
  });
});

ponder.on("GuardianNFT:NicknameUpdated", async ({ event, context }) => {
  const { tokenId, nickname } = event.args;

  await context.db.update(schema.guardian, { id: tokenId }).set({
    nickname,
    lastUpdated: event.block.timestamp,
  });
});

// ============ KYC Service Manager Events ============

ponder.on("KYCServiceManager:NewTaskCreated", async ({ event, context }) => {
  const { taskId, task } = event.args;

  await context.db.insert(schema.kycTask).values({
    id: Number(taskId),
    user: task.user,
    requiredLevel: Number(task.requiredLevel),
    status: 0, // PENDING
    createdAt: event.block.timestamp,
  });

  // Ensure user exists
  await getOrCreateUser(context, task.user, event.block.timestamp);
});

ponder.on("KYCServiceManager:TaskResponded", async ({ event, context }) => {
  const { taskId, operator, achievedLevel, user } = event.args;

  // Update task
  await context.db.update(schema.kycTask, { id: Number(taskId) }).set({
    status: 1, // COMPLETED
    completedAt: event.block.timestamp,
    respondedBy: operator,
  });

  // Update or create KYC result
  const validityPeriod = 365n * 24n * 60n * 60n; // 1 year
  const expiresAt = event.block.timestamp + validityPeriod;

  let kycResult = await context.db.find(schema.kycResult, { id: user });
  if (!kycResult) {
    await context.db.insert(schema.kycResult).values({
      id: user,
      level: Number(achievedLevel),
      verifiedAt: event.block.timestamp,
      expiresAt,
      isValid: true,
    });
  } else {
    await context.db.update(schema.kycResult, { id: user }).set({
      level: Number(achievedLevel),
      verifiedAt: event.block.timestamp,
      expiresAt,
      isValid: true,
    });
  }

  // Update user KYC level
  await context.db.update(schema.user, { id: user }).set({
    kycLevel: Number(achievedLevel),
    lastActiveAt: event.block.timestamp,
  });
});

ponder.on("KYCServiceManager:OperatorRegistered", async ({ event, context }) => {
  const { operator } = event.args;

  await context.db.insert(schema.operator).values({
    id: operator,
    registered: true,
    registeredAt: event.block.timestamp,
  });
});

ponder.on("KYCServiceManager:OperatorDeregistered", async ({ event, context }) => {
  const { operator } = event.args;

  await context.db.update(schema.operator, { id: operator }).set({
    registered: false,
    deregisteredAt: event.block.timestamp,
  });
});

// ============ Pool Factory Events ============

ponder.on("CarbonPoolFactory:PoolCreated", async ({ event, context }) => {
  const { carbonTokenId, pool: poolAddress, tier } = event.args;

  await context.db.insert(schema.pool).values({
    id: poolAddress,
    carbonTokenId,
    tier: Number(tier),
    reserveCarbon: 0n,
    reserveQuote: 0n,
    totalSupply: 0n,
    swapFeeBps: tier === 2 ? 50 : tier === 1 ? 30 : 20,
    spotPrice: 0n,
    totalVolume: 0n,
    createdAt: event.block.timestamp,
    lastUpdated: event.block.timestamp,
  });

  // Update protocol stats
  const stats = await getOrCreateProtocolStats(context);
  await context.db.update(schema.protocolStats, { id: 1 }).set({
    totalPools: stats.totalPools + 1,
    lastUpdated: event.block.timestamp,
  });
});

// ============ AMM Pool Events ============
// Note: CarbonAMMPool events are disabled until factory pattern is properly configured
// Pool events (LiquidityAdded, LiquidityRemoved, Swap) will be tracked via
// CarbonPoolFactory:PoolCreated once dynamic contract indexing is set up
