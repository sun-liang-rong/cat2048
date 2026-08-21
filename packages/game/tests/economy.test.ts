import { describe, expect, it } from 'vitest';
import {
  calculateDailyReward,
  calculateRunReward,
  LocalEconomyRepository,
} from '../assets/scripts/features/economy/economy';
import { allCosmetics, DEFAULT_ECONOMY, SHOP_ITEMS } from '../assets/scripts/features/economy/catalog';
import { DEFAULT_SAVE, SAVE_KEY } from '../assets/scripts/features/storage/storage';

class MemoryStorage {
  public values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('economy rules', () => {
  it('calculates capped run rewards from score and highest cat level', () => {
    expect(calculateRunReward(0, 1)).toBe(5);
    expect(calculateRunReward(0, 5)).toBe(15);
    expect(calculateRunReward(490, 4)).toBe(5);
    expect(calculateRunReward(1000, 5)).toBe(20);
    expect(calculateRunReward(7000, 7)).toBe(100);
    expect(calculateRunReward(20000, 9)).toBe(150);
    expect(calculateRunReward(0, 12)).toBe(150);
  });

  it('increases daily rewards by streak and caps at 100', () => {
    expect(calculateDailyReward(0)).toBe(30);
    expect(calculateDailyReward(1)).toBe(40);
    expect(calculateDailyReward(7)).toBe(100);
    expect(calculateDailyReward(99)).toBe(100);
  });
});

describe('LocalEconomyRepository', () => {
  it('claims daily reward once per local date and resets a broken streak', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage(), {
      today: () => '2026-08-03',
    });

    const first = await repository.claimDailyReward();
    const duplicate = await repository.claimDailyReward();

    expect(first.awardedCoins).toBe(30);
    expect(duplicate.awardedCoins).toBe(0);
    expect((await repository.load()).dailyStreak).toBe(1);

    const nextDay = new LocalEconomyRepository(new MemoryStorage(), {
      today: () => '2026-08-05',
    });
    const afterGap = await nextDay.claimDailyReward();
    expect(afterGap.awardedCoins).toBe(30);
  });

  it('settles one run only once', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());
    const request = { runId: 'run-1', score: 1000, highestLevel: 5 } as const;

    const first = await repository.settleRun(request);
    const duplicate = await repository.settleRun(request);

    expect(first.awardedCoins).toBe(20);
    expect(duplicate.awardedCoins).toBe(0);
    expect((await repository.load()).coins).toBe(DEFAULT_ECONOMY.coins + 20);
  });

  it('grants coins for task rewards and ignores invalid amounts', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());

    const granted = await repository.grantCoins(30);
    expect(granted.ok).toBe(true);
    expect(granted.awardedCoins).toBe(30);
    expect((await repository.load()).coins).toBe(DEFAULT_ECONOMY.coins + 30);

    const rejected = await repository.grantCoins(-5);
    expect(rejected.ok).toBe(false);
    expect(rejected.awardedCoins).toBe(0);
    expect((await repository.load()).coins).toBe(DEFAULT_ECONOMY.coins + 30);
  });

  it('grants and consumes bonus items for the next runs', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());

    const grantedUndo = await repository.grantItem('undo', 2);
    const grantedRemove = await repository.grantItem('remove-lowest', 1);
    expect(grantedUndo.ok).toBe(true);
    expect(grantedRemove.ok).toBe(true);
    expect((await repository.load()).undoItems).toBe(2);
    expect((await repository.load()).removeLowestItems).toBe(1);

    const consumedUndo = await repository.consumeItems('undo', 1);
    expect(consumedUndo.ok).toBe(true);
    expect((await repository.load()).undoItems).toBe(1);

    const invalid = await repository.consumeItems('undo', -1);
    expect(invalid.ok).toBe(false);
    expect((await repository.load()).undoItems).toBe(1);
  });

  it('does not spend coins when balance is insufficient and equips owned items', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());
    const item = SHOP_ITEMS.find((candidate) => candidate.category === 'board');
    if (!item) throw new Error('Missing board catalog item');

    const rejected = await repository.purchase(item.id);
    expect(rejected.ok).toBe(false);
    expect((await repository.load()).coins).toBe(DEFAULT_ECONOMY.coins);

    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: { ...DEFAULT_ECONOMY, coins: 1000 },
    }));
    const fundedRepository = new LocalEconomyRepository(storage);
    const purchased = await fundedRepository.purchase(item.id);
    const equipped = await fundedRepository.equip(item.id);

    expect(purchased.ok).toBe(true);
    expect(equipped.ok).toBe(true);
    expect((await fundedRepository.load()).equipped.board).toBe(item.id);
  });

  it('exposes default cosmetics in the shop catalog', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());
    const snapshot = await repository.load();

    expect(snapshot.catalog.map((item) => item.id)).toEqual(allCosmetics().map((item) => item.id));
  });

  it('does not allow purchasing a default cosmetic', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());

    const result = await repository.purchase('cat-skin.default');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-item');
    expect(result.coins).toBe(DEFAULT_ECONOMY.coins);
  });

  it('does not charge twice for the same cosmetic', async () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: { ...DEFAULT_ECONOMY, coins: 1000 },
    }));
    const repository = new LocalEconomyRepository(storage);
    const item = SHOP_ITEMS.find((candidate) => candidate.category === 'board');
    if (!item) throw new Error('Missing board catalog item');

    const first = await repository.purchase(item.id);
    const duplicate = await repository.purchase(item.id);

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toBe('already-owned');
    expect((await repository.load()).coins).toBe(1000 - item.price);
  });
});
