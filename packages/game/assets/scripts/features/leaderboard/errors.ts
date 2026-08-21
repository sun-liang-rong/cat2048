/**
 * 排行榜 HTTP 错误。
 */
export class LeaderboardHttpError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'LeaderboardHttpError';
  }
}
