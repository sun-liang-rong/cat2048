import { Board } from '../../core/Board';
import type { GameRunState } from '../../core/types';
import type { KeyValueStorage } from './storage';

export type SavedRunMode = 'classic' | 'daily-challenge';

/** 一局进行中游戏的可持久化会话（含 runId 会话元信息）。 */
export interface SavedRun extends GameRunState {
  readonly runId: string;
  readonly savedAt: number;
  readonly initialUndoItems?: number;
  readonly initialRemoveLowestItems?: number;
  readonly mode?: SavedRunMode;
  readonly dailyChallengeCompleted?: boolean;
  readonly moves?: number;
  readonly merges?: number;
}

export const RUN_SESSION_SAVE_KEY = 'cat2048.run-session.v1';

const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

const isBoardSnapshot = (value: unknown): boolean => {
  try {
    new Board(value as GameRunState['board']);
    return true;
  } catch (error) {
    return false;
  }
};

/** 校验并修复持久化的对局会话；数据不合法时返回 null。 */
export function normalizeSavedRun(value: unknown): SavedRun | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.runId !== 'string' || candidate.runId.length === 0) return null;
  if (!isBoardSnapshot(candidate.board)) return null;
  const board = candidate.board as GameRunState['board'];
  const score = clampInteger(candidate.score, 0, Number.MAX_SAFE_INTEGER, 0);
  const nextTileId = clampInteger(candidate.nextTileId, 1, Number.MAX_SAFE_INTEGER, 1);
  const savedAt = typeof candidate.savedAt === 'number' && Number.isFinite(candidate.savedAt)
    ? candidate.savedAt : Date.now();
  return {
    runId: candidate.runId,
    board,
    score,
    nextTileId,
    savedAt,
    undoRemaining: clampInteger(candidate.undoRemaining, 0, 99, 1),
    removeLowestRemaining: clampInteger(candidate.removeLowestRemaining, 0, 99, 1),
    undoRefillRemaining: clampInteger(candidate.undoRefillRemaining, 0, 1, 1),
    removeLowestRefillRemaining: clampInteger(candidate.removeLowestRefillRemaining, 0, 1, 1),
    reviveRemaining: clampInteger(candidate.reviveRemaining, 0, 1, 1) as 0 | 1,
    initialUndoItems: clampInteger(candidate.initialUndoItems, 0, 99, 0),
    initialRemoveLowestItems: clampInteger(candidate.initialRemoveLowestItems, 0, 99, 0),
    mode: candidate.mode === 'daily-challenge' ? 'daily-challenge' : 'classic',
    dailyChallengeCompleted: candidate.dailyChallengeCompleted === true,
    moves: clampInteger(candidate.moves, 0, Number.MAX_SAFE_INTEGER, 0),
    merges: clampInteger(candidate.merges, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

export class RunSessionStore {
  public constructor(private readonly storage: KeyValueStorage) {}

  public save(run: SavedRun): void {
    try {
      this.storage.setItem(RUN_SESSION_SAVE_KEY, JSON.stringify(run));
    } catch (error) {
      console.warn('[Cat2048] Failed to save run session.', error);
    }
  }

  public load(): SavedRun | null {
    try {
      const raw = this.storage.getItem(RUN_SESSION_SAVE_KEY);
      if (!raw) return null;
      return normalizeSavedRun(JSON.parse(raw) as unknown);
    } catch (error) {
      console.warn('[Cat2048] Run session data was invalid and has been ignored.', error);
      return null;
    }
  }

  public clear(): void {
    try {
      this.storage.setItem(RUN_SESSION_SAVE_KEY, '');
    } catch (error) {
      console.warn('[Cat2048] Failed to clear run session.', error);
    }
  }
}
