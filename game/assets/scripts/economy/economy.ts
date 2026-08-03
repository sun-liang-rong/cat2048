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
} from '../infrastructure/storage';
import { GAME_CONFIG } from '../infrastructure/gameConfig';

export interface RunRewardRequest {
  readonly runId: string;
  readonly score: number;
  readonly highestLevel: number;
}

export interface EconomySnapshot extends EconomySaveData {
  readonly catalog: ReturnType<typeof allCosmetics>;
  readonly canClaimDaily: boolean;
  readonly dailyReward: number;
}

export interface EconomyMutationResult extends EconomySnapshot {
  readonly ok: boolean;
  readonly awardedCoins: number;
  readonly reason?: 'already-claimed' | 'already-owned' | 'insufficient-coins' | 'invalid-item';
}

export interface EconomyRepository {
  load(): Promise<EconomySnapshot>;
  claimDailyReward(): Promise<EconomyMutationResult>;
  settleRun(request: RunRewardRequest): Promise<EconomyMutationResult>;
  purchase(itemId: string): Promise<EconomyMutationResult>;
  equip(itemId: string): Promise<EconomyMutationResult>;
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
  private readonly saveStorage: LocalGameStorage;
  private readonly clock: EconomyClock;

  public constructor(storage: KeyValueStorage, clock: EconomyClock = { today: localDate }) {
    this.saveStorage = new LocalGameStorage(storage);
    this.clock = clock;
  }

  public async load(): Promise<EconomySnapshot> {
    return this.snapshot(this.saveStorage.load().economy);
  }

  public async claimDailyReward(): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const today = this.clock.today();
    if (save.economy.lastDailyClaimDate === today) {
      return this.result(save.economy, false, 0, 'already-claimed');
    }
    const streak = this.isYesterday(save.economy.lastDailyClaimDate, today)
      ? save.economy.dailyStreak + 1 : 1;
    const awardedCoins = calculateDailyReward(streak - 1);
    const economy = {
      ...save.economy,
      coins: save.economy.coins + awardedCoins,
      lastDailyClaimDate: today,
      dailyStreak: streak,
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, awardedCoins);
  }

  public async settleRun(request: RunRewardRequest): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    if (!request.runId || save.economy.settledRunIds.indexOf(request.runId) >= 0) {
      return this.result(save.economy, false, 0);
    }
    const awardedCoins = calculateRunReward(request.score, request.highestLevel);
    const economy = {
      ...save.economy,
      coins: save.economy.coins + awardedCoins,
      settledRunIds: [...save.economy.settledRunIds, request.runId],
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, awardedCoins);
  }

  public async purchase(itemId: string): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) return this.result(save.economy, false, 0, 'invalid-item');
    if (save.economy.ownedItemIds.indexOf(item.id) >= 0) {
      return this.result(save.economy, false, 0, 'already-owned');
    }
    if (save.economy.coins < item.price) {
      return this.result(save.economy, false, 0, 'insufficient-coins');
    }
    const economy = {
      ...save.economy,
      coins: save.economy.coins - item.price,
      ownedItemIds: [...save.economy.ownedItemIds, item.id],
    };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0);
  }

  public async equip(itemId: string): Promise<EconomyMutationResult> {
    const save = this.saveStorage.load();
    const item = findCosmetic(itemId);
    if (!item || save.economy.ownedItemIds.indexOf(itemId) < 0) {
      return this.result(save.economy, false, 0, 'invalid-item');
    }
    const key = this.equippedKey(item.category);
    const equipped: EquippedCosmetics = key === 'catSkin'
      ? { ...save.economy.equipped, catSkin: item.id }
      : key === 'board'
        ? { ...save.economy.equipped, board: item.id }
        : key === 'effect'
          ? { ...save.economy.equipped, effect: item.id }
          : { ...save.economy.equipped, buttonTheme: item.id };
    const economy = { ...save.economy, equipped };
    this.saveStorage.save({ ...save, economy });
    return this.result(economy, true, 0);
  }

  private snapshot(economy: EconomySaveData): EconomySnapshot {
    const today = this.clock.today();
    return {
      ...economy,
      catalog: allCosmetics(),
      canClaimDaily: economy.lastDailyClaimDate !== today,
      dailyReward: calculateDailyReward(
        economy.lastDailyClaimDate && this.isYesterday(economy.lastDailyClaimDate, today)
          ? economy.dailyStreak : 0,
      ),
    };
  }

  private result(economy: EconomySaveData, ok: boolean, awardedCoins: number,
    reason?: EconomyMutationResult['reason']): EconomyMutationResult {
    return { ...this.snapshot(economy), ok, awardedCoins, ...(reason ? { reason } : {}) };
  }

  private equippedKey(category: CosmeticCategory): keyof EquippedCosmetics {
    if (category === 'cat-skin') return 'catSkin';
    if (category === 'button-theme') return 'buttonTheme';
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
