import type { ItemKind } from '../../core/types';
import {
  type EconomyApiClient,
  ECONOMY_API_ROUTES,
  type EconomyMigrationPayload,
  type RunRewardPayload,
} from './economyApi';
import {
  type EconomyMutationResult,
  type EconomyRepository,
  type EconomySnapshot,
  type RunRewardRequest,
  LocalEconomyRepository,
} from './economy';
import { allCosmetics, DEFAULT_EQUIPPED } from './catalog';
import { LocalGameStorage, type KeyValueStorage } from '../storage/storage';
import type { LeaderboardClient } from '../leaderboard/leaderboard';
import { ITEM_DAILY_AD_MAX, ITEM_HOLDING_MAX } from '../../core/config/constants';

interface ApiEnvelope<T> { readonly data: T; }

interface RemoteSnapshot {
  readonly version: number;
  readonly migrationVersion: number;
  readonly catalogVersion: string;
  readonly coins: number;
  readonly unlockedCatLevels: readonly number[];
  readonly ownedItemIds: readonly string[];
  readonly equipped: { readonly catSkin: string; readonly board: string; readonly effect: string };
  readonly items: { readonly undo: number; readonly spawn: number; readonly shuffle: number; readonly erase: number };
  readonly daily: {
    readonly canClaim: boolean;
    readonly reward: number;
    readonly streak: number;
    readonly lastClaimDate: string | null;
    readonly adCounts: { readonly undo: number; readonly spawn: number; readonly shuffle: number; readonly erase: number };
    readonly counterDate: string | null;
    readonly loginClaimed: boolean;
    readonly shareUndo: number;
  };
}

interface RemoteMutation { readonly ok: boolean; readonly awardedCoins: number; readonly reason?: string; readonly snapshot: RemoteSnapshot; }

export const ECONOMY_MIGRATION_KEY = 'cat2048.economy.migration.v1';
export const ECONOMY_OUTBOX_KEY = 'cat2048.economy.outbox.v1';

/**
 * 服务端经济仓库：本地存档只作为启动缓存和一次性迁移来源，写操作由服务端决定最终结果。
 */
export class RemoteEconomyRepository implements EconomyRepository {
  public readonly serverAuthoritative = true;
  private latest: EconomySnapshot | null = null;
  private syncInFlight: Promise<EconomySnapshot> | null = null;
  private listener: ((snapshot: EconomySnapshot) => void) | null = null;
  private latestAdCounterDate: string | null = null;
  private readonly local: LocalEconomyRepository;
  private readonly saveStorage: LocalGameStorage;

  public constructor(
    private readonly api: EconomyApiClient,
    private readonly storage: KeyValueStorage,
  ) {
    this.local = new LocalEconomyRepository(storage);
    this.saveStorage = new LocalGameStorage(storage);
  }

  public load(): Promise<EconomySnapshot> {
    return this.local.load();
  }

  /** 后台登录并执行 bootstrap/一次性本地迁移。失败时保留本地缓存，下次继续重试。 */
  public sync(): Promise<EconomySnapshot> {
    if (this.syncInFlight) return this.syncInFlight;
    const promise = this.synchronize().finally(() => {
      if (this.syncInFlight === promise) this.syncInFlight = null;
    });
    this.syncInFlight = promise;
    return promise;
  }

  public setSnapshotListener(listener: (snapshot: EconomySnapshot) => void): void {
    this.listener = listener;
    if (this.latest) listener(this.latest);
  }

  public async claimDailyReward(): Promise<EconomyMutationResult> {
    return this.mutate(ECONOMY_API_ROUTES.dailyClaim, undefined, 'daily');
  }

  public async settleRun(request: RunRewardRequest): Promise<EconomyMutationResult> {
    const payload: RunRewardPayload = {
      runId: request.runId,
      score: request.score,
      highestLevel: request.highestLevel,
      discoveredLevels: request.discoveredLevels,
    };
    try {
      const result = await this.mutate(ECONOMY_API_ROUTES.runReward, payload, `run-${request.runId}`, true);
      this.removePendingRun(request.runId);
      return result;
    } catch (error) {
      this.enqueuePendingRun(payload);
      throw error;
    }
  }

  public async grantCoins(amount: number): Promise<EconomyMutationResult> {
    void amount;
    throw new Error('Arbitrary coin grants are disabled for the remote economy.');
  }

  public async claimTaskReward(taskId: string, _amount: number): Promise<EconomyMutationResult> {
    return this.mutate(ECONOMY_API_ROUTES.taskReward, { taskId }, `task-${taskId}-${new Date().toISOString().slice(0, 10)}`);
  }

