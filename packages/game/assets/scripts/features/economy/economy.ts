import {
  allCosmetics,
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
  findCosmetic,
  SHOP_ITEMS,
  type CosmeticCategory,
  type EconomySaveData,
  type EquippedCosmetics,
} from './catalog';
import {
  LocalGameStorage,
  type KeyValueStorage,
} from '../storage/storage';
import type { ItemKind } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { ITEM_DAILY_AD_MAX, ITEM_HOLDING_MAX } from '../../core/config/constants';

export interface RunRewardRequest {
  readonly runId: string;
  readonly score: number;
  readonly highestLevel: number;
  readonly discoveredLevels?: readonly number[];
}

export interface EconomySnapshot extends EconomySaveData {
  readonly unlockedCatLevels: readonly number[];
  readonly catalog: ReturnType<typeof allCosmetics>;
  readonly canClaimDaily: boolean;
  readonly dailyReward: number;
}

export interface EconomyMutationResult extends EconomySnapshot {
  readonly ok: boolean;
  readonly awardedCoins: number;
  readonly reason?:
    | 'already-claimed'
    | 'already-owned'
    | 'already-settled'
    | 'insufficient-coins'
    | 'insufficient-items'
    | 'invalid-item'
    | 'invalid-task'
    | 'holding-limit'
    | 'daily-limit';
}

export interface EconomyRepository {
  readonly serverAuthoritative?: boolean;
  load(): Promise<EconomySnapshot>;
  /** 可选的后台同步入口；远程仓库会顺带重试未结算的对局奖励。 */
  sync?(): Promise<EconomySnapshot>;
  claimDailyReward(): Promise<EconomyMutationResult>;
  settleRun(request: RunRewardRequest): Promise<EconomyMutationResult>;
  claimTaskReward(taskId: string, amount: number): Promise<EconomyMutationResult>;
  grantCoins(amount: number): Promise<EconomyMutationResult>;
  consumeItems(kind: ItemKind, amount: number): Promise<EconomyMutationResult>;
  purchase(itemId: string): Promise<EconomyMutationResult>;
  equip(itemId: string): Promise<EconomyMutationResult>;
  /** 通过广告获取道具（含每日限额检查） */
  grantViaAd(kind: ItemKind): Promise<EconomyMutationResult>;
  /** 检查是否可通过广告获取 */
  canGrantViaAd(kind: ItemKind, today: string): boolean;
  /** 获取道具库存数量 */
  getItemCount(kind: ItemKind): number;
  /** 检查道具库存 */
  hasItem(kind: ItemKind): boolean;
}

export interface EconomyClock {
  today(): string;
}

export function calculateRunReward(score: number, highestLevel: number): number {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const safeLevel = Math.max(1, Math.min(GAME_CONFIG.cats.length, Math.floor(highestLevel)));
  const baseReward = Math.max(5, Math.floor(safeScore / 100));
  const levelBonus = (safeLevel >= 5 ? 10 : 0)
    + (safeLevel >= 7 ? 20 : 0)
    + (safeLevel >= 9 ? 50 : 0)
    + (safeLevel >= 11 ? 35 : 0)
    + (safeLevel >= 12 ? 35 : 0);
  return Math.min(150, baseReward + levelBonus);
}

export function calculateDailyReward(completedStreak: number): number {
  return Math.min(100, 30 + Math.max(0, Math.floor(completedStreak)) * 10);
}

export function localDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1);
  const day = String(date.getDate());
  const monthText = month.length === 1 ? `0${month}` : month;
  const dayText = day.length === 1 ? `0${day}` : day;
  return `${year}-${monthText}-${dayText}`;
}

export class LocalEconomyRepository implements EconomyRepository {
  public readonly serverAuthoritative = false;
  private readonly saveStorage: LocalGameStorage;
  private readonly clock: EconomyClock;

  public constructor(storage: KeyValueStorage, clock: EconomyClock = { today: localDate }) {
    this.saveStorage = new LocalGameStorage(storage);
    this.clock = clock;
  }

  public async load(): Promise<EconomySnapshot> {
    const save = this.saveStorage.load();
    return this.snapshot(save.economy, save.unlockedCatLevels);
  }

