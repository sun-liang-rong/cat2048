import { Node, tween, UIOpacity, Vec3 } from 'cc';

export function tweenPosition(node: Node, position: Vec3, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    tween(node).to(seconds, { position }, { easing: 'quadOut' }).call(() => resolve()).start();
  });
}

export function tweenScale(node: Node, scale: Vec3, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    tween(node).to(seconds, { scale }, { easing: 'backOut' }).call(() => resolve()).start();
  });
}

export function tweenOpacity(node: Node, opacity: number, seconds: number): Promise<void> {
  const target = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
  return new Promise((resolve) => {
    tween(target).to(seconds, { opacity }).call(() => resolve()).start();
  });
}

/** 基于引擎 tween 的延迟，随 director 暂停而暂停（不同于 setTimeout）。 */
export function tweenDelay(node: Node, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    tween(node).delay(seconds).call(() => resolve()).start();
  });
}
