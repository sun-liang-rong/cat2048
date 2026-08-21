import { Color, Label, Node, tween, Tween, Vec3 } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import { addCoverBackground } from '../styles/background';
import { homeActionDockPositions } from '../styles/layout';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  setLabelText,
} from '../utils/uiFactory';
import { ModernNavDock } from '../components/ModernNavDock';

const TITLE_TOP = 60;
const WALLET_TOP = 156;
const SHOWCASE_TOP = 220;
const SHOWCASE_WIDTH = 600;
const SHOWCASE_HEIGHT = 460;
const PLAY_SIZE = 380;
const PLAY_DOCK_GAP = 50; // 开始按钮底部距底部导航栏顶部的间距
const MODERN_DOCK_HEIGHT = 168; // 与 ModernNavDock 的 DOCK_HEIGHT 保持一致
const UTILITY_ACTION_WIDTH = 164;
const UTILITY_ACTION_HEIGHT = 64;
const UTILITY_ACTION_X = 246;
const DOCK_HEIGHT = 148;

export interface HomeViewModel {
  highScore: number;
  collectionCount: number;
  coins: number;
  canClaimDaily: boolean;
  dailyReward: number;
  taskClaimable: boolean;
  soundEnabled: boolean;
  hasPendingRun: boolean;
  pendingRunScore: number;
  uiWidth: number;
  uiHeight: number;
  topInset: number;
  bottomInset: number;
}

export interface HomeViewActions {
  onPlay(): void;
  onRestart(): void;
  onDailyChallenge(): void;
  onInfo(): void;
  onCollection(): void;
  onLeaderboard(): void;
  onTasks(): void;
  onShop(): void;
  onDailyReward(): void;
  onToggleSound(): void;
  onSettings(): void;
}

interface DockItem {
  name: string;
  text: string;
  framePath: string;
  fallback: string;
  onTap: () => void;
}

export class HomeView {
  private walletNode: Node | null = null;
  private walletLabel: Label | null = null;
  private mainPlayButton: Node | null = null;
  private mainPlayLabel: Label | null = null;
  private taskBadge: Node | null = null;
  private dailyRewardBadge: Node | null = null;
  private modernNavDock: ModernNavDock | null = null;
  private readonly tweens: Tween<Node>[] = [];

  public constructor(private readonly art: ArtRepository) {
    this.modernNavDock = new ModernNavDock(art);
  }

  private trackTween(value: Tween<Node>): Tween<Node> {
    this.tweens.push(value);
    return value;
  }

  public pauseAnimations(): void {
    for (const value of this.tweens) value.pause();
  }

  public resumeAnimations(): void {
    for (const value of this.tweens) value.resume();
  }

  public destroy(): void {
    for (const value of this.tweens) value.stop();
    this.tweens.length = 0;
  }

  public refresh(model: HomeViewModel): void {
    if (this.walletNode && this.walletLabel) {
      setLabelText(this.walletLabel, `金币  ${model.coins}`, 'display', 24);
      this.walletNode.setPosition(0, this.fromTop(model, WALLET_TOP));
    }

    if (this.mainPlayButton && this.mainPlayLabel) {
      const text = model.hasPendingRun ? '继续游戏' : '开始游戏';
      if (this.mainPlayLabel.string !== text) {
        setLabelText(this.mainPlayLabel, text, 'display', 34);
      }
      this.mainPlayButton.setPosition(0, this.playButtonY(model));
    }

    if (this.dailyRewardBadge) {
      this.dailyRewardBadge.active = model.canClaimDaily;
    }

    if (this.modernNavDock) {
      this.modernNavDock.setTaskBadge(model.taskClaimable);
    }
  }

  public setSoundEnabled(_enabled: boolean): void {}

  public build(parent: Node, model: HomeViewModel, actions: HomeViewActions): void {
    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.homeBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(255, 247, 225, 255),
    );

    this.addTitle(parent, model);
    this.addWallet(parent, model, actions);
    this.addUtilityAction(parent, model, 'Leaderboard', GAME_CONFIG.art.homeLeaderboardButton,
      '榜', '排行', -UTILITY_ACTION_X, actions.onLeaderboard);
    this.addUtilityAction(parent, model, 'Checkin', GAME_CONFIG.art.homeCheckinButton,
      '签', '签到', UTILITY_ACTION_X, actions.onDailyReward, model.canClaimDaily);
    this.addCatShowcase(parent, model);
    this.addPlayButton(parent, model, actions);
    
