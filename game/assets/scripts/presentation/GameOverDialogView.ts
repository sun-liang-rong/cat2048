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
  readonly uiWidth: number;
  readonly uiHeight: number;
}

export interface GameOverDialogActions {
  readonly onHome: () => void;
  readonly onReplay: () => void;
  readonly onShareScore: () => void;
  readonly onRevive: () => void;
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

    const panelHeight = model.canRevive ? 650 : 560;
    const panel = createUiNode('GameOverPanel', 590, panelHeight);
    drawRounded(panel, 590, panelHeight, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);

    const title = createLabel('猫咪挤满啦', 46, COLORS.coral, 500, 70, 'display');
    title.node.setPosition(0, panelHeight / 2 - 76);
    panel.addChild(title.node);
    const score = createLabel(`本局得分  ${model.score}\n最高分  ${model.bestScore}`, 29, COLORS.ink, 490, 110, 'display');
    score.node.setPosition(0, panelHeight / 2 - 175);
    panel.addChild(score.node);
    const reward = createLabel(model.runRewardFailed
      ? '本局金币暂未结算'
      : `+${model.runReward} 金币  ·  余额 ${model.coins}`,
      23, model.runRewardFailed ? COLORS.coral : COLORS.teal, 490, 42, 'display');
    reward.node.setPosition(0, panelHeight / 2 - 235);
    panel.addChild(reward.node);

    if (model.canRevive) {
      const revive = createButton('分享复活 · 每局1次', 500, 84, COLORS.coral, actions.onRevive, 29,
        this.art.frame(GAME_CONFIG.art.share));
      revive.setPosition(0, 28);
      panel.addChild(revive);
      const reviveHint = createLabel('移除两只最低等级猫咪并继续', 21, COLORS.ink, 470, 38);
      reviveHint.node.setPosition(0, -33);
      panel.addChild(reviveHint.node);
    }

    const shareY = model.canRevive ? -104 : -20;
    const share = createButton('分享战绩', 500, 76, COLORS.mustard, actions.onShareScore, 28,
      this.art.frame(GAME_CONFIG.art.share));
    share.setPosition(0, shareY);
    panel.addChild(share);

    const bottomY = model.canRevive ? -235 : -175;
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
