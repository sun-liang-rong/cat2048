import { describe, expect, it, vi } from 'vitest';
import {
  configureWechatHomeShare,
  HOME_SHARE_MESSAGE,
} from '../assets/scripts/infrastructure/WechatShare';

describe('configureWechatHomeShare', () => {
  it('enables the menu and registers the home share message', () => {
    let callback: (() => typeof HOME_SHARE_MESSAGE) | undefined;
    const runtime = {
      wx: {
        showShareMenu: vi.fn(),
        onShareAppMessage: vi.fn((value: typeof callback) => { callback = value; }),
      },
    };

    expect(configureWechatHomeShare(runtime)).toBe(true);
    expect(runtime.wx.showShareMenu).toHaveBeenCalledWith({ withShareTicket: true });
    expect(runtime.wx.onShareAppMessage).toHaveBeenCalledOnce();
    expect(callback?.()).toEqual(HOME_SHARE_MESSAGE);
  });

  it('does nothing when WeChat sharing APIs are unavailable', () => {
    expect(configureWechatHomeShare({})).toBe(false);
  });

  it('reports API failures without breaking startup', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runtime = {
      wx: {
        showShareMenu: vi.fn(() => { throw new Error('not ready'); }),
        onShareAppMessage: vi.fn(),
      },
    };

    expect(configureWechatHomeShare(runtime)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
