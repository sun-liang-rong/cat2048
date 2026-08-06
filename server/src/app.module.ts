import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { resolveServerEnvFilePath } from './config/env-file-path';

const envFilePath = resolveServerEnvFilePath(__dirname, process.cwd());

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ...(envFilePath ? { envFilePath } : {}),
    }),
    ThrottlerModule.forRoot([{ name: 'default', limit: 60, ttl: 60_000 }]),
    PrismaModule,
    PlayersModule,
    AuthModule,
    LeaderboardModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
