import { describe, expect, it, vi } from 'vitest';
import { WechatRewardedVideoAd } from '../assets/scripts/infrastructure/WechatRewardedVideoAd';

function adRuntime() {
  let close: ((result?: { isEnded?: boolean }) => void) | undefined;
  let error: ((value: unknown) => void) | undefined;
  const ad = {
    show: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn((callback) => { close = callback; }),
    offClose: vi.fn(),
    onError: vi.fn((callback) => { error = callback; }),
    offError: vi.fn(),
  };
  return {
    ad,
    runtime: { wx: { createRewardedVideoAd: vi.fn(() => ad) } },
    close: (isEnded?: boolean) => close?.(isEnded === undefined ? undefined : { isEnded }),
    error: (value: unknown) => error?.(value),
  };
}

describe('WechatRewardedVideoAd', () => {
  it('initializes once and rewards only after a completed close callback', async () => {
    const mock = adRuntime();
    const service = new WechatRewardedVideoAd('adunit-test', mock.runtime);

    const result = service.show();
    expect(mock.runtime.wx.createRewardedVideoAd).toHaveBeenCalledOnce();
    expect(mock.runtime.wx.createRewardedVideoAd).toHaveBeenCalledWith({ adUnitId: 'adunit-test' });
    mock.close(true);

    await expect(result).resolves.toBe('completed');
  });

  it('does not reward when the user closes the video early', async () => {
    const mock = adRuntime();
    const service = new WechatRewardedVideoAd('adunit-test', mock.runtime);

    const result = service.show();
    mock.close(false);

    await expect(result).resolves.toBe('skipped');
  });

  it('loads and retries when the first show fails', async () => {
    const mock = adRuntime();
    mock.ad.show.mockRejectedValueOnce(new Error('not loaded')).mockResolvedValueOnce(undefined);
    const service = new WechatRewardedVideoAd('adunit-test', mock.runtime);

    const result = service.show();
    await vi.waitFor(() => expect(mock.ad.show).toHaveBeenCalledTimes(2));
    expect(mock.ad.load).toHaveBeenCalledOnce();
    mock.close(true);

    await expect(result).resolves.toBe('completed');
  });

  it('reports unsupported outside WeChat without granting a reward', async () => {
    const service = new WechatRewardedVideoAd('adunit-test', {});
    await expect(service.show()).resolves.toBe('unsupported');
  });
});
