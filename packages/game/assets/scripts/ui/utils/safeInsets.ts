/**
 * 微信安全区工具（从 Cat2048Boot 拆出）。
 */
import { capsuleBottomInset } from '../styles/layout';

/** 微信菜单胶囊下方的安全距离（读取失败时返回 0）。 */
export function wechatCapsuleInset(uiWidth: number): number {
  const runtime = globalThis as unknown as {
    wx?: {
      getSystemInfoSync?: () => { windowWidth?: number };
      getMenuButtonBoundingClientRect?: () => { bottom?: number };
    };
  };
  try {
    return capsuleBottomInset(uiWidth, runtime.wx?.getSystemInfoSync?.(),
      runtime.wx?.getMenuButtonBoundingClientRect?.());
  } catch (error) {
    console.warn('[Cat2048] Unable to read the WeChat menu capsule bounds.', error);
    return 0;
  }
}
