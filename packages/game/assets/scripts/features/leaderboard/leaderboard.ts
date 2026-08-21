/**
 * 排行榜业务客户端（模块入口）。
 *
 * 公开 API 统一从这里 re-export，保持导入面稳定：
 * - 类型与常量：./types
 * - HTTP 错误：./errors
 * - 待提交队列：./pendingQueue
 * - 微信平台实现：./wechatTransport
 */
import { PendingScoreQueue } from './pendingQueue';
import { LeaderboardHttpError } from './errors';
import {
  WechatHttpTransport,
  WechatLoginProvider,
  type WechatRuntime,
} from './wechatTransport';
import {
  LEADERBOARD_AUTH_KEY,
  type PlayerSummary,
  type ScorePayload,
  type ScoreSubmissionResponse,
  type AuthResponse,
  type LeaderboardResponse,
  type LeaderboardHttpRequest,
  type LeaderboardHttpTransport,
  type LeaderboardLoginProvider,
  type StorageLike,
} from './types';

export * from './types';
export * from './errors';
export * from './pendingQueue';
export { WechatHttpTransport, WechatLoginProvider } from './wechatTransport';
export type { WechatRuntime } from './wechatTransport';

/** 创建使用微信运行时能力的排行榜客户端。 */
export function createWechatLeaderboardClient(
  baseUrl: string,
  storage: StorageLike,
  runtime: WechatRuntime = globalThis as unknown as WechatRuntime,
): LeaderboardClient {
  return new LeaderboardClient(
    new WechatHttpTransport(baseUrl, runtime),
    new WechatLoginProvider(runtime),
    storage,
  );
}

interface ApiEnvelope<T> {
  readonly data: T;
}

interface StoredSession {
  readonly accessToken: string;
  readonly player: PlayerSummary;
}

/** 棋盘上最高猫咪等级（空盘按 1 计算）。 */
export function highestLevelOfTiles(tiles: readonly { readonly level: number }[]): number {
  return tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
}

export class LeaderboardClient {
  private readonly queue: PendingScoreQueue;
  private accessToken: string | null = null;
  private player: PlayerSummary | null = null;
  private loginInFlight: Promise<PlayerSummary> | null = null;
  private flushInFlight: Promise<number> | null = null;

  public constructor(
    private readonly transport: LeaderboardHttpTransport,
    private readonly loginProvider: LeaderboardLoginProvider,
    private readonly storage: StorageLike,
  ) {
    this.queue = new PendingScoreQueue(this.storage);
    this.loadSession(this.storage);
  }

  public pendingScores(): readonly ScorePayload[] {
    return this.queue.list();
  }

  public currentPlayer(): PlayerSummary | null {
    return this.player;
  }

  public ensureAuthenticated(): Promise<PlayerSummary> {
    if (this.accessToken && this.player) return Promise.resolve(this.player);
    if (this.loginInFlight) return this.loginInFlight;
    const loginPromise = this.login().then(
      (player) => {
        this.loginInFlight = null;
        return player;
      },
      (error) => {
        this.loginInFlight = null;
        throw error;
      },
    );
    this.loginInFlight = loginPromise;
    return loginPromise;
  }

  public async login(): Promise<PlayerSummary> {
    const code = await this.loginProvider.getLoginCode();
    const response = await this.transport.request<ApiEnvelope<AuthResponse>>({
      method: 'POST',
      path: '/v1/auth/wechat',
      body: { code },
    });
    this.accessToken = response.data.accessToken;
    this.player = response.data.player;
    this.persistSession();
    return response.data.player;
  }

  public async submitScore(payload: ScorePayload): Promise<ScoreSubmissionResponse> {
    this.queue.enqueue(payload);
    const response = await this.sendScore(payload);
    this.queue.remove(payload.runId);
    return response;
  }

  public flushPendingScores(): Promise<number> {
    if (this.flushInFlight) return this.flushInFlight;
    const flush = this.drainPendingScores().finally(() => {
      if (this.flushInFlight === flush) this.flushInFlight = null;
    });
    this.flushInFlight = flush;
    return flush;
  }

  private async drainPendingScores(): Promise<number> {
    let flushed = 0;
    for (const payload of this.queue.list()) {
      try {
        await this.sendScore(payload);
        this.queue.remove(payload.runId);
        flushed += 1;
      } catch (error) {
        if (error instanceof LeaderboardHttpError
          && error.status >= 400
          && error.status < 500
          && error.status !== 401) {
          this.queue.remove(payload.runId);
          continue;
        }
        break;
      }
    }
    return flushed;
  }

  public async getLeaderboard(limit = 50): Promise<LeaderboardResponse> {
    await this.flushPendingScores();
    const response = await this.authorizedRequest<ApiEnvelope<LeaderboardResponse>>({
      method: 'GET',
      path: `/v1/leaderboard?limit=${Math.max(1, Math.min(100, Math.floor(limit)))}`,
    });
    return response.data;
  }

  private async sendScore(payload: ScorePayload): Promise<ScoreSubmissionResponse> {
    const response = await this.authorizedRequest<ApiEnvelope<ScoreSubmissionResponse>>({
      method: 'POST',
      path: '/v1/leaderboard/scores',
      body: payload,
    });
    return response.data;
  }

  private async authorizedRequest<TResponse>(request: LeaderboardHttpRequest, retry = true): Promise<TResponse> {
    await this.ensureAccessToken();
    try {
      return await this.transport.request<TResponse>({ ...request, token: this.accessToken ?? undefined });
    } catch (error) {
      if (!retry || !(error instanceof LeaderboardHttpError) || error.status !== 401) throw error;
      this.clearSession();
      await this.ensureAuthenticated();
      return this.authorizedRequest<TResponse>(request, false);
    }
  }

  private async ensureAccessToken(): Promise<void> {
    if (!this.accessToken) await this.ensureAuthenticated();
  }

  private loadSession(storage: StorageLike): void {
    const raw = storage.getItem(LEADERBOARD_AUTH_KEY);
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as StoredSession;
      if (typeof session.accessToken === 'string' && session.player?.id) {
        this.accessToken = session.accessToken;
        this.player = session.player;
      }
    } catch {
      this.clearSession(storage);
    }
  }

  private persistSession(): void {
    if (!this.player || !this.accessToken) return;
    this.storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: this.accessToken,
      player: this.player,
    } satisfies StoredSession));
  }

  private clearSession(storage = this.storage): void {
    this.accessToken = null;
    this.player = null;
    storage.setItem(LEADERBOARD_AUTH_KEY, '');
  }
}
