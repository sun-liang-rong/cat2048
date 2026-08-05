import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlayersRepository, type PlayerStore } from '../players/players.repository';
import type { PlayerSummary } from '../players/player.types';
import { WECHAT_CODE_CLIENT, type WechatCodeClient } from './wechat.client';

export interface TokenIssuer {
  sign(payload: object, options: { expiresIn: string }): string;
}

export interface AuthResult {
  readonly accessToken: string;
  readonly expiresIn: 604800;
  readonly player: PlayerSummary;
}

@Injectable()
export class WechatAuthService {
  public constructor(
    @Inject(PlayersRepository) private readonly players: PlayerStore,
    @Inject(WECHAT_CODE_CLIENT) private readonly wechat: WechatCodeClient,
    @Inject(JwtService) private readonly jwt: TokenIssuer,
  ) {}

  public async login(code: string): Promise<AuthResult> {
    if (!code.trim()) throw new BadRequestException('WeChat login code is required');
    const session = await this.wechat.exchangeCode(code);
    const player = await this.players.upsertByOpenId(session.openid);
    return {
      accessToken: this.jwt.sign({ sub: player.id }, { expiresIn: '7d' }),
      expiresIn: 604800,
      player,
    };
  }
}
