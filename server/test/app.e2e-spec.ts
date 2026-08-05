import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { WECHAT_CODE_CLIENT } from '../src/auth/wechat.client';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { LeaderboardRepository } from '../src/leaderboard/leaderboard.repository';
import { PlayersRepository } from '../src/players/players.repository';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cat2048 API', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp(): Promise<void> {
    const players = {
      upsertByOpenId: vi.fn().mockResolvedValue({
        id: 'player-1',
        nickname: null,
        avatarUrl: null,
        highScore: 1024,
      }),
      updateProfile: vi.fn(),
      findById: vi.fn(),
    };
    const leaderboard = {
      recordScore: vi.fn().mockResolvedValue({
        duplicate: false,
        accepted: true,
        highScore: 2048,
        highScoreAt: new Date(),
      }),
      getPlayerRank: vi.fn().mockResolvedValue(1),
      getLeaderboard: vi.fn().mockResolvedValue({
        entries: [{
          rank: 1,
          playerId: 'player-1',
          nickname: 'Tester',
          avatarUrl: null,
          score: 2048,
          achievedAt: new Date(),
        }],
        me: { rank: 1, score: 2048 },
      }),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]) })
      .overrideProvider(PlayersRepository)
      .useValue(players)
      .overrideProvider(WECHAT_CODE_CLIENT)
      .useValue({ exchangeCode: vi.fn().mockResolvedValue({ openid: 'openid-1' }) })
      .overrideProvider(LeaderboardRepository)
      .useValue(leaderboard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  }

  it('requires authentication for leaderboard reads and writes', async () => {
    await createApp();

    await request(app.getHttpServer())
      .get('/v1/leaderboard')
      .expect(401)
      .expect((response) => expect(response.body.error.code).toBe('UNAUTHORIZED'));
  });

  it('logs in and accesses the leaderboard with the issued token', async () => {
    await createApp();

    const login = await request(app.getHttpServer())
      .post('/v1/auth/wechat')
      .send({ code: 'code-1' })
      .expect(201);

    expect(login.body.data.expiresIn).toBe(604800);
    const token = login.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/v1/leaderboard/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ runId: 'run-1', score: 2048, highestLevel: 6 })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.rank).toBe(1);
        expect(response.body.data.accepted).toBe(true);
      });

    const leaderboardResponse = await request(app.getHttpServer())
      .get('/v1/leaderboard?limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(leaderboardResponse.status).toBe(200);
    expect(leaderboardResponse.body.data.entries).toHaveLength(1);
    expect(leaderboardResponse.body.data.me).toEqual({ rank: 1, score: 2048 });
  });

  it('rejects invalid score payloads before reaching the repository', async () => {
    await createApp();
    const login = await request(app.getHttpServer())
      .post('/v1/auth/wechat')
      .send({ code: 'code-1' });

    await request(app.getHttpServer())
      .post('/v1/leaderboard/scores')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ runId: 'run-1', score: -1, highestLevel: 6 })
      .expect(400)
      .expect((response) => expect(response.body.error.code).toBe('VALIDATION_ERROR'));
  });
});
