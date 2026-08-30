import { describe, expect, it, vi } from 'vitest';
import {
  LeaderboardClient,
  LeaderboardHttpError,
  LEADERBOARD_AUTH_KEY,
  PendingScoreQueue,
  highestLevelOfTiles,
  ownTrailingEntry,
  type LeaderboardHttpTransport,
  type LeaderboardLoginProvider,
  type StorageLike,
} from '../assets/scripts/features/leaderboard/leaderboard';

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
  it('reuses an in-flight startup login for the first authorized request', async () => {
    const storage = new MemoryStorage();
    const authResponse = {
      data: {
        accessToken: 'token-1',
        expiresIn: 604800,
        player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
      },
    } as const;
    let resolveAuth!: (response: typeof authResponse) => void;
    const pendingAuth = new Promise<typeof authResponse>((resolve) => {
      resolveAuth = resolve;
    });
    const transport: LeaderboardHttpTransport = {
      async request<TResponse>(request: { path: string }): Promise<TResponse> {
        if (request.path === '/v1/auth/wechat') {
          return pendingAuth as unknown as TResponse;
        }
        return { data: { entries: [], me: null } } as TResponse;
      },
    };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn().mockResolvedValue('code-1'),
    };
    const client = new LeaderboardClient(transport, login, storage);

    const startupAuthentication = client.ensureAuthenticated();
    const leaderboardRequest = client.getLeaderboard();
    resolveAuth(authResponse);

    await expect(startupAuthentication).resolves.toMatchObject({ id: 'player-1' });
    await expect(leaderboardRequest).resolves.toEqual({ entries: [], me: null });
    expect(login.getLoginCode).toHaveBeenCalledOnce();
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

  it('flushes pending scores before reading the leaderboard', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: 'token-1',
      player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
    }));
    storage.setItem('cat2048.leaderboard.queue.v1', JSON.stringify([
      { runId: 'run-1', score: 2048, highestLevel: 6 },
    ]));
    const request = vi.fn()
      .mockResolvedValueOnce({
        data: {
          runId: 'run-1',
          accepted: true,
          duplicate: false,
          highScore: 2048,
          rank: 1,
        },
      })
      .mockResolvedValueOnce({ data: { entries: [], me: null } });
    const transport: LeaderboardHttpTransport = { request };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn(),
    };
    const client = new LeaderboardClient(transport, login, storage);

    await expect(client.getLeaderboard()).resolves.toEqual({ entries: [], me: null });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      method: 'POST',
      path: '/v1/leaderboard/scores',
      body: { runId: 'run-1', score: 2048, highestLevel: 6 },
    });
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      method: 'GET',
      path: '/v1/leaderboard?limit=50',
    });
    expect(client.pendingScores()).toEqual([]);
  });

  it('flushes multiple pending scores through the batch endpoint', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: 'token-1',
      player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
    }));
    storage.setItem('cat2048.leaderboard.queue.v1', JSON.stringify([
      { runId: 'run-1', score: 1024, highestLevel: 5 },
      { runId: 'run-2', score: 2048, highestLevel: 6 },
    ]));
    const request = vi.fn().mockResolvedValueOnce({
      data: {
        results: [
          { runId: 'run-1', accepted: true, duplicate: false, highScore: 2048, rank: 1 },
          { runId: 'run-2', accepted: true, duplicate: false, highScore: 2048, rank: 1 },
        ],
      },
    });
    const transport: LeaderboardHttpTransport = { request };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn(),
    };
    const client = new LeaderboardClient(transport, login, storage);

    await expect(client.flushPendingScores()).resolves.toBe(2);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      method: 'POST',
      path: '/v1/leaderboard/scores/batch',
      body: {
        scores: [
          { runId: 'run-1', score: 1024, highestLevel: 5 },
          { runId: 'run-2', score: 2048, highestLevel: 6 },
        ],
      },
    });
    expect(client.pendingScores()).toEqual([]);
  });

  it('falls back to per-score submission when the batch endpoint rejects the payload', async () => {
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
        .mockRejectedValueOnce(new LeaderboardHttpError('batch rejected', 400))
        .mockRejectedValueOnce(new LeaderboardHttpError('invalid score', 400))
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

  it('keeps pending scores when the server errors during a batch flush', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEADERBOARD_AUTH_KEY, JSON.stringify({
      accessToken: 'token-1',
      player: { id: 'player-1', nickname: null, avatarUrl: null, highScore: 0 },
    }));
    storage.setItem('cat2048.leaderboard.queue.v1', JSON.stringify([
      { runId: 'run-1', score: 100, highestLevel: 2 },
      { runId: 'run-2', score: 200, highestLevel: 3 },
    ]));
    const transport: LeaderboardHttpTransport = {
      request: vi.fn()
        .mockRejectedValueOnce(new LeaderboardHttpError('server error', 500)),
    };
    const login: LeaderboardLoginProvider = {
      getLoginCode: vi.fn(),
    };
    const client = new LeaderboardClient(transport, login, storage);

    await expect(client.flushPendingScores()).resolves.toBe(0);
    expect(client.pendingScores()).toHaveLength(2);
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

describe('ownTrailingEntry', () => {
  const entries = [
    { rank: 1, playerId: 'p1', nickname: '甲', avatarUrl: null, score: 900, achievedAt: '2026-08-30T10:00:00Z' },
    { rank: 2, playerId: 'p2', nickname: '乙', avatarUrl: null, score: 800, achievedAt: '2026-08-30T10:00:00Z' },
  ];

  it('returns null when me is already inside the returned entries', () => {
    expect(ownTrailingEntry(entries, { rank: 2, score: 800 }, null)).toBeNull();
  });

  it('returns null when there is no me', () => {
    expect(ownTrailingEntry(entries, null, null)).toBeNull();
  });

  it('builds a trailing entry with the true global rank and profile', () => {
    const profile = { id: 'p9', nickname: '本尊', avatarUrl: 'https://wx.qlogo.cn/9.png', highScore: 300 };
    expect(ownTrailingEntry(entries, { rank: 87, score: 300 }, profile)).toEqual({
      rank: 87,
      playerId: 'p9',
      nickname: '本尊',
      avatarUrl: 'https://wx.qlogo.cn/9.png',
      score: 300,
      achievedAt: '',
    });
  });

  it('falls back to placeholder identity when the profile is missing', () => {
    const entry = ownTrailingEntry(entries, { rank: 51, score: 120 }, null);
    expect(entry).toEqual({
      rank: 51,
      playerId: 'me',
      nickname: '我',
      avatarUrl: null,
      score: 120,
      achievedAt: '',
    });
  });
});