  public async consumeItems(kind: ItemKind, amount: number): Promise<EconomyMutationResult> {
    return this.mutate(ECONOMY_API_ROUTES.consumeItem, { kind, amount }, `consume-${kind}`);
  }

  public async purchase(itemId: string): Promise<EconomyMutationResult> {
    return this.mutate(ECONOMY_API_ROUTES.purchase, { itemId }, `purchase-${itemId}`);
  }

  public async equip(itemId: string): Promise<EconomyMutationResult> {
    return this.mutate(ECONOMY_API_ROUTES.equip, { itemId }, `equip-${itemId}`);
  }

  public async grantViaAd(kind: ItemKind): Promise<EconomyMutationResult> {
    return this.mutate(ECONOMY_API_ROUTES.adReward, { kind, amount: 1 }, `ad-${kind}`);
  }

  public canGrantViaAd(kind: ItemKind, today: string): boolean {
    if (this.latest) {
      const itemKey = this.itemKey(kind);
      const adKey = this.dailyAdKey(kind);
      const adCount = this.latestAdCounterDate === today ? this.latest[adKey] : 0;
      return this.latest[itemKey] < ITEM_HOLDING_MAX[kind] && adCount < ITEM_DAILY_AD_MAX[kind];
    }
    return this.local.canGrantViaAd(kind, today);
  }

  public getItemCount(kind: ItemKind): number {
    return this.latest?.[this.itemKey(kind)] ?? this.local.getItemCount(kind);
  }

  public hasItem(kind: ItemKind): boolean { return this.getItemCount(kind) > 0; }

  private async synchronize(): Promise<EconomySnapshot> {
    try {
      const response = await this.request<ApiEnvelope<RemoteSnapshot>>('GET', ECONOMY_API_ROUTES.bootstrap);
      const remote = response.data;
      const snapshot = remote.migrationVersion === 0
        ? (await this.request<ApiEnvelope<RemoteSnapshot>>(
          'POST', ECONOMY_API_ROUTES.migrate, this.migrationPayload(), this.migrationId(),
        )).data
        : remote;
      const accepted = this.accept(snapshot);
      await this.flushRunOutbox();
      return this.latest ?? accepted;
    } catch (error) {
      console.warn('[Cat2048] Economy sync failed; keeping local cache.', error);
      return this.local.load();
    }
  }

  private async mutate(path: string, body: unknown, keySuffix: string, stableKey = false): Promise<EconomyMutationResult> {
    // 请求超时不等于服务端未执行：复用同一个幂等键重试一次，既能找回
    // 已落库的结果，也不会导致购买/扣道具重复扣除。
    const idempotencyKey = stableKey ? keySuffix : this.operationId(keySuffix);
    let response: ApiEnvelope<RemoteMutation>;
    try {
      response = await this.request<ApiEnvelope<RemoteMutation>>('POST', path, body, idempotencyKey);
    } catch (firstError) {
      try {
        response = await this.request<ApiEnvelope<RemoteMutation>>('POST', path, body, idempotencyKey);
      } catch {
        throw firstError;
      }
    }
    return this.acceptMutation(response.data);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, suffix?: string): Promise<T> {
    return this.api.request<T>(method, path, body, suffix);
  }

  private migrationPayload(): EconomyMigrationPayload {
    const save = this.saveStorage.load();
    return {
      migrationVersion: 1,
      saveSchemaVersion: save.schemaVersion,
      coins: save.economy.coins,
      ownedItemIds: save.economy.ownedItemIds,
      unlockedCatLevels: save.unlockedCatLevels,
      equipped: save.economy.equipped,
      items: {
        undo: save.economy.undoItems,
        spawn: save.economy.spawnItems,
        shuffle: save.economy.shuffleItems,
        erase: save.economy.eraseItems,
      },
      lastDailyClaimDate: save.economy.lastDailyClaimDate,
      dailyStreak: save.economy.dailyStreak,
    };
  }

