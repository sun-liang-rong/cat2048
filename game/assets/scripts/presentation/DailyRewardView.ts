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

    const panel = createUiNode('DailyRewardPanel', 540, 520);
    drawRounded(panel, 540, 520, COLORS.ivory, 34, { color: COLORS.ink, width: 5 });
    overlay.addChild(panel);

    const close = createIconButton('DailyRewardClose', this.art.frame(GAME_CONFIG.art.close), '\u00d7', 60,
      actions.onClose);
    close.setPosition(232, 222);
    panel.addChild(close);

    const title = createLabel('\u6bcf\u65e5\u5956\u52b1', 42, COLORS.coral, 400, 64, 'display');
    title.node.setPosition(0, 176);
    panel.addChild(title.node);

    const coinFrame = this.art.frame(GAME_CONFIG.art.coin);
    if (coinFrame) {
      const coin = createSpriteNode('DailyRewardCoin', coinFrame, 130, 130);
      coin.setPosition(0, 61);
      panel.addChild(coin);
    }

    const streak = createLabel(`\u8fde\u7eed\u7b2c ${Math.max(1, model.dailyStreak + 1)} \u5929`, 24,
      COLORS.teal, 300, 42, 'display');
    streak.node.setPosition(0, -42);
    panel.addChild(streak.node);
    const amount = createLabel(`+${model.dailyReward} \u91d1\u5e01`, 30, COLORS.ink, 320, 48, 'display');
    amount.node.setPosition(0, -91);
    panel.addChild(amount.node);

    const claim = createButton(model.canClaimDaily ? '\u7acb\u5373\u9886\u53d6' : '\u660e\u65e5 00:00 \u53ef\u9886\u53d6',
      290, 74, model.canClaimDaily ? COLORS.coral : new Color(157, 148, 135, 210),
      () => { if (model.canClaimDaily) actions.onClaim(); }, 27, coinFrame);
    claim.setPosition(0, -175);
    panel.addChild(claim);

    panel.setScale(0.82, 0.82, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    return overlay;
  }
}
