import { Node } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView } from './ModalView';
import {
  COLORS,
  createButton,
  createLabel,
  createPillButton,
} from '../utils/uiFactory';

export interface GameOverDialogModel {
  readonly score: number;
  readonly bestScore: number;
  readonly runReward: number;
  readonly runRewardFailed: boolean;
  readonly coins: number;
  readonly canRevive: boolean;
  readonly canUndoRescue: boolean;
  readonly canRemoveLowestRescue: boolean;
  readonly undoRescueCount: number;
  readonly removeLowestRescueCount: number;
  readonly isNewRecord: boolean;
  readonly highestLevel: number;
  readonly moves: number;
  readonly merges: number;
  readonly dailyChallenge?: {
    readonly targetLevel: number;
    readonly completed: boolean;
  };
  readonly uiWidth: number;
  readonly uiHeight: number;
}

export interface GameOverDialogActions {
  /** 关闭右上角关闭按钮后触发。 */
  readonly onClose?: () => void;
  readonly onHome: () => void;
  readonly onReplay: () => void;
  readonly onShareScore: () => void;
  readonly onRevive: () => void;
  readonly onUndoRescue: () => void;
  readonly onRemoveLowestRescue: () => void;
}

const PANEL_WIDTH = 590;
const PANEL_HEIGHT = 540;
const PANEL_HEIGHT_ACTION = 650;
const REFERENCE_HEIGHT = 620;

export class GameOverDialogView {
  private readonly modal: ModalView;
  private readonly art: ArtRepository;

  public constructor(art: ArtRepository) {
    this.art = art;
    this.modal = new ModalView(art, () => ({ width: 0, height: 0 }));
  }

  public show(parent: Node, model: GameOverDialogModel, actions: GameOverDialogActions): Node {
    const hasRescue = model.canUndoRescue || model.canRemoveLowestRescue;
    const hasAction = hasRescue || model.canRevive;
    const panelHeight = hasAction ? PANEL_HEIGHT_ACTION : PANEL_HEIGHT;
    const { overlay, panel } = this.modal.open(parent, {
      width: PANEL_WIDTH,
      height: panelHeight,
      overlayWidth: model.uiWidth,
      overlayHeight: model.uiHeight,
      title: '猫咪挤满啦',
      titleSize: 46,
      onClose: actions.onClose,
    });

    const titleY = 232 * (panelHeight / REFERENCE_HEIGHT);

    const scoreText = model.isNewRecord
      ? `本局得分  ${model.score}\n最高分  ${model.bestScore}  ·  新纪录！`
      : `本局得分  ${model.score}\n最高分  ${model.bestScore}`;
    const score = createLabel(scoreText, 29, COLORS.ink, 490, 110, 'display');
    score.node.setPosition(0, titleY - 85);
    panel.addChild(score.node);

    const reward = createLabel(model.runRewardFailed
      ? '本局金币暂未结算 · 联网后自动补发'
      : `+${model.runReward} 金币  ·  余额 ${model.coins}`,
      23, model.runRewardFailed ? COLORS.coral : COLORS.teal, 490, 42, 'display');
    reward.node.setPosition(0, titleY - 155);
    panel.addChild(reward.node);

    const stats = createLabel(
      `最高 Lv.${model.highestLevel}  ·  ${model.moves} 步  ·  ${model.merges} 次合成`,
      20, COLORS.teal, 500, 36, 'display');
    stats.node.setPosition(0, titleY - 225);
    panel.addChild(stats.node);

    if (model.dailyChallenge) {
      const challengeText = model.dailyChallenge.completed
        ? `今日挑战已完成 · 合成 Lv.${model.dailyChallenge.targetLevel}`
        : `今日挑战未完成 · Lv.${Math.min(model.highestLevel, model.dailyChallenge.targetLevel)}/${model.dailyChallenge.targetLevel}`;
      const challenge = createLabel(challengeText, 20,
        model.dailyChallenge.completed ? COLORS.mustard : COLORS.coral, 500, 36, 'display');
      challenge.node.setPosition(0, titleY - 270);
      panel.addChild(challenge.node);
    }

    const actionY = hasAction ? -105 : 0;
    const rescueText = model.canUndoRescue
      ? `撤回一步（剩 ${model.undoRescueCount} 个）`
      : `消除最低级猫咪（剩 ${model.removeLowestRescueCount} 个）`;
    if (hasRescue && model.canRevive) {
      const rescue = createButton(rescueText, 240, 76, COLORS.teal, () => {
        if (model.canUndoRescue) actions.onUndoRescue();
        else actions.onRemoveLowestRescue();
      }, 19);
      rescue.setPosition(-130, actionY);
      panel.addChild(rescue);
      const revive = createButton('分享复活', 240, 76, COLORS.coral, actions.onRevive, 24,
        this.art.frame(GAME_CONFIG.art.share));
      revive.setPosition(130, actionY);
      panel.addChild(revive);
    } else if (hasRescue) {
      const rescue = createButton(rescueText, 500, 76, COLORS.teal, () => {
        if (model.canUndoRescue) actions.onUndoRescue();
        else actions.onRemoveLowestRescue();
      }, 23);
      rescue.setPosition(0, actionY);
      panel.addChild(rescue);
    } else if (model.canRevive) {
      const revive = createButton('分享复活', 500, 76, COLORS.coral, actions.onRevive, 26,
        this.art.frame(GAME_CONFIG.art.share));
      revive.setPosition(0, actionY);
      panel.addChild(revive);
    }

    const bottomY = hasAction ? -190 : -150;
    const home = createPillButton('返回主页', actions.onHome, {
      color: COLORS.teal,
      fontSize: 27,
      icon: this.art.frame(GAME_CONFIG.art.home),
    });
    home.setPosition(-135, bottomY);
    panel.addChild(home);
    const replay = createPillButton('再玩一局', actions.onReplay, {
      color: COLORS.coral,
      fontSize: 27,
      icon: this.art.frame(GAME_CONFIG.art.classicMode),
    });
    replay.setPosition(135, bottomY);
    panel.addChild(replay);

    return overlay;
  }
}