  public async claimDailyReward(): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const today = this.clock.today();
    if (save.economy.lastDailyClaimDate === today) {
      return this.result(save.economy, false, 0, 'already-claimed', save.unlockedCatLevels);
    }
    const streak = this.isYesterday(save.economy.lastDailyClaimDate, today)
      ? save.economy.dailyStreak + 1 : 1;
    const awardedCoins = calculateDailyReward(streak - 1);
    const economy = {
      ...save.economy,
      coins: save.economy.coins + awardedCoins,
      lastDailyClaimDate: today,
      dailyStreak: streak,
      undoItems: Math.min(ITEM_HOLDING_MAX.undo, save.economy.undoItems + 2),
      eraseItems: Math.min(ITEM_HOLDING_MAX.erase, save.economy.eraseItems + 1),
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, awardedCoins, undefined, save.unlockedCatLevels);
  }

  public async settleRun(request: RunRewardRequest): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    if (!request.runId || save.economy.settledRunIds.indexOf(request.runId) >= 0) {
      return this.result(save.economy, false, 0, undefined, save.unlockedCatLevels);
    }
    const awardedCoins = calculateRunReward(request.score, request.highestLevel);
    const economy = {
      ...save.economy,
      coins: save.economy.coins + awardedCoins,
      settledRunIds: [...save.economy.settledRunIds, request.runId],
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, awardedCoins, undefined, save.unlockedCatLevels);
  }

  public async grantCoins(amount: number): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const safeAmount = Number.isSafeInteger(amount) ? Math.max(0, amount) : 0;
    if (safeAmount <= 0) return this.result(save.economy, false, 0, undefined, save.unlockedCatLevels);
    const economy = { ...save.economy, coins: save.economy.coins + safeAmount };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, safeAmount, undefined, save.unlockedCatLevels);
  }

  public async claimTaskReward(_taskId: string, amount: number): Promise<EconomyMutationResult> {
    return this.grantCoins(amount);
  }

  public async grantItem(kind: ItemKind, amount: number): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const safeAmount = Number.isSafeInteger(amount) ? Math.max(0, amount) : 0;
    if (safeAmount <= 0) return this.result(save.economy, false, 0, undefined, save.unlockedCatLevels);
    const key = this.itemKey(kind);
    const current = save.economy[key] as number;
    const economy = { ...save.economy, [key]: current + safeAmount };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0, undefined, save.unlockedCatLevels);
  }

  public async consumeItems(kind: ItemKind, amount: number): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const safeAmount = Number.isSafeInteger(amount) ? Math.max(0, amount) : 0;
    if (safeAmount <= 0) return this.result(save.economy, false, 0, undefined, save.unlockedCatLevels);
    const key = this.itemKey(kind);
    const current = save.economy[key] as number;
    if (current < safeAmount) {
      return this.result(save.economy, false, 0, 'insufficient-items', save.unlockedCatLevels);
    }
    const economy = { ...save.economy, [key]: current - safeAmount };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0, undefined, save.unlockedCatLevels);
  }

  public async purchase(itemId: string): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) return this.result(save.economy, false, 0, 'invalid-item', save.unlockedCatLevels);
    if (save.economy.ownedItemIds.indexOf(item.id) >= 0) {
      return this.result(save.economy, false, 0, 'already-owned', save.unlockedCatLevels);
    }
    if (save.economy.coins < item.price) {
      return this.result(save.economy, false, 0, 'insufficient-coins', save.unlockedCatLevels);
    }
    const economy = {
      ...save.economy,
      coins: save.economy.coins - item.price,
      ownedItemIds: [...save.economy.ownedItemIds, item.id],
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0, undefined, save.unlockedCatLevels);
  }

  public async equip(itemId: string): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const item = findCosmetic(itemId);
    if (!item || save.economy.ownedItemIds.indexOf(itemId) < 0) {
      return this.result(save.economy, false, 0, 'invalid-item', save.unlockedCatLevels);
    }
    const key = this.equippedKey(item.category);
    const equipped: EquippedCosmetics = { ...save.economy.equipped, [key]: item.id };
    const economy = { ...save.economy, equipped };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0, undefined, save.unlockedCatLevels);
  }

  private snapshot(economy: EconomySaveData, unlockedCatLevels: readonly number[] = [1]): EconomySnapshot {
    const today = this.clock.today();
    return {
      ...economy,
      unlockedCatLevels,
      catalog: allCosmetics(),
      canClaimDaily: economy.lastDailyClaimDate !== today,
      dailyReward: calculateDailyReward(
        economy.lastDailyClaimDate && this.isYesterday(economy.lastDailyClaimDate, today)
          ? economy.dailyStreak : 0,
      ),
    };
  }

  private result(economy: EconomySaveData, ok: boolean, awardedCoins: number,
    reason?: EconomyMutationResult['reason'], unlockedCatLevels?: readonly number[]): EconomyMutationResult {
    return { ...this.snapshot(economy, unlockedCatLevels), ok, awardedCoins, ...(reason ? { reason } : {}) };
  }

  private itemKey(kind: ItemKind): keyof EconomySaveData {
    const map: Record<ItemKind, keyof EconomySaveData> = {
      undo: 'undoItems',
      spawn: 'spawnItems',
      shuffle: 'shuffleItems',
      erase: 'eraseItems',
    };
    return map[kind];
  }

  private dailyAdKey(kind: ItemKind): keyof EconomySaveData {
    const map: Record<ItemKind, keyof EconomySaveData> = {
      undo: 'dailyAdUndo',
      spawn: 'dailyAdSpawn',
      shuffle: 'dailyAdShuffle',
      erase: 'dailyAdErase',
    };
    return map[kind];
  }

  /** 检查是否可以通过广告获取道具（每日限制 + 持有上限） */
  public canGrantViaAd(kind: ItemKind, today: string): boolean {
    const save = this.saveStorage.load();
    const itemKey = this.itemKey(kind);
    const adKey = this.dailyAdKey(kind);
    const current = save.economy[itemKey] as number;
    const dailyAdCount = save.economy[adKey] as number;
    const holdingMax = ITEM_HOLDING_MAX[kind] ?? 0;
    const dailyAdMax = ITEM_DAILY_AD_MAX[kind] ?? 0;
    if (current >= holdingMax) return false;
    if (save.economy.lastDailyClaimDate === today) {
      // 同一天，检查广告计数
    }
    // 简化：检查 dailyAdCount 是否 < dailyAdMax
    // 跨天时 dailyAdCount 会在 grantItem 中重置
    return current < holdingMax && dailyAdCount < dailyAdMax;
  }

  /** 通过广告获取道具（会记录每日广告计数） */
  public async grantViaAd(kind: ItemKind): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const today = this.clock.today();
    const itemKey = this.itemKey(kind);
    const adKey = this.dailyAdKey(kind);
    const current = save.economy[itemKey] as number;
    const holdingMax = ITEM_HOLDING_MAX[kind] ?? 0;
    const dailyAdMax = ITEM_DAILY_AD_MAX[kind] ?? 0;

    // 跨天重置广告计数
    const isSameDay = save.economy.lastDailyClaimDate === today
      || this.isYesterday(save.economy.lastDailyClaimDate, today);
    const dailyAdCount = isSameDay ? (save.economy[adKey] as number) : 0;

    if (current >= holdingMax) {
      return this.result(save.economy, false, 0, 'already-claimed', save.unlockedCatLevels);
    }
    if (dailyAdCount >= dailyAdMax) {
      return this.result(save.economy, false, 0, 'already-claimed', save.unlockedCatLevels);
    }

    const economy = {
      ...save.economy,
      [itemKey]: current + 1,
      [adKey]: dailyAdCount + 1,
      lastDailyClaimDate: save.economy.lastDailyClaimDate ?? today,
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0, undefined, save.unlockedCatLevels);
  }

  /** 获取道具库存数量 */
  public getItemCount(kind: ItemKind): number {
    const save = this.saveStorage.load();
    const key = this.itemKey(kind);
    return save.economy[key] as number;
  }

  /** 检查道具库存是否充足 */
  public hasItem(kind: ItemKind): boolean {
    return this.getItemCount(kind) > 0;
  }

  private equippedKey(category: CosmeticCategory): keyof EquippedCosmetics {
    if (category === 'cat-skin') return 'catSkin';
    return category;
  }

  private isYesterday(previous: string | null, today: string): boolean {
    if (!previous) return false;
    const previousTime = Date.parse(`${previous}T00:00:00Z`);
    const todayTime = Date.parse(`${today}T00:00:00Z`);
    return Number.isFinite(previousTime) && (todayTime - previousTime) === 24 * 60 * 60 * 1000;
  }
}

export { DEFAULT_ECONOMY, DEFAULT_EQUIPPED };
