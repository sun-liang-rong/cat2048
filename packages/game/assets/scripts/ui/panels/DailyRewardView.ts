import { Color, Node } from 'cc';
import type { EconomySnapshot } from '../../features/economy/economy';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView } from './ModalView';
import {
  COLORS,
  createButton,
  createLabel,
  createSpriteNode,
} from '../utils/uiFactory';

export interface DailyRewardViewActions {
  readonly onClaim: () => void;
  readonly onClose: () => void;
}

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 560;

export class DailyRewardView {
  private readonly modal: ModalView;
  private readonly art: ArtRepository;

  public constructor(art: ArtRepository) {
    this.art = art;
    this.modal = new ModalView(art, () => ({ width: 0, height: 0 }));
  }

  public show(parent: Node, model: EconomySnapshot, width: number, height: number,
    actions: DailyRewardViewActions): Node {
    const { overlay, panel } = this.modal.open(parent, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      overlayWidth: width,
      overlayHeight: height,
      title: '每日奖励',
      onClose: actions.onClose,
    });

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
      290, 74, model.canClaimDaily ? COLORS.coral : COLORS.disabledSurface,
      () => { if (model.canClaimDaily) actions.onClaim(); }, 27, coinFrame);
    claim.setPosition(0, -155);
    panel.addChild(claim);

    return overlay;
  }
}
