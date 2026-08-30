import { describe, expect, it, vi } from 'vitest';
import { ECONOMY_OUTBOX_KEY, RemoteEconomyRepository } from '../assets/scripts/features/economy/remoteEconomy';
import type { EconomyApiClient } from '../assets/scripts/features/economy/economyApi';
import { DEFAULT_SAVE, SAVE_KEY } from '../assets/scripts/features/storage/storage';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

const remoteSnapshot = (migrationVersion: number) => ({
  data: {
    version: 2,
    migrationVersion,
    catalogVersion: '2026-08-01',
    coins: 580,
    unlockedCatLevels: [1, 2, 3],
    ownedItemIds: ['cat-skin.default', 'board.wood', 'effect.classic', 'cat-skin.sunny'],
    equipped: { catSkin: 'cat-skin.sunny', board: 'board.wood', effect: 'effect.classic' },
    items: { undo: 2, spawn: 1, shuffle: 0, erase: 0 },
    daily: {
      canClaim: true,
      reward: 30,
      streak: 1,
      lastClaimDate: '2026-08-29',
      adCounts: { undo: 1, spawn: 0, shuffle: 0, erase: 0 },
      counterDate: '2026-08-30',
      loginClaimed: true,
      shareUndo: 0,
    },
  },
});

describe('RemoteEconomyRepository', () => {
  it('migrates the local save once and persists the server snapshot', async () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: { ...DEFAULT_SAVE.economy, coins: 500, ownedItemIds: [...DEFAULT_SAVE.economy.ownedItemIds, 'cat-skin.sunny'] },
      unlockedCatLevels: [1, 2],
    }));
    const calls: Array<{ path: string; key?: string }> = [];
    const api: EconomyApiClient = {
      request: vi.fn(async (_method, path, _body, key) => {
        calls.push({ path, key });
        return (path.endsWith('bootstrap') ? remoteSnapshot(0) : remoteSnapshot(1)) as never;
      }),
    };
    const repository = new RemoteEconomyRepository(api, storage);
    const updates: number[] = [];
    repository.setSnapshotListener((snapshot) => updates.push(snapshot.coins));

    await expect(repository.sync()).resolves.toMatchObject({ coins: 580, unlockedCatLevels: [1, 2, 3] });
    expect(calls.map((call) => call.path)).toEqual(['/v1/economy/bootstrap', '/v1/economy/migrate']);
    expect(calls[1]?.key).toBeTruthy();
    expect(updates).toEqual([580]);
    expect(JSON.parse(storage.getItem(SAVE_KEY) ?? '{}').economy.coins).toBe(580);
  });

  it('returns the local cache when the server is unavailable', async () => {
    const storage = new MemoryStorage();
    const api: EconomyApiClient = { request: vi.fn().mockRejectedValue(new Error('offline')) };
    const repository = new RemoteEconomyRepository(api, storage);

    await expect(repository.sync()).resolves.toMatchObject({ coins: 100, unlockedCatLevels: [1] });
  });

  it('queues a failed run reward and flushes it with the original run key', async () => {
    const storage = new MemoryStorage();
    let runAttempts = 0;
    const api: EconomyApiClient = {
      request: vi.fn(async (_method, path) => {
        if (path.endsWith('bootstrap')) return remoteSnapshot(1) as never;
        runAttempts += 1;
        if (runAttempts <= 2) throw new Error('offline');
        return { data: { ok: true, awardedCoins: 20, snapshot: remoteSnapshot(1).data } } as never;
      }),
    };
    const repository = new RemoteEconomyRepository(api, storage);

    await expect(repository.settleRun({ runId: 'run-offline', score: 1000, highestLevel: 5 })).rejects.toThrow('offline');
    expect(JSON.parse(storage.getItem(ECONOMY_OUTBOX_KEY) ?? '[]')).toHaveLength(1);
    await repository.sync();
    expect(JSON.parse(storage.getItem(ECONOMY_OUTBOX_KEY) ?? '[]')).toEqual([]);
    expect(api.request).toHaveBeenLastCalledWith(
      'POST', '/v1/economy/run-reward', expect.objectContaining({ runId: 'run-offline' }), 'run-run-offline',
    );
  });

  it('uses server-side ad counters and gameplay limits after synchronization', async () => {
    const storage = new MemoryStorage();
    const api: EconomyApiClient = {
      request: vi.fn(async () => remoteSnapshot(1) as never),
    };
    const repository = new RemoteEconomyRepository(api, storage);

    await repository.sync();

    expect(repository.canGrantViaAd('shuffle', '2026-08-30')).toBe(true);
    expect(repository.canGrantViaAd('erase', '2026-08-30')).toBe(true);
    expect(repository.canGrantViaAd('undo', '2026-08-29')).toBe(true);
  });

  it('retries a timed-out mutation with the same idempotency key', async () => {
    const storage = new MemoryStorage();
    const keys: string[] = [];
    const api: EconomyApiClient = {
      request: vi.fn(async (_method, path, _body, key) => {
        if (path.endsWith('purchase')) {
          keys.push(key ?? '');
          if (keys.length === 1) throw new Error('timeout');
          return {
            data: { ok: true, awardedCoins: 0, snapshot: remoteSnapshot(1).data },
          } as never;
        }
        return remoteSnapshot(1) as never;
      }),
    };
    const repository = new RemoteEconomyRepository(api, storage);

    await expect(repository.purchase('cat-skin.sunny')).resolves.toMatchObject({ ok: true });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps a successful daily claim when an older bootstrap finishes afterwards', async () => {
    const storage = new MemoryStorage();
    const stale = remoteSnapshot(1).data;
    const claimed = {
      ...stale,
      version: stale.version + 1,
      coins: stale.coins + 30,
      daily: {
        ...stale.daily,
        canClaim: false,
        streak: stale.daily.streak + 1,
        lastClaimDate: '2026-08-30',
      },
    };
    let releaseBootstrap!: (value: unknown) => void;
    const bootstrap = new Promise<unknown>((resolve) => { releaseBootstrap = resolve; });
    const api: EconomyApiClient = {
      request: vi.fn(async (_method, path) => {
        if (path.endsWith('bootstrap')) return bootstrap as never;
        return { data: { ok: true, awardedCoins: 30, snapshot: claimed } } as never;
      }),
    };
    const repository = new RemoteEconomyRepository(api, storage);
    const sync = repository.sync();

    await expect(repository.claimDailyReward()).resolves.toMatchObject({
      ok: true,
      canClaimDaily: false,
      coins: claimed.coins,
    });
    releaseBootstrap({ data: stale });
    await sync;

    await expect(repository.load()).resolves.toMatchObject({
      canClaimDaily: false,
      coins: claimed.coins,
    });
  });
});
