type VibrationStrength = 'light' | 'medium' | 'heavy';

interface WeChatVibrationApi {
  vibrateShort?(options?: { readonly type?: VibrationStrength }): void;
}

interface BrowserVibrationApi {
  vibrate?(pattern: number | readonly number[]): boolean;
}

export interface HapticRuntime {
  readonly wx?: WeChatVibrationApi;
  readonly navigator?: BrowserVibrationApi;
}

export class HapticController {
  public enabled = true;

  public constructor(private readonly runtime: HapticRuntime = globalThis as HapticRuntime) {}

  public light(): void {
    if (!this.enabled) return;
    try {
      if (typeof this.runtime.wx?.vibrateShort === 'function') {
        this.runtime.wx.vibrateShort({ type: 'light' });
        return;
      }

      const navigator = this.runtime.navigator;
      if (typeof navigator?.vibrate === 'function') navigator.vibrate.call(navigator, 15);
    } catch (error) {
      console.warn('[Cat2048] Unable to trigger haptic feedback.', error);
    }
  }
}
