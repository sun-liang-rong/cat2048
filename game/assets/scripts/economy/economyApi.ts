import type { EquippedCosmetics } from './catalog';

export const ECONOMY_API_ROUTES = {
  bootstrap: '/v1/economy/bootstrap',
  dailyClaim: '/v1/economy/daily-claim',
  runReward: '/v1/economy/run-reward',
  purchase: '/v1/economy/purchase',
  equip: '/v1/economy/equip',
} as const;

export interface EconomyApiClient {
  request<TResponse>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<TResponse>;
}

export interface RunRewardPayload {
  readonly runId: string;
  readonly score: number;
  readonly highestLevel: number;
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
