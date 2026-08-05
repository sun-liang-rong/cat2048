import { Injectable, NotFoundException } from '@nestjs/common';
import { PlayersRepository } from './players.repository';

@Injectable()
export class PlayersService {
  public constructor(private readonly players: PlayersRepository) {}

  public async updateProfile(playerId: string, nickname?: string, avatarUrl?: string) {
    try {
      return await this.players.updateProfile(playerId, nickname, avatarUrl);
    } catch (error) {
      if (this.isNotFoundError(error)) throw new NotFoundException('Player not found');
      throw error;
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'P2025';
  }
}
