/**
 * 微信小程序的 HTTP 传输与登录实现（LeaderboardClient 的平台适配层）。
 */
import { LeaderboardHttpError } from './errors';
import {
  type LeaderboardHttpRequest,
  type LeaderboardHttpTransport,
  type LeaderboardLoginProvider,
} from './types';

interface WechatRequestOptions {
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly data?: unknown;
  readonly header?: Record<string, string>;
  readonly timeout?: number;
  readonly success: (response: { statusCode: number; data: unknown }) => void;
  readonly fail: (error: unknown) => void;
}

export interface WechatRuntime {
  readonly wx?: {
    request(options: WechatRequestOptions): void;
    login(options: {
      success: (result: { code: string }) => void;
      fail: (error: unknown) => void;
    }): void;
  };
}

export class WechatHttpTransport implements LeaderboardHttpTransport {
  private static readonly REQUEST_TIMEOUT_MS = 10_000;

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
        timeout: WechatHttpTransport.REQUEST_TIMEOUT_MS,
        header: {
          'content-type': 'application/json',
          ...(request.headers ?? {}),
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

export class WechatLoginProvider implements LeaderboardLoginProvider {
  public constructor(private readonly runtime: WechatRuntime) {}

  public getLoginCode(): Promise<string> {
    const wx = this.runtime.wx;
    if (!wx?.login) return Promise.reject(new Error('WeChat login is unavailable'));
    return new Promise<string>((resolve, reject) => {
      wx.login({ success: (result) => resolve(result.code), fail: reject });
    });
  }
}
