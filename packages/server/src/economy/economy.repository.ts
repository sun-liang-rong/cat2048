import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateDailyReward,
  calculateRunReward,
  CATALOG_VERSION,
  COLLECTION_REWARDS,
  CURRENT_MIGRATION_VERSION,
  DEFAULT_EQUIPPED,
  DEFAULT_ITEM_IDS,
  findCosmetic,
  ITEM_DAILY_AD_MAX,
  ITEM_HOLDING_MAX,
  MAX_COLLECTION_LEVEL,
  MAX_MIGRATABLE_COINS,
  DAILY_TASK_REWARDS,
} from './economy.catalog';
import type {
  EconomyItemKind,
  EconomyMutationResult,
  EconomySnapshot,
} from './economy.types';
import type { EquippedEconomyDto, MigrateEconomyDto } from './dto/economy.dto';

type DbClient = PrismaService | Prisma.TransactionClient;

const ITEM_FIELDS: Record<EconomyItemKind, 'undoItems' | 'spawnItems' | 'shuffleItems' | 'eraseItems'> = {
  undo: 'undoItems',
  spawn: 'spawnItems',
  shuffle: 'shuffleItems',
  erase: 'eraseItems',
};

const AD_FIELDS: Record<EconomyItemKind, 'dailyAdUndo' | 'dailyAdSpawn' | 'dailyAdShuffle' | 'dailyAdErase'> = {
  undo: 'dailyAdUndo',
  spawn: 'dailyAdSpawn',
  shuffle: 'dailyAdShuffle',
  erase: 'dailyAdErase',
};

