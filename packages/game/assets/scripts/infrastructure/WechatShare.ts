export interface HomeShareMessage {
  readonly title: string;
  readonly query: string;
}

export interface WechatShareRuntime {
  readonly wx?: {
    showShareMenu?: (options?: { readonly withShareTicket?: boolean }) => void;
    onShareAppMessage?: (callback: () => HomeShareMessage) => void;
  };
}

export const HOME_SHARE_MESSAGE: HomeShareMessage = {
  title: '猫咪2048，合成你的专属猫咪！',
  query: 'from=home_share',
};

/** Enables the native WeChat menu share entry when the game runs in WeChat. */
export function configureWechatHomeShare(
  runtime: WechatShareRuntime = globalThis as WechatShareRuntime,
): boolean {
  const wx = runtime.wx;
  if (!wx || typeof wx.showShareMenu !== 'function' || typeof wx.onShareAppMessage !== 'function') {
    return false;
  }

  try {
    wx.showShareMenu({ withShareTicket: true });
    wx.onShareAppMessage(() => ({ ...HOME_SHARE_MESSAGE }));
    return true;
  } catch (error) {
    console.warn('[Cat2048] Unable to configure WeChat home sharing.', error);
    return false;
  }
}