  private migrationId(): string {
    const existing = this.saveStorageValue(ECONOMY_MIGRATION_KEY);
    if (existing) return existing;
    const generated = `migration-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.saveStorageValue(ECONOMY_MIGRATION_KEY, generated);
    return generated;
  }

  private operationId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private pendingRuns(): readonly RunRewardPayload[] {
    const raw = this.storage.getItem(ECONOMY_OUTBOX_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is RunRewardPayload => {
        const value = item as Partial<RunRewardPayload>;
        return typeof value.runId === 'string' && value.runId.length > 0
          && typeof value.score === 'number' && Number.isSafeInteger(value.score)
          && typeof value.highestLevel === 'number' && Number.isInteger(value.highestLevel);
      });
    } catch {
      return [];
    }
  }

  private enqueuePendingRun(payload: RunRewardPayload): void {
    const current = this.pendingRuns();
    if (current.some((item) => item.runId === payload.runId)) return;
    this.storage.setItem(ECONOMY_OUTBOX_KEY, JSON.stringify([...current, payload]));
  }

  private removePendingRun(runId: string): void {
    this.storage.setItem(ECONOMY_OUTBOX_KEY, JSON.stringify(this.pendingRuns().filter((item) => item.runId !== runId)));
  }

  private async flushRunOutbox(): Promise<void> {
    for (const payload of this.pendingRuns()) {
      try {
        await this.settleRun(payload);
      } catch {
        break;
      }
    }
  }

  private saveStorageValue(key: string, value?: string): string | null {
    if (value !== undefined) this.storage.setItem(key, value);
    return this.storage.getItem(key);
  }

  private accept(remote: RemoteSnapshot): EconomySnapshot {
    const current = this.saveStorage.load();
    const snapshot = this.toSnapshot(remote, current.economy.settledRunIds);
    this.latestAdCounterDate = remote.daily.counterDate;
    this.persist(snapshot);
    this.latest = snapshot;
    this.listener?.(snapshot);
    return snapshot;
  }

  private acceptMutation(remote: RemoteMutation): EconomyMutationResult {
    const snapshot = this.accept(remote.snapshot);
    return { ...snapshot, ok: remote.ok, awardedCoins: remote.awardedCoins, ...(remote.reason ? { reason: remote.reason as EconomyMutationResult['reason'] } : {}) };
  }

  private toSnapshot(remote: RemoteSnapshot, settledRunIds: readonly string[]): EconomySnapshot {
    return {
      coins: remote.coins,
      ownedItemIds: remote.ownedItemIds,
      equipped: remote.equipped ?? DEFAULT_EQUIPPED,
      lastDailyClaimDate: remote.daily.lastClaimDate,
      dailyStreak: remote.daily.streak,
      settledRunIds,
      undoItems: remote.items.undo,
      spawnItems: remote.items.spawn,
      shuffleItems: remote.items.shuffle,
      eraseItems: remote.items.erase,
      dailyAdUndo: remote.daily.adCounts.undo,
      dailyAdSpawn: remote.daily.adCounts.spawn,
      dailyAdShuffle: remote.daily.adCounts.shuffle,
      dailyAdErase: remote.daily.adCounts.erase,
      dailyLoginClaimed: remote.daily.loginClaimed,
      dailyShareUndo: remote.daily.shareUndo,
      unlockedCatLevels: remote.unlockedCatLevels,
      catalog: allCosmetics(),
      canClaimDaily: remote.daily.canClaim,
      dailyReward: remote.daily.reward,
    };
  }

  private persist(snapshot: EconomySnapshot): void {
    const save = this.saveStorage.load();
    this.saveStorage.save({
      ...save,
      unlockedCatLevels: [...snapshot.unlockedCatLevels],
      economy: {
        ...save.economy,
        coins: snapshot.coins,
        ownedItemIds: snapshot.ownedItemIds,
        equipped: snapshot.equipped,
        lastDailyClaimDate: snapshot.lastDailyClaimDate,
        dailyStreak: snapshot.dailyStreak,
        settledRunIds: snapshot.settledRunIds,
        undoItems: snapshot.undoItems,
        spawnItems: snapshot.spawnItems,
        shuffleItems: snapshot.shuffleItems,
        eraseItems: snapshot.eraseItems,
        dailyAdUndo: snapshot.dailyAdUndo,
        dailyAdSpawn: snapshot.dailyAdSpawn,
        dailyAdShuffle: snapshot.dailyAdShuffle,
        dailyAdErase: snapshot.dailyAdErase,
        dailyLoginClaimed: snapshot.dailyLoginClaimed,
        dailyShareUndo: snapshot.dailyShareUndo,
      },
    });
  }

  private itemKey(kind: ItemKind): 'undoItems' | 'spawnItems' | 'shuffleItems' | 'eraseItems' {
    return ({ undo: 'undoItems', spawn: 'spawnItems', shuffle: 'shuffleItems', erase: 'eraseItems' } as const)[kind];
  }

  private dailyAdKey(kind: ItemKind): 'dailyAdUndo' | 'dailyAdSpawn' | 'dailyAdShuffle' | 'dailyAdErase' {
    return ({ undo: 'dailyAdUndo', spawn: 'dailyAdSpawn', shuffle: 'dailyAdShuffle', erase: 'dailyAdErase' } as const)[kind];
  }
}

export function createEconomyApiClient(leaderboard: LeaderboardClient): EconomyApiClient {
  return {
    request: <T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string) =>
      leaderboard.request<T>({ method, path, body, ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}) }),
  };
}
