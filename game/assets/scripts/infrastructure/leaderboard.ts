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
}

export interface LeaderboardHttpTransport {
  request<TResponse>(request: LeaderboardHttpRequest): Promise<TResponse>;
}

export interface LeaderboardLoginProvider {
  getLoginCode(): Promise<string>;
}

interface ApiEnvelope<T> {
  readonly data: T;
}

interface StoredSession {
  readonly accessToken: string;
  readonly player: PlayerSummary;
}

export const LEADERBOARD_AUTH_KEY = 'cat2048.leaderboard.auth.v1';
export const LEADERBOARD_QUEUE_KEY = 'cat2048.leaderboard.queue.v1';
const MAX_SCORE = 2147483647;

export function highestLevelOfTiles(tiles: readonly { readonly level: number }[]): number {
  return tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
}

export class LeaderboardHttpError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'LeaderboardHttpError';
  }
}

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

interface WechatRequestOptions {
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly data?: unknown;
  readonly header?: Record<string, string>;
  readonly success: (response: { statusCode: number; data: unknown }) => void;
  readonly fail: (error: unknown) => void;
}

interface WechatRuntime {
  readonly wx?: {
    request(options: WechatRequestOptions): void;
    login(options: {
      success: (result: { code: string }) => void;
      fail: (error: unknown) => void;
    }): void;
  };
}

class WechatHttpTransport implements LeaderboardHttpTransport {
  public constructor(private readonly baseUrl: string, private readonly runtime: WechatRuntime) {}

  public request<TResponse>(request: LeaderboardHttpRequest): Promise<TResponse> {
    const wx = this.runtime.wx;
    if (!this.baseUrl.trim() || !wx?.request) {
      return Promise.reject(new Error('Leaderboard API is not configured'));
    }
    return new Promise<TResponse>((resolve, reject) => {
      wx.request({
        url: `${this.baseUrl.replace(/\/$/, '')}${request.path}`,
        method: request.method,
        data: request.body,
        header: {
          'content-type': 'application/json',
          ...(request.token ? { Authorization: `Bearer ${request.token}` } : {}),
        },
        success: (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new LeaderboardHttpError(`Leaderboard request failed: ${response.statusCode}`, response.statusCode));
            return;
          }
          resolve(response.data as TResponse);
        },
        fail: reject,
      });
    });
  }
}

class WechatLoginProvider implements LeaderboardLoginProvider {
  public constructor(private readonly runtime: WechatRuntime) {}

  public getLoginCode(): Promise<string> {
    const wx = this.runtime.wx;
    if (!wx?.login) return Promise.reject(new Error('WeChat login is unavailable'));
    return new Promise<string>((resolve, reject) => {
      wx.login({ success: (result) => resolve(result.code), fail: reject });
    });
  }
}

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
