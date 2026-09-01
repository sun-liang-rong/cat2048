export type RewardedVideoResult = 'completed' | 'skipped' | 'unsupported' | 'failed';

interface RewardedVideoCloseResult {
  readonly isEnded?: boolean;
}

interface RewardedVideoAdInstance {
  show(): Promise<void>;
  load(): Promise<void>;
  onClose(callback: (result?: RewardedVideoCloseResult) => void): void;
  offClose?(callback: (result?: RewardedVideoCloseResult) => void): void;
  onError?(callback: (error: unknown) => void): void;
  offError?(callback: (error: unknown) => void): void;
}

export interface RewardedVideoRuntime {
  readonly wx?: {
    createRewardedVideoAd(options: { readonly adUnitId: string }): RewardedVideoAdInstance;
  };
}

export interface RewardedVideoAdService {
  show(): Promise<RewardedVideoResult>;
  destroy(): void;
}

/** 微信激励视频单例。只有完整观看的关闭回调才返回 completed。 */
export class WechatRewardedVideoAd implements RewardedVideoAdService {
  private readonly ad: RewardedVideoAdInstance | null;
  private pending: Promise<RewardedVideoResult> | null = null;
  private settlePending: ((result: RewardedVideoResult) => void) | null = null;

  public constructor(
    adUnitId: string,
    runtime: RewardedVideoRuntime = globalThis as RewardedVideoRuntime,
  ) {
    try {
      this.ad = runtime.wx?.createRewardedVideoAd({ adUnitId }) ?? null;
      this.ad?.onClose(this.onClose);
      this.ad?.onError?.(this.onError);
    } catch (error) {
      console.warn('[Cat2048] Failed to initialize rewarded video ad.', error);
      this.ad = null;
    }
  }

  public show(): Promise<RewardedVideoResult> {
    if (!this.ad) return Promise.resolve('unsupported');
    if (this.pending) return this.pending;

    this.pending = new Promise<RewardedVideoResult>((resolve) => {
      this.settlePending = resolve;
      void this.showWithRetry();
    });
    return this.pending;
  }

  public destroy(): void {
    this.ad?.offClose?.(this.onClose);
    this.ad?.offError?.(this.onError);
    this.finish('failed');
  }

  private async showWithRetry(): Promise<void> {
    if (!this.ad) return this.finish('unsupported');
    try {
      await this.ad.show();
    } catch {
      try {
        await this.ad.load();
        await this.ad.show();
      } catch (error) {
        console.error('[Cat2048] Rewarded video ad failed to show.', error);
        this.finish('failed');
      }
    }
  }

  private readonly onClose = (result?: RewardedVideoCloseResult): void => {
    // 无法确认完整观看时按未完成处理，避免提前关闭也发放道具。
    this.finish(result?.isEnded === true ? 'completed' : 'skipped');
  };

  private readonly onError = (error: unknown): void => {
    if (!this.pending) return;
    console.error('[Cat2048] Rewarded video ad error.', error);
    this.finish('failed');
  };

  private finish(result: RewardedVideoResult): void {
    const resolve = this.settlePending;
    this.settlePending = null;
    this.pending = null;
    resolve?.(result);
  }
}
