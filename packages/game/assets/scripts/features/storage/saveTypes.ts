/**
 * 存档数据类型定义。
 */
import type { EconomySaveData } from '../economy/catalog';

export interface TutorialProgress {
  readonly swipeGuideCompleted: boolean;
}

export interface SaveDataV1 {
  readonly schemaVersion: 1;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled?: boolean;
}

export interface SaveDataV2 {
  readonly schemaVersion: 2;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly unlockedCatLevels: readonly number[];
  readonly tutorial: TutorialProgress;
}

export interface SaveDataV3 {
  readonly schemaVersion: 3;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly musicEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly unlockedCatLevels: readonly number[];
  readonly tutorial: TutorialProgress;
  readonly economy: EconomySaveData;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
