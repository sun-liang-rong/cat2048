import { describe, expect, it, vi } from 'vitest';
import {
  createWechatLeaderboardClient,
  LeaderboardClient,
  LeaderboardHttpError,
  LEADERBOARD_AUTH_KEY,
  PendingScoreQueue,
  highestLevelOfTiles,
  type LeaderboardHttpTransport,
  type LeaderboardLoginProvider,
  type StorageLike,
} from '../assets/scripts/infrastructure/leaderboard';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('PendingScoreQueue', () => {
  it('deduplicates runs and persists them in insertion order', () => {
    const storage = new MemoryStorage();
    const queue = new PendingScoreQueue(storage);
    const score = { runId: 'run-1', score: 1024, highestLevel: 5 } as const;

    queue.enqueue(score);
    queue.enqueue(score);
    queue.enqueue({ runId: 'run-2', score: 2048, highestLevel: 6 });

    expect(queue.list()).toEqual([score, { runId: 'run-2', score: 2048, highestLevel: 6 }]);
  });

  it('drops persisted payloads outside the server score contract', () => {
    const storage = new MemoryStorage();
    storage.setItem('cat2048.leaderboard.queue.v1', JSON.stringify([
      { runId: 'run-1', score: 2147483648, highestLevel: 12 },
      { runId: '  ', score: 100, highestLevel: 2 },
    ]));
    const queue = new PendingScoreQueue(storage);

    expect(queue.list()).toEqual([]);
  });
});

describe('highestLevelOfTiles', () => {
  it('returns the highest tile level and defaults to level one for an empty board', () => {
    expect(highestLevelOfTiles([])).toBe(1);
    expect(highestLevelOfTiles([{ level: 2 }, { level: 7 }, { level: 4 }])).toBe(7);
  });
});

describe('LeaderboardClient', () => {
  it('syncs the WeChat game profile through getUserInfo when getUserProfile is unavailable', async () => {
    const storage = new MemoryStorage();
    const requests: Array<{ url: string; method: string; data: unknown }> = [];
    const runtime = {
      wx: {
        login: ({ success }: { success: (result: { code: string }) => void }) => {
          success({ code: 'code-1' });
        },
        getUserInfo: ({
          success,
        }: {
          success: (result: { userInfo: { nickName: string; avatarUrl: string } }) => void;
        }) => {
          success({
            userInfo: { nickName: '猫咪玩家', avatarUrl: 'https://example.com/avatar.png' },
          });
        },
        request: (options: {
          url: string;
          method: string;
          data?: unknown;
          success: (response: { statusCode: number; data: unknown }) => void;
        }) => {
          requests.push({ url: options.url, method: options.method, data: options.data });
          if (options.url.endsWith('/v1/auth/wechat')) {
            options.success({
              statusCode: 200,
              data: {
                data: {
                  accessToken: 'token-1',
                  expiresIn: 604800,
                  player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
                },
              },
            });
            return;
          }
          options.success({
            statusCode: 200,
            data: {
              data: {
                player: {
                  id: 'player-1',
                  nickname: '猫咪玩家',
                  avatarUrl: 'https://example.com/avatar.png',
                  highScore: 0,
                },
              },
            },
          });
        },
      },
    };
    const client = createWechatLeaderboardClient('http://127.0.0.1:3000', storage, runtime);

    await expect(client.syncAuthorizedProfile()).resolves.toMatchObject({
      nickname: '猫咪玩家',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'POST http://127.0.0.1:3000/v1/auth/wechat',
      'PATCH http://127.0.0.1:3000/v1/players/me/profile',
    ]);
    expect(requests[1]?.data).toEqual({
      nickname: '猫咪玩家',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('keeps a failed score for a later flush and removes it after success', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: 'token-1',
      player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
    }));
    const transport: LeaderboardHttpTransport = {
      request: vi.fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({
          data: {
            runId: 'run-1',
            accepted: true,
            duplicate: false,
            highScore: 1024,
            rank: 1,
          },
        }),
    };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn().mockResolvedValue('code-1'),
    };
    const client = new LeaderboardClient(transport, login, storage);
    const score = { runId: 'run-1', score: 1024, highestLevel: 5 } as const;

    await expect(client.submitScore(score)).rejects.toThrow('offline');
    expect(client.pendingScores()).toEqual([score]);

    await expect(client.flushPendingScores()).resolves.toBe(1);
    expect(client.pendingScores()).toEqual([]);
  });

  it('drops permanently rejected scores and continues flushing later runs', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: 'token-1',
      player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
    }));
    storage.setItem('cat2048.leaderboard.queue.v1', JSON.stringify([
      { runId: 'run-invalid', score: 100, highestLevel: 2 },
      { runId: 'run-valid', score: 200, highestLevel: 3 },
    ]));
    const transport: LeaderboardHttpTransport = {
      request: vi.fn()
        .mockRejectedValueOnce(new LeaderboardHttpError('invalid', 400))
        .mockResolvedValueOnce({
          data: {
            runId: 'run-valid',
            accepted: true,
            duplicate: false,
            highScore: 200,
            rank: 1,
          },
        }),
    };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn(),
    };
    const client = new LeaderboardClient(transport, login, storage);

    await expect(client.flushPendingScores()).resolves.toBe(1);
    expect(client.pendingScores()).toEqual([]);
  });

  it('re-authenticates once when the stored token expires', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: 'expired-token',
      player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
    }));
    const transport: LeaderboardHttpTransport = {
      request: vi.fn()
        .mockRejectedValueOnce(new LeaderboardHttpError('expired', 401))
        .mockResolvedValueOnce({
          data: {
            accessToken: 'fresh-token',
            expiresIn: 604800,
            player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
          },
        })
        .mockResolvedValueOnce({ data: { entries: [], me: null } }),
    };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn().mockResolvedValue('code-1'),
    };
    const client = new LeaderboardClient(transport, login, storage);

    await expect(client.getLeaderboard()).resolves.toEqual({ entries: [], me: null });
    expect(login.getLoginCode).toHaveBeenCalledOnce();
  });
});
