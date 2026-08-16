import { BlockInputEvents, Graphics, Node, tween, Vec3 } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import { COLORS, createButton, createLabel, createUiNode, drawRounded } from './uiFactory';

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
  readonly onHome: () => void;
  readonly onReplay: () => void;
  readonly onShareScore: () => void;
  readonly onRevive: () => void;
  readonly onUndoRescue: () => void;
  readonly onRemoveLowestRescue: () => void;
}

export class GameOverDialogView {
  public constructor(private readonly art: ArtRepository) {}

  public show(parent: Node, model: GameOverDialogModel, actions: GameOverDialogActions): Node {
    const overlay = createUiNode('GameOverOverlay', model.uiWidth, model.uiHeight);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-model.uiWidth / 2, -model.uiHeight / 2, model.uiWidth, model.uiHeight);
    dim.fill();
    parent.addChild(overlay);

    const hasRescue = model.canUndoRescue || model.canRemoveLowestRescue;
    const hasAction = hasRescue || model.canRevive;
    const panelHeight = hasAction ? 650 : 540;
    const panel = createUiNode('GameOverPanel', 590, panelHeight);
    drawRounded(panel, 590, panelHeight, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);
    const top = panelHeight / 2;

    const title = createLabel('猫咪挤满啦', 46, COLORS.coral, 500, 70, 'display');
    title.node.setPosition(0, top - 72);
    panel.addChild(title.node);

    const scoreText = model.isNewRecord
      ? `本局得分  ${model.score}\n最高分  ${model.bestScore}  ·  新纪录！`
      : `本局得分  ${model.score}\n最高分  ${model.bestScore}`;
    const score = createLabel(scoreText, 29, COLORS.ink, 490, 110, 'display');
    score.node.setPosition(0, top - 158);
    panel.addChild(score.node);

    const reward = createLabel(model.runRewardFailed
      ? '本局金币暂未结算'
      : `+${model.runReward} 金币  ·  余额 ${model.coins}`,
      23, model.runRewardFailed ? COLORS.coral : COLORS.teal, 490, 42, 'display');
    reward.node.setPosition(0, top - 238);
    panel.addChild(reward.node);

    const stats = createLabel(
      `最高 Lv.${model.highestLevel}  ·  ${model.moves} 步  ·  ${model.merges} 次合成`,
      20, COLORS.teal, 500, 36, 'display');
    stats.node.setPosition(0, top - 294);
    panel.addChild(stats.node);

    if (model.dailyChallenge) {
      const challengeText = model.dailyChallenge.completed
        ? `今日挑战已完成 · 合成 Lv.${model.dailyChallenge.targetLevel}`
        : `今日挑战未完成 · Lv.${Math.min(model.highestLevel, model.dailyChallenge.targetLevel)}/${model.dailyChallenge.targetLevel}`;
      const challenge = createLabel(challengeText, 20,
        model.dailyChallenge.completed ? COLORS.mustard : COLORS.coral, 500, 36, 'display');
      challenge.node.setPosition(0, top - 340);
      panel.addChild(challenge.node);
    }

    const actionY = hasAction ? -78 : 0;
    const rescueText = model.canUndoRescue
      ? `撤回一步（剩 ${model.undoRescueCount} 次）`
      : `消除最低级猫咪 ×3（剩 ${model.removeLowestRescueCount} 次）`;
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

    const bottomY = -top + 68;
    const home = createButton('返回主页', 230, 78, COLORS.teal, actions.onHome, 27,
      this.art.frame(GAME_CONFIG.art.home));
    home.setPosition(-135, bottomY);
    panel.addChild(home);
    const replay = createButton('再玩一局', 230, 78, COLORS.coral, actions.onReplay, 27,
      this.art.frame(GAME_CONFIG.art.classicMode));
    replay.setPosition(135, bottomY);
    panel.addChild(replay);

    panel.setScale(0.8, 0.8, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    return overlay;
  }
}