    // 使用现代化导航栏
    if (this.modernNavDock) {
      const dock = this.modernNavDock.build(
        parent,
        model.uiWidth,
        model.uiHeight,
        model.bottomInset,
        model.taskClaimable,
        {
          onCollection: actions.onCollection,
          onShop: actions.onShop,
          onTasks: actions.onTasks,
          onSettings: actions.onSettings,
        }
      );
    }
    
    this.refresh(model);
  }

  private addTitle(root: Node, model: HomeViewModel): void {
    const shadow = createLabel('猫咪合成 2048', 65, new Color(139, 78, 49, 120), 700, 94, 'display');
    shadow.node.setPosition(0, this.fromTop(model, TITLE_TOP) - 6);
    root.addChild(shadow.node);

    const title = createLabel('猫咪合成 2048', 65, new Color(169, 100, 60, 255), 700, 94, 'display');
    title.node.setPosition(0, this.fromTop(model, TITLE_TOP));
    root.addChild(title.node);
  }

  private addWallet(root: Node, model: HomeViewModel, actions: HomeViewActions): void {
    const wallet = createUiNode('HomeCoinWallet', 270, 64);
    drawRounded(wallet, 270, 64, new Color(242, 211, 164, 248), 30,
      { color: new Color(154, 91, 52, 225), width: 4 });
    wallet.setPosition(0, this.fromTop(model, WALLET_TOP));
    root.addChild(wallet);
    this.walletNode = wallet;

    const coinFrame = this.art.frame(GAME_CONFIG.art.homeCoin);
    if (coinFrame) {
      const coin = createSpriteNode('HomeCoinWallet:Coin', coinFrame, 62, 62);
      coin.setPosition(-101, 0);
      wallet.addChild(coin);
    }

    const label = createLabel(`金币  ${model.coins}`, 24, new Color(121, 77, 52, 255), 145, 48, 'display');
    label.node.setPosition(1, 0);
    wallet.addChild(label.node);
    this.walletLabel = label;

    const plusFrame = this.art.frame(GAME_CONFIG.art.homePlus);
    if (plusFrame) {
      const plus = createSpriteNode('HomeCoinWallet:Plus', plusFrame, 50, 50);
      plus.setPosition(105, 0);
      wallet.addChild(plus);
    } else {
      const plus = createLabel('+', 30, new Color(121, 77, 52, 255), 46, 46, 'display');
      plus.node.setPosition(105, 0);
      wallet.addChild(plus.node);
    }

    this.bindTap(wallet, actions.onDailyReward);
  }

  private addCatShowcase(root: Node, model: HomeViewModel): void {
    const showcase = createUiNode('HomeCatShowcase', SHOWCASE_WIDTH, SHOWCASE_HEIGHT);
    const showcaseScale = Math.min(1, Math.max(0.72,
      (this.playButtonTopFromTop(model) + 48 - SHOWCASE_TOP) / SHOWCASE_HEIGHT));
    showcase.setScale(showcaseScale, showcaseScale, 1);
    showcase.setPosition(0,
      this.fromTop(model, SHOWCASE_TOP + SHOWCASE_HEIGHT * showcaseScale / 2));

    const frame = this.art.frame(GAME_CONFIG.art.homeCatRoom);
    if (frame) {
      showcase.addChild(createSpriteNode('HomeCatShowcase:Art', frame,
        SHOWCASE_WIDTH, SHOWCASE_HEIGHT));
    }

    root.addChild(showcase);
    this.trackTween(tween(showcase)
      .to(2.2, { position: new Vec3(0, showcase.position.y + 4, 0) }, { easing: 'sineInOut' })
      .to(2.2, { position: new Vec3(0, showcase.position.y, 0) }, { easing: 'sineInOut' })
      .union().repeatForever().start());
  }

  private addUtilityAction(
    root: Node,
    model: HomeViewModel,
    name: string,
    framePath: string,
    fallback: string,
    text: string,
    x: number,
    onTap: () => void,
    rewardAvailable?: boolean,
  ): void {
    const node = createUiNode(`HomeUtilityAction:${name}`,
      UTILITY_ACTION_WIDTH, UTILITY_ACTION_HEIGHT);
    node.setPosition(x, this.fromTop(model, WALLET_TOP));

    const shadow = createUiNode(`${node.name}:Shadow`,
      UTILITY_ACTION_WIDTH - 4, UTILITY_ACTION_HEIGHT - 2);
    drawRounded(shadow, UTILITY_ACTION_WIDTH - 4, UTILITY_ACTION_HEIGHT - 2,
      new Color(105, 61, 40, 35), 22);
    shadow.setPosition(0, -3);
    node.addChild(shadow);

    const surface = createUiNode(`${node.name}:Surface`,
      UTILITY_ACTION_WIDTH, UTILITY_ACTION_HEIGHT);
    drawRounded(surface, UTILITY_ACTION_WIDTH, UTILITY_ACTION_HEIGHT,
      new Color(255, 248, 228, 246), 22,
      { color: new Color(143, 91, 57, 155), width: 2 });
    node.addChild(surface);

    const frame = this.art.frame(framePath);
    if (frame) {
      const icon = createSpriteNode(`${node.name}:Icon`, frame, 46, 46);
      icon.setPosition(-51, 1);
      surface.addChild(icon);
    } else {
      const icon = createLabel(fallback, 25, COLORS.mustard, 44, 44, 'display');
      icon.node.setPosition(-51, 1);
      surface.addChild(icon.node);
    }

    const label = createLabel(text, 20, new Color(113, 72, 49, 255), 82, 40, 'display');
    label.node.setPosition(27, 0);
    surface.addChild(label.node);

    if (typeof rewardAvailable === 'boolean') {
      const badge = createUiNode('DailyRewardBadge', 22, 22);
      drawRounded(badge, 22, 22, COLORS.coral, 11,
        { color: COLORS.white, width: 2 });
      badge.setPosition(UTILITY_ACTION_WIDTH / 2 - 5, UTILITY_ACTION_HEIGHT / 2 - 3);
      badge.active = rewardAvailable;
      node.addChild(badge);
      this.dailyRewardBadge = badge;
    }

    root.addChild(node);
    this.bindTap(node, onTap);
  }

  private addPlayButton(root: Node, model: HomeViewModel, actions: HomeViewActions): void {
    const play = createUiNode('HomePlayPaw', PLAY_SIZE, PLAY_SIZE);
    play.setPosition(0, this.playButtonY(model));
    const frame = this.art.frame(GAME_CONFIG.art.homePlayPaw);
    if (frame) play.addChild(createSpriteNode('HomePlayPaw:Art', frame, PLAY_SIZE, PLAY_SIZE));
    else {
      const fallback = createUiNode('HomePlayPaw:Fallback', 292, 158);
      drawRounded(fallback, 292, 158, COLORS.coral, 76,
        { color: new Color(151, 72, 50, 255), width: 5 });
      fallback.setPosition(0, -20);
      play.addChild(fallback);
    }

    const label = createLabel(model.hasPendingRun ? '继续游戏' : '开始游戏', 34,
      new Color(255, 250, 232, 255), 250, 66, 'display');
    label.node.setPosition(0, -48);
    play.addChild(label.node);
    this.mainPlayButton = play;
    this.mainPlayLabel = label;
    root.addChild(play);
    this.bindTap(play, actions.onPlay);
    this.trackTween(tween(play)
      .to(0.9, { scale: new Vec3(1.035, 1.035, 1) }, { easing: 'sineInOut' })
      .to(0.9, { scale: Vec3.ONE }, { easing: 'sineInOut' })
      .union().repeatForever().start());
  }

  private addDock(root: Node, model: HomeViewModel, actions: HomeViewActions): void {
    const dockY = -model.uiHeight / 2 + model.bottomInset + DOCK_HEIGHT / 2;
    const dock = createUiNode('HomeActionDock', model.uiWidth, DOCK_HEIGHT);
    dock.setPosition(0, dockY);

    // 创建带渐变的现代化背景
    const background = createUiNode('HomeActionDock:Background', model.uiWidth, DOCK_HEIGHT);
    this.drawModernDockBackground(background, model.uiWidth, DOCK_HEIGHT);
    dock.addChild(background);
    
    root.addChild(dock);

    const items: DockItem[] = [
      { name: 'Collection', text: '图鉴', framePath: GAME_CONFIG.art.homeCollection, fallback: '图', onTap: actions.onCollection },
      { name: 'Shop', text: '商店', framePath: GAME_CONFIG.art.homeShop, fallback: '店', onTap: actions.onShop },
      { name: 'Tasks', text: '任务', framePath: GAME_CONFIG.art.homeTasks, fallback: '任', onTap: actions.onTasks },
      { name: 'Settings', text: '设置', framePath: GAME_CONFIG.art.homeSettings, fallback: '设', onTap: actions.onSettings },
    ];
    const positions = homeActionDockPositions(4, Math.min(184, model.uiWidth / 4.12));
    items.forEach((item, index) => {
      const button = this.createModernDockButton(item.name, this.art.frame(item.framePath), item.fallback, item.onTap);
      button.setPosition(positions[index], 18);
      dock.addChild(button);
      const label = createLabel(item.text, 20, new Color(103, 67, 48, 255), 120, 34, 'display');
      label.node.setPosition(positions[index], -42);
      dock.addChild(label.node);

      if (item.name === 'Tasks') {
        const badge = createUiNode('TaskClaimBadge', 28, 28);
        drawRounded(badge, 28, 28, COLORS.coral, 14, { color: COLORS.white, width: 3 });
        badge.addChild(createLabel('!', 18, COLORS.white, 22, 24, 'display').node);
        badge.setPosition(positions[index] + 30, 53);
        dock.addChild(badge);
        this.taskBadge = badge;
      }
    });
  }

  private bindTap(node: Node, onTap: () => void): void {
    node.on(Node.EventType.TOUCH_START, () =>
      tween(node).to(0.05, { scale: new Vec3(0.95, 0.95, 1) }).start());
    node.on(Node.EventType.TOUCH_CANCEL, () =>
      tween(node).to(0.08, { scale: Vec3.ONE }).start());
    node.on(Node.EventType.TOUCH_END, () =>
      tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start());
  }

  private fromTop(model: HomeViewModel, offset: number): number {
    return model.uiHeight / 2 - model.topInset - offset;
  }

  /** 开始游戏按钮中心 Y：按钮底部距底部导航栏顶部 50px */
  private playButtonY(model: HomeViewModel): number {
    const dockTop = -model.uiHeight / 2 + model.bottomInset + MODERN_DOCK_HEIGHT;
    return dockTop + PLAY_DOCK_GAP + PLAY_SIZE / 2;
  }

  private playButtonTopFromTop(model: HomeViewModel): number {
    return model.uiHeight / 2 - this.playButtonY(model) - PLAY_SIZE / 2;
  }

  private drawModernDockBackground(node: Node, width: number, height: number): void {
    // 绘制主背景 - 温暖的渐变色
    const base = createUiNode('DockBackground:Base', width, height);
    drawRounded(base, width, height, new Color(252, 229, 184, 255), 24);
    node.addChild(base);

    // 添加顶部高光
    const highlight = createUiNode('DockBackground:Highlight', width - 32, 42);
    drawRounded(highlight, width - 32, 42, new Color(255, 248, 232, 80), 16);
    highlight.setPosition(0, height / 2 - 30);
    node.addChild(highlight);

    // 添加边框
    const border = createUiNode('DockBackground:Border', width, height);
    drawRounded(border, width, height, new Color(0, 0, 0, 0), 24,
      { color: new Color(139, 84, 50, 200), width: 3 });
    node.addChild(border);

    // 添加顶部阴影分隔线
    const separator = createUiNode('DockBackground:Separator', width - 48, 2);
    drawRounded(separator, width - 48, 2, new Color(139, 84, 50, 60), 1);
    separator.setPosition(0, height / 2 - 8);
    node.addChild(separator);
  }

  private createModernDockButton(name: string, frame: any, fallback: string, onTap: () => void): Node {
    const container = createUiNode(`DockButton:${name}`, 80, 80);

    // 按钮背景
    const background = createUiNode(`${name}:Background`, 72, 72);
    drawRounded(background, 72, 72, new Color(255, 248, 232, 255), 16,
      { color: new Color(139, 84, 50, 100), width: 2 });
    container.addChild(background);

    // 图标或文字
    if (frame) {
      const icon = createSpriteNode(`${name}:Icon`, frame, 56, 56);
      icon.setPosition(0, 0);
      container.addChild(icon);
    } else {
      const iconText = createLabel(fallback, 32, new Color(139, 84, 50, 255), 60, 48, 'display');
      iconText.node.setPosition(0, 0);
      container.addChild(iconText.node);
    }

    this.bindTap(container, onTap);
    return container;
  }
}
