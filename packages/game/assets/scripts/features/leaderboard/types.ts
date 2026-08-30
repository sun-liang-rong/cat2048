/**
 * 排行榜模块类型定义（纯类型与存储键常量）。
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ScorePayload {
  readonly runId: string;
  readonly score: number;
  readonly highestLevel: number;
}

export interface PlayerSummary {
  readonly id: string;
  readonly nickname: string | null;
  readonly avatarUrl: string | null;
  readonly highScore: number;
}

export interface AuthResponse {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly player: PlayerSummary;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly nickname: string | null;
  readonly avatarUrl: string | null;
  readonly score: number;
  readonly achievedAt: string;
}

export interface LeaderboardResponse {
  readonly entries: readonly LeaderboardEntry[];
  readonly me: {
    readonly rank: number;
    readonly score: number;
  } | null;
}

export interface ScoreSubmissionResponse {
  readonly runId: string;
  readonly score: number;
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly highScore: number;
  readonly rank: number | null;
}

export interface LeaderboardHttpRequest {
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly body?: unknown;
  readonly token?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface LeaderboardHttpTransport {
  request<TResponse>(request: LeaderboardHttpRequest): Promise<TResponse>;
}

export interface LeaderboardLoginProvider {
  getLoginCode(): Promise<string>;
}

export const LEADERBOARD_AUTH_KEY = 'cat2048.leaderboard.auth.v1';
export const LEADERBOARD_QUEUE_KEY = 'cat2048.leaderboard.queue.v1';
