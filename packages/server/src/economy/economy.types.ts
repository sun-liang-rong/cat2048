export type EconomyItemKind = 'undo' | 'spawn' | 'shuffle' | 'erase';

export interface EconomyItems {
  readonly undo: number;
  readonly spawn: number;
  readonly shuffle: number;
  readonly erase: number;
}

export interface EconomySnapshot {
  readonly version: number;
  readonly migrationVersion: number;
  readonly catalogVersion: string;
  readonly coins: number;
  readonly unlockedCatLevels: readonly number[];
  readonly ownedItemIds: readonly string[];
  readonly equipped: {
    readonly catSkin: string;
    readonly board: string;
    readonly effect: string;
  };
  readonly items: EconomyItems;
  readonly daily: {
    readonly canClaim: boolean;
    readonly reward: number;
    readonly streak: number;
    readonly lastClaimDate: string | null;
    readonly adCounts: EconomyItems;
    readonly counterDate: string | null;
    readonly loginClaimed: boolean;
    readonly shareUndo: number;
  };
}

export interface EconomyMutationResult {
  readonly ok: boolean;
  readonly awardedCoins: number;
  readonly reason?: string;
  readonly snapshot: EconomySnapshot;
}
