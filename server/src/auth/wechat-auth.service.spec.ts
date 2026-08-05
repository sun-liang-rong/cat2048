import { describe, expect, it, vi } from 'vitest';
import { WechatAuthService } from './wechat-auth.service';

describe('WechatAuthService', () => {
  it('exchanges a login code, upserts the player, and issues a token', async () => {
    const players = {
      upsertByOpenId: vi.fn().mockResolvedValue({
        id: 'player-1',
        nickname: null,
        avatarUrl: null,
        highScore: 0,
      }),
    };
    const wechat = {
      exchangeCode: vi.fn().mockResolvedValue({ openid: 'openid-1' }),
    };
    const jwt = { sign: vi.fn().mockReturnValue('token-1') };
    const service = new WechatAuthService(players, wechat, jwt);

    await expect(service.login('code-1')).resolves.toEqual({
      accessToken: 'token-1',
      expiresIn: 604800,
      player: {
        id: 'player-1',
        nickname: null,
        avatarUrl: null,
        highScore: 0,
      },
    });
    expect(players.upsertByOpenId).toHaveBeenCalledWith('openid-1');
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'player-1' }, { expiresIn: '7d' });
  });
});
