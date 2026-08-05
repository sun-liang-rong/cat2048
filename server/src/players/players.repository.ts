import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PlayerSummary } from './player.types';

const playerSummarySelect = {
  id: true,
  nickname: true,
  avatarUrl: true,
  highScore: true,
} as const;

export interface PlayerStore {
  upsertByOpenId(openid: string): Promise<PlayerSummary>;
}

@Injectable()
export class PlayersRepository implements PlayerStore {
  public constructor(private readonly prisma: PrismaService) {}

  public upsertByOpenId(openid: string): Promise<PlayerSummary> {
    return this.prisma.player.upsert({
      where: { openid },
      create: { openid },
      update: {},
      select: playerSummarySelect,
    });
  }

  public updateProfile(playerId: string, nickname?: string, avatarUrl?: string): Promise<PlayerSummary> {
    return this.prisma.player.update({
      where: { id: playerId },
      data: {
        ...(nickname !== undefined ? { nickname } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
      select: playerSummarySelect,
    });
  }

  public findById(playerId: string): Promise<PlayerSummary | null> {
    return this.prisma.player.findUnique({
      where: { id: playerId },
      select: playerSummarySelect,
    });
  }
}
