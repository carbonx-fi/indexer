// @ts-nocheck
// TypeScript checking disabled - Ponder generates types at runtime
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

// Zone names mapping
const ZONE_NAMES = ["Ocean", "Forest", "Energy", "Tech", "Community", "Wildlife"];

// Helper to get or create zone stats
async function getOrCreateZoneStats(context: any, zoneId: number) {
  let zone = await context.db.find(schema.zoneStats, { id: zoneId });
  if (!zone) {
    zone = await context.db.insert(schema.zoneStats).values({
      id: zoneId,
      name: ZONE_NAMES[zoneId] || `Zone ${zoneId}`,
      totalRetired: 0n,
      contributorCount: 0,
      lastRetirementAt: 0n,
    });
  }
  return zone;
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
  const { tokenId, user: userAddr, amount, projectId, vintage, category, retirementNote } = event.args;

  // Create retirement record
  const retirementId = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(schema.retirement).values({
    id: retirementId,
    user: userAddr,
    tokenId,
    amount,
    reason: retirementNote,
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

  // Update project total retired
  const project = await context.db.find(schema.project, { id: projectId });
  if (project) {
    await context.db.update(schema.project, { id: projectId }).set({
      totalRetired: project.totalRetired + amount,
    });
  }

  // Update protocol stats
  const stats = await getOrCreateProtocolStats(context);
  await context.db.update(schema.protocolStats, { id: 1 }).set({
    totalCarbonRetired: stats.totalCarbonRetired + amount,
    lastUpdated: event.block.timestamp,
  });

  // Update zone stats based on carbon category
  // Category maps to zone: 0=FORESTRY→FOREST, 1=OCEAN, 2=ENERGY, 3=TECH, 4=COMMUNITY, 5=WILDLIFE
  const zoneId = Number(category);
  if (zoneId >= 0 && zoneId <= 5) {
    const zone = await getOrCreateZoneStats(context, zoneId);

    // Check if this user already contributed to this zone
    const contributorId = `${zoneId}-${userAddr}`;
    let contributor = await context.db.find(schema.zoneContributor, { id: contributorId });

    if (!contributor) {
      // New contributor to this zone
      await context.db.insert(schema.zoneContributor).values({
        id: contributorId,
        zoneId,
        user: userAddr,
        totalRetired: amount,
        retirementCount: 1,
        lastRetirementAt: event.block.timestamp,
      });

      // Increment zone contributor count
      await context.db.update(schema.zoneStats, { id: zoneId }).set({
        totalRetired: zone.totalRetired + amount,
        contributorCount: zone.contributorCount + 1,
        lastRetirementAt: event.block.timestamp,
      });
    } else {
      // Existing contributor
      await context.db.update(schema.zoneContributor, { id: contributorId }).set({
        totalRetired: contributor.totalRetired + amount,
        retirementCount: contributor.retirementCount + 1,
        lastRetirementAt: event.block.timestamp,
      });

      await context.db.update(schema.zoneStats, { id: zoneId }).set({
        totalRetired: zone.totalRetired + amount,
        lastRetirementAt: event.block.timestamp,
      });
    }
  }
});

// ============ Guardian NFT Events ============

ponder.on("GuardianNFT:GuardianMinted", async ({ event, context }) => {
  const { tokenId, owner, tier } = event.args;

  // Note: GuardianMinted doesn't include path in current contract event
  // We'll default to 0 and update when we see RetirementRecorded
  await context.db.insert(schema.guardian).values({
    id: tokenId,
    owner,
    tier: Number(tier),
    path: 0, // Will be set properly when guardian is created with path
    totalRetired: 0n,
    isTransferable: false,
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
  const { tokenId, oldTier, newTier, totalRetired } = event.args;

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
    previousTier: Number(oldTier),
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

ponder.on("GuardianNFT:RetirementRecorded", async ({ event, context }) => {
  const { tokenId, amount, newTotal } = event.args;

  // Update guardian total
  const guardian = await context.db.find(schema.guardian, { id: tokenId });
  if (guardian) {
    await context.db.update(schema.guardian, { id: tokenId }).set({
      totalRetired: newTotal,
      lastUpdated: event.block.timestamp,
    });

    // Update zone stats based on guardian's path
    const zoneId = guardian.path;
    const zone = await getOrCreateZoneStats(context, zoneId);

    // Check if this user already contributed to this zone
    const contributorId = `${zoneId}-${guardian.owner}`;
    let contributor = await context.db.find(schema.zoneContributor, { id: contributorId });

    if (!contributor) {
      // New contributor to this zone
      await context.db.insert(schema.zoneContributor).values({
        id: contributorId,
        zoneId,
        user: guardian.owner,
        totalRetired: amount,
        retirementCount: 1,
        lastRetirementAt: event.block.timestamp,
      });

      // Increment zone contributor count
      await context.db.update(schema.zoneStats, { id: zoneId }).set({
        totalRetired: zone.totalRetired + amount,
        contributorCount: zone.contributorCount + 1,
        lastRetirementAt: event.block.timestamp,
      });
    } else {
      // Existing contributor
      await context.db.update(schema.zoneContributor, { id: contributorId }).set({
        totalRetired: contributor.totalRetired + amount,
        retirementCount: contributor.retirementCount + 1,
        lastRetirementAt: event.block.timestamp,
      });

      await context.db.update(schema.zoneStats, { id: zoneId }).set({
        totalRetired: zone.totalRetired + amount,
        lastRetirementAt: event.block.timestamp,
      });
    }
  }
});

ponder.on("GuardianNFT:TransferUnlocked", async ({ event, context }) => {
  const { tokenId, feePaid } = event.args;

  await context.db.update(schema.guardian, { id: tokenId }).set({
    isTransferable: true,
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
    status: Number(task.status),
    createdAt: event.block.timestamp,
  });

  // Ensure user exists
  await getOrCreateUser(context, task.user, event.block.timestamp);
});

ponder.on("KYCServiceManager:TaskResponded", async ({ event, context }) => {
  const { taskId, operator, achievedLevel } = event.args;

  // Get the task to find the user
  const kycTask = await context.db.find(schema.kycTask, { id: Number(taskId) });

  // Update task
  await context.db.update(schema.kycTask, { id: Number(taskId) }).set({
    status: 1, // COMPLETED
    completedAt: event.block.timestamp,
    respondedBy: operator,
  });

  if (kycTask) {
    // Update or create KYC result
    const validityPeriod = 365n * 24n * 60n * 60n; // 1 year
    const expiresAt = event.block.timestamp + validityPeriod;

    let kycResult = await context.db.find(schema.kycResult, { id: kycTask.user });
    if (!kycResult) {
      await context.db.insert(schema.kycResult).values({
        id: kycTask.user,
        level: Number(achievedLevel),
        verifiedAt: event.block.timestamp,
        expiresAt,
        isValid: true,
      });
    } else {
      await context.db.update(schema.kycResult, { id: kycTask.user }).set({
        level: Number(achievedLevel),
        verifiedAt: event.block.timestamp,
        expiresAt,
        isValid: true,
      });
    }

    // Update user KYC level
    await context.db.update(schema.user, { id: kycTask.user }).set({
      kycLevel: Number(achievedLevel),
      lastActiveAt: event.block.timestamp,
    });
  }
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
