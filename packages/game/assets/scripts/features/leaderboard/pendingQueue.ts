/**
 * 待提交成绩的本地队列（离线时排队，联网后补交）。
 */
import { LEADERBOARD_QUEUE_KEY, type ScorePayload, type StorageLike } from './types';

const MAX_SCORE = 2147483647;

export class PendingScoreQueue {
  public constructor(
    private readonly storage: StorageLike,
    private readonly key = LEADERBOARD_QUEUE_KEY,
  ) {}

  public list(): readonly ScorePayload[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is ScorePayload => this.isScorePayload(value));
    } catch {
      return [];
    }
  }

  public enqueue(payload: ScorePayload): void {
    if (!this.isScorePayload(payload)) return;
    if (this.list().some((item) => item.runId === payload.runId)) return;
    this.persist([...this.list(), payload]);
  }

  public remove(runId: string): void {
    this.persist(this.list().filter((item) => item.runId !== runId));
  }

  private persist(values: readonly ScorePayload[]): void {
    this.storage.setItem(this.key, JSON.stringify(values));
  }

  private isScorePayload(value: unknown): value is ScorePayload {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.runId === 'string'
      && candidate.runId.trim().length > 0
      && candidate.runId.length <= 64
      && typeof candidate.score === 'number'
      && Number.isSafeInteger(candidate.score)
      && candidate.score >= 0
      && candidate.score <= MAX_SCORE
      && typeof candidate.highestLevel === 'number'
      && Number.isInteger(candidate.highestLevel)
      && candidate.highestLevel >= 1
      && candidate.highestLevel <= 12;
  }
}
