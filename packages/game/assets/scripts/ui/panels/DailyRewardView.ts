import { Color, Node, Sprite } from 'cc';
import type { EconomySnapshot } from '../../features/economy/economy';
import { calculateDailyReward } from '../../features/economy/economy';
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

const TEXT_GOLD = new Color(202, 124, 44, 255);

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
      const coin = createSpriteNode('DailyRewardCoin', coinFrame, 120, 120);
      coin.setPosition(0, 105);
      if (!model.canClaimDaily) {
        // 今日已领：金币褪色表示"奖励已入袋"
        const coinSprite = coin.getComponent(Sprite);
        if (coinSprite) coinSprite.color = new Color(198, 194, 186, 255);
      }
      panel.addChild(coin);
    }

    const amount = createLabel(`+${model.dailyReward} 金币`, 36, TEXT_GOLD, 320, 54, 'display');
    amount.node.setPosition(0, -10);
    panel.addChild(amount.node);

    const streakText = model.canClaimDaily
      ? `连续第 ${Math.max(1, model.dailyStreak + 1)} 天`
      : `已连续 ${model.dailyStreak} 天 · 明日 +${calculateDailyReward(model.dailyStreak)}`;
    const streak = createLabel(streakText, 22, COLORS.teal, 420, 40, 'display');
    streak.node.setPosition(0, -58);
    panel.addChild(streak.node);

    const claim = createButton(model.canClaimDaily ? '立即领取' : '明日 00:00 可领取',
      300, 76, model.canClaimDaily ? COLORS.coral : COLORS.disabledSurface,
      () => { if (model.canClaimDaily) actions.onClaim(); }, 27);
    claim.setPosition(0, -140);
    panel.addChild(claim);

    return overlay;
  }
}