function today(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.ECONOMY_TIME_ZONE || 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isYesterday(previous: string | null, current: string): boolean {
  if (!previous) return false;
  const previousTime = Date.parse(`${previous}T00:00:00Z`);
  const currentTime = Date.parse(`${current}T00:00:00Z`);
  return Number.isFinite(previousTime) && currentTime - previousTime === 86_400_000;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class EconomyRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async bootstrap(playerId: string): Promise<EconomySnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureAccount(tx, playerId);
      return this.snapshot(tx, playerId);
    });
  }

  public async migrate(playerId: string, migrationId: string, input: MigrateEconomyDto): Promise<EconomySnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureAccount(tx, playerId);
      const existingMigration = await tx.economyMigration.findUnique({
        where: { playerId_migrationVersion: { playerId, migrationVersion: input.migrationVersion } },
      });
      if (existingMigration) return this.snapshot(tx, playerId);

      const economy = await tx.playerEconomy.findUniqueOrThrow({ where: { playerId } });
      // Migration is a one-time import. If any server-side mutation already
      // happened, importing client-owned items or levels would allow a free
      // replay of local state, so finalize the migration without importing it.
      if (economy.migrationVersion !== 0) return this.snapshot(tx, playerId);
      if (economy.version !== 0) {
        await tx.playerEconomy.update({
          where: { playerId },
          data: { migrationVersion: CURRENT_MIGRATION_VERSION, version: { increment: 1 } },
        });
        await tx.economyMigration.create({
          data: {
            playerId,
            migrationVersion: CURRENT_MIGRATION_VERSION,
            migrationId,
            importedCoins: 0,
            importedItemCount: 0,
            importedCollectionCount: 0,
          },
        });
        return this.snapshot(tx, playerId);
      }
      const fresh = true;
      const validOwned = Array.from(new Set(input.ownedItemIds.filter((id) => Boolean(findCosmetic(id)))));
      const validLevels = Array.from(new Set(input.unlockedCatLevels.filter(
        (level) => level >= 1 && level <= MAX_COLLECTION_LEVEL,
      )));

      await tx.playerOwnedItem.createMany({
        data: [...DEFAULT_ITEM_IDS, ...validOwned].map((itemId) => ({ playerId, itemId })),
        skipDuplicates: true,
      });
      await tx.playerCollectionUnlock.createMany({
        data: [1, ...validLevels].map((level) => ({ playerId, level, source: 'migration' })),
        skipDuplicates: true,
      });
      const importedCollectionCount = new Set([1, ...validLevels]).size;
      await tx.collectionRewardClaim.createMany({
        data: COLLECTION_REWARDS.filter((reward) => reward.count <= importedCollectionCount)
          .map((reward) => ({ playerId, threshold: reward.count, awardedCoins: 0 })),
        skipDuplicates: true,
      });

      const ownedAfter = await tx.playerOwnedItem.findMany({ where: { playerId }, select: { itemId: true } });
      const ownedIds = new Set(ownedAfter.map((item) => item.itemId));
      const equipped = this.validEquipped(input.equipped, ownedIds);
      await tx.playerEquipped.update({ where: { playerId }, data: equipped });

      const importedCoins = fresh ? Math.min(input.coins, MAX_MIGRATABLE_COINS) : economy.coins;
      const importedItems = fresh ? this.clampItems(input.items) : {};
      const nextCoins = fresh ? Math.max(economy.coins, importedCoins) : economy.coins;
      const coinDelta = nextCoins - economy.coins;
      await tx.playerEconomy.update({
        where: { playerId },
        data: {
          ...(fresh ? {
            coins: nextCoins,
            ...importedItems,
            lastDailyClaimDate: input.lastDailyClaimDate ?? null,
            dailyStreak: input.dailyStreak,
          } : {}),
          migrationVersion: input.migrationVersion,
          version: { increment: 1 },
        },
      });
      if (coinDelta > 0) {
        await tx.economyLedger.create({
          data: {
            playerId,
            operationType: 'migration',
            deltaCoins: coinDelta,
            referenceId: migrationId,
          },
        });
      }
      await tx.economyMigration.create({
        data: {
          playerId,
          migrationVersion: input.migrationVersion,
          migrationId,
          importedCoins: coinDelta,
          importedItemCount: validOwned.length,
          importedCollectionCount,
        },
      });
      return this.snapshot(tx, playerId);
    });
  }

  public async claimDaily(playerId: string, idempotencyKey: string): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'daily-claim', {}, async (tx) => {
      const account = await tx.playerEconomy.findUniqueOrThrow({ where: { playerId } });
      const currentDate = today();
      if (account.lastDailyClaimDate === currentDate) {
        return { ok: false, awardedCoins: 0, reason: 'already-claimed' };
      }
      const streak = isYesterday(account.lastDailyClaimDate, currentDate) ? account.dailyStreak + 1 : 1;
      const awardedCoins = calculateDailyReward(streak - 1);
      const claimed = await tx.playerEconomy.updateMany({
        where: {
          playerId,
          OR: [{ lastDailyClaimDate: null }, { lastDailyClaimDate: { not: currentDate } }],
        },
        data: {
          coins: { increment: awardedCoins },
          lastDailyClaimDate: currentDate,
          dailyStreak: streak,
          dailyLoginClaimed: true,
          undoItems: Math.min(ITEM_HOLDING_MAX.undo, account.undoItems + 2),
          eraseItems: Math.min(ITEM_HOLDING_MAX.erase, account.eraseItems + 1),
          version: { increment: 1 },
        },
      });
      if (claimed.count === 0) return { ok: false, awardedCoins: 0, reason: 'already-claimed' };
      await tx.economyLedger.create({
        data: { playerId, operationType: 'daily-claim', deltaCoins: awardedCoins, referenceId: currentDate },
      });
      return { ok: true, awardedCoins };
    });
  }

  public async settleRun(
    playerId: string,
    idempotencyKey: string,
    input: { runId: string; score: number; highestLevel: number; discoveredLevels?: number[] },
  ): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'run-reward', input, async (tx) => {
      const duplicate = await tx.runReward.findUnique({ where: { playerId_runId: { playerId, runId: input.runId } } });
      if (duplicate) return { ok: false, awardedCoins: 0, reason: 'already-settled' };
      const awardedCoins = calculateRunReward(input.score, input.highestLevel);
      const safeHighestLevel = Math.max(1, Math.min(MAX_COLLECTION_LEVEL, Math.floor(input.highestLevel)));
      const discovered = Array.from(new Set((input.discoveredLevels ?? []).filter(
        (level) => level >= 1 && level <= safeHighestLevel,
      )));
      const existing = await tx.playerCollectionUnlock.findMany({ where: { playerId }, select: { level: true } });
      const previousCount = existing.length;
      await tx.playerCollectionUnlock.createMany({
        data: discovered.map((level) => ({ playerId, level, source: 'run' })),
        skipDuplicates: true,
      });
      const nextCount = await tx.playerCollectionUnlock.count({ where: { playerId } });
      let collectionCoins = 0;
      for (const reward of COLLECTION_REWARDS) {
        if (previousCount < reward.count && nextCount >= reward.count) {
          const claim = await tx.collectionRewardClaim.createMany({
            data: [{ playerId, threshold: reward.count, awardedCoins: reward.coins }],
            skipDuplicates: true,
          });
          if (claim.count > 0) collectionCoins += reward.coins;
        }
      }
      const total = awardedCoins + collectionCoins;
      await tx.runReward.create({
        data: { playerId, runId: input.runId, score: input.score, highestLevel: input.highestLevel, awardedCoins: total },
      });
      await tx.playerEconomy.update({ where: { playerId }, data: { coins: { increment: total }, version: { increment: 1 } } });
      await tx.economyLedger.create({
        data: { playerId, operationType: 'run-reward', deltaCoins: total, referenceId: input.runId },
      });
      return { ok: true, awardedCoins: total };
    });
  }

  public async purchase(playerId: string, idempotencyKey: string, itemId: string): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'purchase', { itemId }, async (tx) => {
      const item = findCosmetic(itemId);
      if (!item) return { ok: false, awardedCoins: 0, reason: 'invalid-item' };
      const owned = await tx.playerOwnedItem.findUnique({ where: { playerId_itemId: { playerId, itemId } } });
      if (owned) return { ok: false, awardedCoins: 0, reason: 'already-owned' };
      const account = await tx.playerEconomy.findUniqueOrThrow({ where: { playerId } });
      if (account.coins < item.price) return { ok: false, awardedCoins: 0, reason: 'insufficient-coins' };
      const charged = await tx.playerEconomy.updateMany({
        where: { playerId, coins: { gte: item.price } },
        data: { coins: { decrement: item.price }, version: { increment: 1 } },
      });
      if (charged.count === 0) return { ok: false, awardedCoins: 0, reason: 'insufficient-coins' };
      await tx.playerOwnedItem.create({ data: { playerId, itemId } });
      await tx.economyLedger.create({ data: { playerId, operationType: 'purchase', deltaCoins: -item.price, referenceId: itemId } });
      return { ok: true, awardedCoins: 0 };
    });
  }

  public async equip(playerId: string, idempotencyKey: string, itemId: string): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'equip', { itemId }, async (tx) => {
      const item = findCosmetic(itemId);
      const owned = await tx.playerOwnedItem.findMany({ where: { playerId }, select: { itemId: true } });
      const ownedIds = new Set(owned.map((value) => value.itemId));
      if (!item || !ownedIds.has(item.id)) {
        return { ok: false, awardedCoins: 0, reason: 'invalid-item' };
      }
      const data = item.category === 'cat-skin' ? { catSkinId: item.id } : item.category === 'board'
        ? { boardId: item.id } : { effectId: item.id };
      await tx.playerEquipped.update({ where: { playerId }, data });
      return { ok: true, awardedCoins: 0 };
    });
  }

  public async consumeItem(playerId: string, idempotencyKey: string, kind: EconomyItemKind, amount: number): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'consume-item', { kind, amount }, async (tx) => {
      const field = ITEM_FIELDS[kind];
      if (!field) return { ok: false, awardedCoins: 0, reason: 'invalid-item' };
      const account = await tx.playerEconomy.findUniqueOrThrow({ where: { playerId } });
      if (account[field] < amount) return { ok: false, awardedCoins: 0, reason: 'insufficient-items' };
      await tx.playerEconomy.update({ where: { playerId }, data: { [field]: { decrement: amount }, version: { increment: 1 } } });
      return { ok: true, awardedCoins: 0 };
    });
  }

  public async adReward(playerId: string, idempotencyKey: string, kind: EconomyItemKind): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'ad-reward', { kind }, async (tx) => {
      const field = ITEM_FIELDS[kind];
      const adField = AD_FIELDS[kind];
      if (!field || !adField) return { ok: false, awardedCoins: 0, reason: 'invalid-item' };
      const account = await tx.playerEconomy.findUniqueOrThrow({ where: { playerId } });
      const currentDate = today();
      const adCount = account.dailyCounterDate === currentDate ? account[adField] : 0;
      if (account[field] >= ITEM_HOLDING_MAX[kind]) return { ok: false, awardedCoins: 0, reason: 'holding-limit' };
      if (adCount >= ITEM_DAILY_AD_MAX[kind]) return { ok: false, awardedCoins: 0, reason: 'daily-limit' };
      await tx.playerEconomy.update({
        where: { playerId },
        data: {
          ...(account.dailyCounterDate === currentDate ? {} : {
            dailyAdUndo: 0,
            dailyAdSpawn: 0,
            dailyAdShuffle: 0,
            dailyAdErase: 0,
          }),
          [field]: { increment: 1 },
          [adField]: adCount + 1,
          dailyCounterDate: currentDate,
          version: { increment: 1 },
        },
      });
      return { ok: true, awardedCoins: 0 };
    });
  }

  public async claimTask(playerId: string, idempotencyKey: string, taskId: string): Promise<EconomyMutationResult> {
    return this.mutate(playerId, idempotencyKey, 'task-reward', { taskId }, async (tx) => {
      const awardedCoins = DAILY_TASK_REWARDS[taskId];
      if (!awardedCoins) return { ok: false, awardedCoins: 0, reason: 'invalid-task' };
      const currentDate = today();
      const existing = await tx.dailyTaskClaim.findUnique({
        where: { playerId_date_taskId: { playerId, date: currentDate, taskId } },
      });
      if (existing) return { ok: false, awardedCoins: 0, reason: 'already-claimed' };
      await tx.dailyTaskClaim.create({ data: { playerId, date: currentDate, taskId, awardedCoins } });
      await tx.playerEconomy.update({ where: { playerId }, data: { coins: { increment: awardedCoins }, version: { increment: 1 } } });
      await tx.economyLedger.create({ data: { playerId, operationType: 'task-reward', deltaCoins: awardedCoins, referenceId: taskId } });
      return { ok: true, awardedCoins };
    });
  }

  private async mutate(
    playerId: string,
    idempotencyKey: string,
    operationType: string,
    payload: unknown,
    action: (tx: Prisma.TransactionClient) => Promise<{ ok: boolean; awardedCoins: number; reason?: string }>,
  ): Promise<EconomyMutationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureAccount(tx, playerId);
        const existing = await tx.economyOperation.findUnique({ where: { playerId_idempotencyKey: { playerId, idempotencyKey } } });
        if (existing) {
          const stored = existing.resultSnapshot;
          return (typeof stored === 'string' ? JSON.parse(stored) : stored) as EconomyMutationResult;
        }
        const result = await action(tx);
        const snapshot = await this.snapshot(tx, playerId);
        const response: EconomyMutationResult = { ...result, snapshot };
        await tx.economyOperation.create({
          data: { playerId, idempotencyKey, operationType, requestPayload: jsonValue(payload), resultSnapshot: jsonValue(response) },
        });
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
        const existing = await this.prisma.economyOperation.findUnique({ where: { playerId_idempotencyKey: { playerId, idempotencyKey } } });
        if (existing) {
          const stored = existing.resultSnapshot;
          return (typeof stored === 'string' ? JSON.parse(stored) : stored) as EconomyMutationResult;
        }
      }
      throw error;
    }
  }

  private async ensureAccount(client: DbClient, playerId: string): Promise<void> {
    await client.playerEconomy.upsert({ where: { playerId }, create: { playerId }, update: {} });
    await client.playerEquipped.upsert({ where: { playerId }, create: { playerId }, update: {} });
    await client.playerOwnedItem.createMany({
      data: DEFAULT_ITEM_IDS.map((itemId) => ({ playerId, itemId })),
      skipDuplicates: true,
    });
    await client.playerCollectionUnlock.createMany({
      data: [{ playerId, level: 1, source: 'default' }],
      skipDuplicates: true,
    });
  }

  private async snapshot(client: DbClient, playerId: string): Promise<EconomySnapshot> {
    const account = await client.playerEconomy.findUniqueOrThrow({ where: { playerId } });
    const owned = await client.playerOwnedItem.findMany({ where: { playerId }, orderBy: { purchasedAt: 'asc' }, select: { itemId: true } });
    const levels = await client.playerCollectionUnlock.findMany({ where: { playerId }, orderBy: { level: 'asc' }, select: { level: true } });
    const equipped = await client.playerEquipped.findUniqueOrThrow({ where: { playerId } });
    const currentDate = today();
    const streak = isYesterday(account.lastDailyClaimDate, currentDate) ? account.dailyStreak : 0;
    return {
      version: account.version,
      migrationVersion: account.migrationVersion,
      catalogVersion: CATALOG_VERSION,
      coins: account.coins,
      unlockedCatLevels: levels.map((item) => item.level),
      ownedItemIds: owned.map((item) => item.itemId),
      equipped: { catSkin: equipped.catSkinId, board: equipped.boardId, effect: equipped.effectId },
      items: { undo: account.undoItems, spawn: account.spawnItems, shuffle: account.shuffleItems, erase: account.eraseItems },
      daily: {
        canClaim: account.lastDailyClaimDate !== currentDate,
        reward: calculateDailyReward(streak),
        streak: account.dailyStreak,
        lastClaimDate: account.lastDailyClaimDate,
        adCounts: {
          undo: account.dailyCounterDate === currentDate ? account.dailyAdUndo : 0,
          spawn: account.dailyCounterDate === currentDate ? account.dailyAdSpawn : 0,
          shuffle: account.dailyCounterDate === currentDate ? account.dailyAdShuffle : 0,
          erase: account.dailyCounterDate === currentDate ? account.dailyAdErase : 0,
        },
        counterDate: account.dailyCounterDate,
        loginClaimed: account.dailyLoginClaimed,
        shareUndo: account.dailyShareUndo,
      },
    };
  }

  private clampItems(items: { undo: number; spawn: number; shuffle: number; erase: number }): Record<string, number> {
    return {
      undoItems: Math.min(ITEM_HOLDING_MAX.undo, items.undo),
      spawnItems: Math.min(ITEM_HOLDING_MAX.spawn, items.spawn),
      shuffleItems: Math.min(ITEM_HOLDING_MAX.shuffle, items.shuffle),
      eraseItems: Math.min(ITEM_HOLDING_MAX.erase, items.erase),
    };
  }

  private validEquipped(input: EquippedEconomyDto, owned: Set<string>): Record<string, string> {
    const catSkin = findCosmetic(input.catSkin);
    const board = findCosmetic(input.board);
    const effect = findCosmetic(input.effect);
    return {
      catSkinId: catSkin?.category === 'cat-skin' && owned.has(catSkin.id) ? catSkin.id : DEFAULT_EQUIPPED.catSkin,
      boardId: board?.category === 'board' && owned.has(board.id) ? board.id : DEFAULT_EQUIPPED.board,
      effectId: effect?.category === 'effect' && owned.has(effect.id) ? effect.id : DEFAULT_EQUIPPED.effect,
    };
  }
}
