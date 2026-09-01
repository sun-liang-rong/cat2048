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

  it('keeps the claimed streak reward visible and doubles an ad claim', async () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: {
        ...DEFAULT_ECONOMY,
        coins: 100,
        lastDailyClaimDate: '2026-08-31',
        dailyStreak: 2,
      },
    }));
    const repository = new LocalEconomyRepository(storage, { today: () => '2026-09-01' });

    expect((await repository.load()).dailyReward).toBe(50);
    const claimed = await repository.claimDailyReward(true);

    expect(claimed.awardedCoins).toBe(100);
    expect(claimed.coins).toBe(200);
    expect(claimed.dailyStreak).toBe(3);
    expect(claimed.dailyReward).toBe(50);
    await expect(repository.load()).resolves.toMatchObject({
      canClaimDaily: false,
      dailyReward: 50,
    });
  });

  it('allows repeated ad grants for undo and erase after each item is consumed', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage(), {
      today: () => '2026-09-01',
    });

    for (let index = 0; index < 5; index += 1) {
      if (index > 0) expect((await repository.grantViaAd('undo')).ok).toBe(true);
      expect((await repository.consumeItems('undo', 1)).ok).toBe(true);
      expect((await repository.grantViaAd('erase')).ok).toBe(true);
      expect((await repository.consumeItems('erase', 1)).ok).toBe(true);
    }

    expect(repository.canGrantViaAd('undo', '2026-09-01')).toBe(true);
    expect(repository.canGrantViaAd('erase', '2026-09-01')).toBe(true);
  });

  it('ignores legacy daily ad counters for unlimited item kinds', async () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: {
        ...DEFAULT_ECONOMY,
        undoItems: 0,
        eraseItems: 0,
        dailyCounterDate: '2026-09-01',
        dailyAdUndo: 999,
        dailyAdErase: 999,
      },
    }));
    const repository = new LocalEconomyRepository(storage, { today: () => '2026-09-01' });

    expect(repository.canGrantViaAd('undo', '2026-09-01')).toBe(true);
    expect(repository.canGrantViaAd('erase', '2026-09-01')).toBe(true);
    expect((await repository.grantViaAd('undo')).ok).toBe(true);
    expect((await repository.grantViaAd('erase')).ok).toBe(true);
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

  it('refreshes exactly one free undo per day and daily claim only grants coins', async () => {
    const storage = new MemoryStorage();
    let today = '2026-09-01';
    const repository = new LocalEconomyRepository(storage, { today: () => today });

    expect((await repository.load()).undoItems).toBe(1);
    expect((await repository.consumeItems('undo', 1)).ok).toBe(true);
    expect((await repository.claimDailyReward()).undoItems).toBe(0);
    expect((await repository.load()).eraseItems).toBe(0);

    today = '2026-09-02';
    expect((await repository.load()).undoItems).toBe(1);
    today = '2026-09-03';
    expect((await repository.load()).undoItems).toBe(1);

    storage.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: { ...DEFAULT_SAVE.economy, dailyCounterDate: today, undoItems: 4 },
    }));
    expect((await repository.load()).undoItems).toBe(1);
  });

  it('does not allow undo items to accumulate above one', async () => {
    const repository = new LocalEconomyRepository(new MemoryStorage());

    const grantedUndo = await repository.grantItem('undo', 2);
    const grantedErase = await repository.grantItem('erase', 1);
    expect(grantedUndo.ok).toBe(false);
    expect(grantedUndo.reason).toBe('holding-limit');
    expect(grantedErase.ok).toBe(true);
    expect((await repository.load()).undoItems).toBe(1);
    expect((await repository.load()).eraseItems).toBe(1);

    const consumedUndo = await repository.consumeItems('undo', 1);
    expect(consumedUndo.ok).toBe(true);
    expect((await repository.load()).undoItems).toBe(0);

    const invalid = await repository.consumeItems('undo', -1);
    expect(invalid.ok).toBe(false);
    expect((await repository.load()).undoItems).toBe(0);

    const insufficient = await repository.consumeItems('undo', 1);
    expect(insufficient.ok).toBe(false);
    expect(insufficient.reason).toBe('insufficient-items');
    expect((await repository.load()).undoItems).toBe(0);
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

  it('purchases and equips every pifu cat skin from the decoration shop', async () => {
    const pifuSkinIds = [
      'cat-skin.costume',
      'cat-skin.ocean',
      'cat-skin.dream',
      'cat-skin.jiguang',
    ] as const;

    for (const itemId of pifuSkinIds) {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, JSON.stringify({
        ...DEFAULT_SAVE,
        economy: { ...DEFAULT_ECONOMY, coins: 5000 },
      }));
      const repository = new LocalEconomyRepository(storage);

      expect((await repository.purchase(itemId)).ok).toBe(true);
      expect((await repository.equip(itemId)).ok).toBe(true);
      expect((await repository.load()).equipped.catSkin).toBe(itemId);
    }
  });
});
