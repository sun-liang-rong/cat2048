import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const WECHAT_CODE_CLIENT = Symbol('WECHAT_CODE_CLIENT');

export interface WechatSession {
  readonly openid: string;
}

export interface WechatCodeClient {
  exchangeCode(code: string): Promise<WechatSession>;
}

interface WechatSessionResponse {
  readonly openid?: string;
  readonly errcode?: number;
  readonly errmsg?: string;
}

@Injectable()
export class WechatHttpClient implements WechatCodeClient {
  public constructor(private readonly config: ConfigService) {}

  public async exchangeCode(code: string): Promise<WechatSession> {
    const appId = this.config.get<string>('WECHAT_APP_ID');
    const appSecret = this.config.get<string>('WECHAT_APP_SECRET');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('WeChat credentials are not configured');
    }

    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    });
    let response: Response;
    try {
      response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`);
    } catch {
      throw new ServiceUnavailableException('WeChat login service is unavailable');
    }
    if (!response.ok) throw new ServiceUnavailableException('WeChat login service is unavailable');

    const body = await response.json() as WechatSessionResponse;
    if (!body.openid) {
      throw new UnauthorizedException(body.errmsg || 'WeChat login failed');
    }
    return { openid: body.openid };
  }
}
