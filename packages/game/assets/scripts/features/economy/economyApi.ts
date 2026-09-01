import type { EquippedCosmetics } from './catalog';

export const ECONOMY_API_ROUTES = {
  bootstrap: '/v1/economy/bootstrap',
  migrate: '/v1/economy/migrate',
  dailyClaim: '/v1/economy/daily-claim',
  runReward: '/v1/economy/run-reward',
  purchase: '/v1/economy/purchase',
  equip: '/v1/economy/equip',
  consumeItem: '/v1/economy/items/consume',
  adReward: '/v1/economy/items/ad-reward',
  taskReward: '/v1/economy/task-reward',
} as const;

export interface EconomyApiClient {
  request<TResponse>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<TResponse>;
}

export interface RunRewardPayload {
  readonly runId: string;
  readonly score: number;
  readonly highestLevel: number;
  readonly discoveredLevels?: readonly number[];
}

export interface DailyClaimPayload {
  readonly doubleReward?: boolean;
}

export interface PurchasePayload {
  readonly itemId: string;
  readonly catalogVersion?: string;
}

export interface EquipPayload {
  readonly itemId: string;
}

export interface EconomyApiState {
  readonly coins: number;
  readonly ownedItemIds: readonly string[];
  readonly equipped: EquippedCosmetics;
  readonly lastDailyClaimDate: string | null;
  readonly dailyStreak: number;
  readonly catalogVersion: string;
}

export interface EconomyMigrationPayload {
  readonly migrationVersion: number;
  readonly saveSchemaVersion: number;
  readonly coins: number;
  readonly ownedItemIds: readonly string[];
  readonly unlockedCatLevels: readonly number[];
  readonly equipped: EquippedCosmetics;
  readonly items: { readonly undo: number; readonly spawn: number; readonly shuffle: number; readonly erase: number };
  readonly lastDailyClaimDate: string | null;
  readonly dailyStreak: number;
}
