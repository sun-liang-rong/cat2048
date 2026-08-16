import { BlockInputEvents, Color, Graphics, Node, Vec3, tween } from 'cc';
import type { EconomySnapshot } from '../economy/economy';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from './uiFactory';

export interface DailyRewardViewActions {
  readonly onClaim: () => void;
  readonly onClose: () => void;
}

export class DailyRewardView {
  public constructor(private readonly art: ArtRepository) {}

  public show(parent: Node, model: EconomySnapshot, width: number, height: number,
    actions: DailyRewardViewActions): Node {
    const overlay = createUiNode('DailyRewardOverlay', width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();
    parent.addChild(overlay);

    const panel = createUiNode('DailyRewardPanel', 540, 560);
    drawRounded(panel, 540, 560, COLORS.ivory, 34, { color: COLORS.ink, width: 5 });
    overlay.addChild(panel);

    const close = createIconButton('DailyRewardClose', this.art.frame(GAME_CONFIG.art.close), '×', 60,
      actions.onClose);
    close.setPosition(232, 242);
    panel.addChild(close);

    const title = createLabel('每日奖励', 42, COLORS.coral, 400, 64, 'display');
    title.node.setPosition(0, 210);
    panel.addChild(title.node);

    const coinFrame = this.art.frame(GAME_CONFIG.art.coin);
    if (coinFrame) {
      const coin = createSpriteNode('DailyRewardCoin', coinFrame, 130, 130);
      coin.setPosition(0, 95);
      panel.addChild(coin);
    }

    const streak = createLabel(`连续第 ${Math.max(1, model.dailyStreak + 1)} 天`, 24,
      COLORS.teal, 300, 42, 'display');
    streak.node.setPosition(0, -5);
    panel.addChild(streak.node);
    const amount = createLabel(`+${model.dailyReward} 金币`, 30, COLORS.ink, 320, 48, 'display');
    amount.node.setPosition(0, -55);
    panel.addChild(amount.node);
    const bonus = createLabel('附赠：撤回 ×1  ·  消除 ×1', 20, COLORS.coral, 400, 36, 'display');
    bonus.node.setPosition(0, -105);
    panel.addChild(bonus.node);

    const claim = createButton(model.canClaimDaily ? '立即领取' : '明日 00:00 可领取',
      290, 74, model.canClaimDaily ? COLORS.coral : new Color(157, 148, 135, 210),
      () => { if (model.canClaimDaily) actions.onClaim(); }, 27, coinFrame);
    claim.setPosition(0, -165);
    panel.addChild(claim);

    panel.setScale(0.82, 0.82, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    return overlay;
  }
}
