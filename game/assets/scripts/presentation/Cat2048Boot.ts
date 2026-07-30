import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  input,
  Input,
  KeyCode,
  Label,
  Node,
  profiler,
  ResolutionPolicy,
  screen,
  sys,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { Game2048 } from '../core/Game2048';
import type { Direction } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { HapticController } from '../infrastructure/HapticController';
import { ResultShareController } from '../infrastructure/ResultShareController';
import { RuntimeRandomSource, runtimeStorage } from '../infrastructure/runtime';
import type { SaveDataV1 } from '../infrastructure/storage';
import { ArtRepository } from './ArtRepository';
import { AudioController } from './AudioController';
import { addCoverBackground } from './background';
import { BoardView } from './BoardView';
import { BOARD_PIXELS } from './boardGeometry';
import {
  capsuleBottomInset,
  gameLayout,
  safeInsetsFromRect,
} from './layout';
import { DialogView } from './DialogView';
import { HomeView } from './HomeView';
import { SettingsPanel } from './SettingsPanel';
import { settingsOrigin } from './settingsNavigation';
import { SwipeInput } from './SwipeInput';
import {
  COLORS,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  setDisplayFont,
} from './uiFactory';

const { ccclass } = _decorator;

const BOTTOM_EDGE_ICON_CROP = { x: 4, y: 0, width: 144, height: 144 } as const;

@ccclass('Cat2048Boot')
export class Cat2048Boot extends Component {
  private readonly art = new ArtRepository();
  private readonly boardView = new BoardView(this.art);
  private readonly homeView = new HomeView(this.art);
  private readonly game = new Game2048(new RuntimeRandomSource());
  private readonly haptics = new HapticController();
  private readonly resultShare = new ResultShareController();
  private audio!: AudioController;
  private save: SaveDataV1 = {
    schemaVersion: 1,
    highScore: 0,
    soundEnabled: true,
    hapticsEnabled: true,
  };
  private screenRoot: Node | null = null;
  private scoreLabel: Label | null = null;
  private highScoreLabel: Label | null = null;
  private evolutionPanel: Node | null = null;
  private undoButton: Node | null = null;
  private removeLowestButton: Node | null = null;
  private undoCountLabel: Label | null = null;
  private removeLowestCountLabel: Label | null = null;
  private inputLocked = false;
  private swipe: SwipeInput | null = null;
  private readonly dialogs = new DialogView(this.art, () => ({ width: this.uiWidth, height: this.uiHeight }));
  private readonly settings = new SettingsPanel(this.art, () => ({ width: this.uiWidth, height: this.uiHeight }));
  private uiWidth: number = GAME_CONFIG.designWidth;
  private uiHeight: number = GAME_CONFIG.designHeight;
  private safeTop = 24;
  private safeBottom = 20;
  private sceneToken = 0;
  private shareInProgress = false;

  protected override onLoad(): void {
    profiler.hideStats();
    this.setupCanvas();
    this.save = runtimeStorage.load();
    this.audio = new AudioController(this.node, this.art);
    this.audio.enabled = this.save.soundEnabled;
    this.haptics.enabled = this.save.hapticsEnabled;
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    screen.on('window-resize', this.onResize, this);
    screen.on('orientation-change', this.onResize, this);
    void this.initialize();
  }

  protected override onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    screen.off('window-resize', this.onResize, this);
    screen.off('orientation-change', this.onResize, this);
    Tween.stopAll();
    this.sceneToken += 1;
  }

  private async initialize(): Promise<void> {
    this.showLoading();
    await this.art.preload();
    if (!this.isValid) return;
    setDisplayFont(this.art.font(GAME_CONFIG.fonts.display) ?? null);
    this.showHome();
  }

  private setupCanvas(): void {
    view.setDesignResolutionSize(GAME_CONFIG.designWidth, GAME_CONFIG.designHeight, ResolutionPolicy.FIXED_WIDTH);
    const visible = view.getVisibleSize();
    this.uiWidth = visible.width;
    this.uiHeight = visible.height;
    const safe = safeInsetsFromRect(this.uiHeight, sys.getSafeAreaRect(false));
    this.safeTop = Math.max(safe.top, this.wechatCapsuleInset());
    this.safeBottom = safe.bottom;
    (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(visible);
  }

  private readonly onResize = (): void => {
    this.unschedule(this.applyResize);
    this.scheduleOnce(this.applyResize, 0.15);
  };

  private readonly applyResize = (): void => {
    const wasGame = this.boardView.root !== null;
    this.setupCanvas();
    if (wasGame) this.showGame(false); else this.showHome();
  };

  private showLoading(): void {
    this.clearScreen();
    const root = this.makeScreen('Loading');
    const label = createLabel('猫咪们正在集合…', 38, COLORS.ink, 560, 80);
    root.addChild(label.node);
  }

  private showHome(): void {
    this.clearScreen();
    const root = this.makeScreen('Home');
    this.homeView.build(root, {
      highScore: this.save.highScore,
      soundEnabled: this.save.soundEnabled,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onPlay: () => this.startGame(),
      onInfo: () => this.showInfoDialog(),
      onToggleSound: () => this.toggleSound(),
      onSettings: () => this.showSettingsDialog(),
    });
  }

  private toggleSound(): void {
    this.save = { ...this.save, soundEnabled: !this.save.soundEnabled };
    runtimeStorage.save(this.save);
    this.audio.enabled = this.save.soundEnabled;
    this.showHome();
  }

  private startGame(): void {
    this.showGame(true);
  }

  private showGame(startNewGame: boolean): void {
    this.clearScreen();
    if (startNewGame) this.game.start();
    const root = this.makeScreen('Game');
    addCoverBackground(
      root,
      this.art,
      GAME_CONFIG.art.pageBackground,
      this.uiWidth,
      this.uiHeight,
      new Color(249, 235, 206, 255),
    );

    const layout = gameLayout(this.uiWidth, this.uiHeight, this.topSafeInset(), this.bottomSafeInset(), BOARD_PIXELS);
    const hudY = this.uiHeight / 2 - layout.hudCenterFromTop;
    const back = createIconButton('Back', this.art.frame(GAME_CONFIG.art.back), '‹', 76,
      () => { if (!this.inputLocked) this.confirmLeave(); });
    back.setPosition(-this.uiWidth / 2 + 62, hudY);
    root.addChild(back);
    const settings = createIconButton('Settings', this.art.frame(GAME_CONFIG.art.settings), '⚙', 76,
      () => { if (!this.inputLocked) this.showSettingsDialog(); }, BOTTOM_EDGE_ICON_CROP);
    settings.setPosition(this.uiWidth / 2 - 62, hudY);
    root.addChild(settings);

    const scoreCard = this.createHudCard('本局', String(this.game.score));
    scoreCard.node.setPosition(-115, hudY);
    root.addChild(scoreCard.node);
    this.scoreLabel = scoreCard.value;
    const bestCard = this.createHudCard('最高', String(this.save.highScore));
    bestCard.node.setPosition(115, hudY);
    root.addChild(bestCard.node);
    this.highScoreLabel = bestCard.value;

    if (layout.evolutionPanelHeight > 0) {
      this.createEvolutionPanel(root, this.uiHeight / 2 - layout.evolutionPanelCenterFromTop,
        layout.evolutionPanelHeight);
    }

    const board = this.boardView.mount(root, BOARD_PIXELS);
    board.setPosition(0, this.uiHeight / 2 - layout.boardTop - BOARD_PIXELS * layout.boardScale / 2);
    board.setScale(layout.boardScale, layout.boardScale, 1);
    this.swipe = new SwipeInput(
      () => this.inputLocked,
      (direction) => { void this.performMove(direction); },
      (x, y) => this.boardView.showTouchHighlight(x, y),
      () => this.boardView.clearTouchHighlight(),
    );
    this.swipe.bind(board, (uiX, uiY) => {
      const local = board.getComponent(UITransform)?.convertToNodeSpaceAR(new Vec3(uiX, uiY, 0));
      return local ? { x: local.x, y: local.y } : null;
    });
    this.boardView.renderInitial(this.game.board);

    this.createItemBar(root, this.uiHeight / 2 - layout.itemBarCenterFromTop);
  }

  private createEvolutionPanel(root: Node, y: number, height: number): void {
    const panel = createUiNode('EvolutionPanel', 650, height);
    drawRounded(panel, 650, height, new Color(255, 248, 226, 232), 28,
      { color: new Color(76, 61, 54, 220), width: 4 });
    panel.setPosition(0, y);
    root.addChild(panel);
    this.evolutionPanel = panel;
    this.refreshEvolutionPanel();
  }

  private refreshEvolutionPanel(): void {
    const panel = this.evolutionPanel;
    if (!panel) return;
    for (const child of [...panel.children]) child.destroy();

    const panelHeight = panel.getComponent(UITransform)?.height ?? 0;
    const compact = panelHeight < 190;
    const highestLevel = this.game.board.tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
    const current = GAME_CONFIG.cats[highestLevel - 1];
    const next = GAME_CONFIG.cats[Math.min(highestLevel, GAME_CONFIG.cats.length - 1)];
    const maxed = highestLevel === GAME_CONFIG.cats.length;

    const title = createLabel('猫咪进化路线', compact ? 21 : 24, COLORS.ink, 250, 38, 'display');
    title.node.setPosition(-173, panelHeight / 2 - (compact ? 26 : 31));
    panel.addChild(title.node);
    const collection = createLabel(`图鉴 ${highestLevel}/${GAME_CONFIG.cats.length}`, compact ? 18 : 20,
      COLORS.teal, 160, 36, 'display');
    collection.node.setPosition(220, panelHeight / 2 - (compact ? 26 : 31));
    panel.addChild(collection.node);

    const catY = compact ? -2 : 8;
    const catSize = compact ? 68 : 94;
    const currentFrame = this.art.frame(current.asset);
    if (currentFrame) {
      const cat = createSpriteNode('EvolutionCurrentCat', currentFrame, catSize, catSize);
      cat.setPosition(-185, catY);
      panel.addChild(cat);
    }
    const currentText = createLabel(`Lv.${highestLevel}  ${current.name}`, compact ? 18 : 21,
      COLORS.ink, 250, compact ? 32 : 38, 'display');
    currentText.node.setPosition(-185, compact ? -45 : -55);
    panel.addChild(currentText.node);

    const arrowBadge = createUiNode('EvolutionArrow', compact ? 42 : 52, compact ? 42 : 52);
    drawRounded(arrowBadge, compact ? 42 : 52, compact ? 42 : 52, COLORS.teal, compact ? 21 : 26);
    arrowBadge.setPosition(0, catY);
    const arrow = createLabel('›', compact ? 34 : 42, COLORS.white, compact ? 36 : 44, compact ? 36 : 44, 'display');
    arrow.node.setPosition(2, 2);
    arrowBadge.addChild(arrow.node);
    panel.addChild(arrowBadge);

    if (maxed) {
      const complete = createLabel('全图鉴达成', compact ? 19 : 22, COLORS.mustard, 200, 42, 'display');
      complete.node.setPosition(185, catY);
      panel.addChild(complete.node);
    } else {
      const nextFrame = this.art.frame(next.asset);
      if (nextFrame) {
        const nextCat = createSpriteNode('EvolutionNextCat', nextFrame, catSize, catSize);
        nextCat.setPosition(185, catY);
        panel.addChild(nextCat);
      }
      const nextText = createLabel(`Lv.${highestLevel + 1}  ${next.name}`, compact ? 17 : 20,
        COLORS.ink, 250, compact ? 32 : 38, 'display');
      nextText.node.setPosition(185, compact ? -45 : -55);
      panel.addChild(nextText.node);
    }

    if (!compact) {
      const trackWidth = 570;
      const track = createUiNode('EvolutionProgressTrack', trackWidth, 18);
      drawRounded(track, trackWidth, 18, new Color(226, 207, 171, 255), 9);
      track.setPosition(0, -panelHeight / 2 + 31);
      panel.addChild(track);
      const fillWidth = Math.max(18, trackWidth * highestLevel / GAME_CONFIG.cats.length);
      const fill = createUiNode('EvolutionProgressFill', fillWidth, 18);
      drawRounded(fill, fillWidth, 18, maxed ? COLORS.mustard : COLORS.teal, 9);
      fill.setPosition(-trackWidth / 2 + fillWidth / 2, 0);
      track.addChild(fill);
    }
  }

  private createItemBar(root: Node, y: number): void {
    const bar = createUiNode('ItemBar', 650, 96);
    bar.setPosition(0, y);
    root.addChild(bar);

    const undo = this.createItemButton('UndoItem', '撤回一步', '↶', () => this.game.items.canUndo,
      () => { void this.useUndoItem(); });
    undo.node.setPosition(-167, 0);
    bar.addChild(undo.node);
    this.undoButton = undo.node;
    this.undoCountLabel = undo.count;

    const remove = this.createItemButton('RemoveLowestItem', '消除最低 ×3', '×3',
      () => this.game.items.canRemoveLowest, () => { void this.useRemoveLowestItem(); });
    remove.node.setPosition(167, 0);
    bar.addChild(remove.node);
    this.removeLowestButton = remove.node;
    this.removeLowestCountLabel = remove.count;
    this.refreshItemButtons();
  }

  private createItemButton(name: string, titleText: string, iconText: string, isEnabled: () => boolean,
    onTap: () => void): { node: Node; count: Label } {
    const node = createUiNode(name, 316, 96);
    drawRounded(node, 316, 96, new Color(255, 248, 226, 245), 26,
      { color: COLORS.ink, width: 4 });

    const icon = createUiNode(`${name}:Icon`, 68, 68);
    drawRounded(icon, 68, 68, COLORS.teal, 22);
    icon.setPosition(-111, 0);
    const iconLabel = createLabel(iconText, 29, COLORS.white, 60, 58, 'display');
    icon.addChild(iconLabel.node);
    node.addChild(icon);

    const title = createLabel(titleText, 25, COLORS.ink, 176, 46, 'display');
    title.node.setPosition(11, 7);
    node.addChild(title.node);

    const badge = createUiNode(`${name}:CountBadge`, 54, 32);
    drawRounded(badge, 54, 32, COLORS.mustard, 16);
    badge.setPosition(119, -26);
    const count = createLabel('1', 20, COLORS.white, 48, 28, 'display');
    badge.addChild(count.node);
    node.addChild(badge);

    node.on(Node.EventType.TOUCH_START, () => {
      if (!isEnabled() || this.inputLocked) return;
      tween(node).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
    node.on(Node.EventType.TOUCH_END, () => {
      if (!isEnabled() || this.inputLocked) return;
      tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start();
    });
    return { node, count };
  }

  private refreshItemButtons(): void {
    const state = this.game.items;
    this.setItemButtonState(this.undoButton, this.undoCountLabel, state.canUndo, state.undoRemaining);
    this.setItemButtonState(this.removeLowestButton, this.removeLowestCountLabel,
      state.canRemoveLowest, state.removeLowestRemaining);
  }

  private setItemButtonState(node: Node | null, count: Label | null, enabled: boolean, remaining: number): void {
    if (!node || !count) return;
    count.string = String(remaining);
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    opacity.opacity = enabled ? 255 : 105;
  }

  private readonly onKeyDown = (event: EventKeyboard): void => {
    if (!this.boardView.root || this.inputLocked) return;
    const directions: Partial<Record<KeyCode, Direction>> = {
      [KeyCode.ARROW_UP]: 'up', [KeyCode.ARROW_DOWN]: 'down',
      [KeyCode.ARROW_LEFT]: 'left', [KeyCode.ARROW_RIGHT]: 'right',
      [KeyCode.KEY_W]: 'up', [KeyCode.KEY_S]: 'down', [KeyCode.KEY_A]: 'left', [KeyCode.KEY_D]: 'right',
    };
    const direction = directions[event.keyCode];
    if (direction) void this.performMove(direction);
  };

  private async performMove(direction: Direction): Promise<void> {
    if (this.inputLocked) return;
    const result = this.game.move(direction);
    if (!result.changed) {
      if (result.status === 'game-over') this.showGameOver();
      return;
    }
    const token = this.sceneToken;
    this.inputLocked = true;
    await this.boardView.animateMove(
      result,
      () => token === this.sceneToken && this.boardView.root !== null,
      {
        onMerge: () => {
          this.haptics.light();
          this.audio.play('merge', 0.8);
        },
        onMove: () => {
          this.audio.play('move', 0.55);
        },
      },
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.updateScore(result.score);
    this.refreshEvolutionPanel();
    this.refreshItemButtons();
    this.inputLocked = false;
    if (result.status === 'game-over') this.showGameOver();
  }

  private async useUndoItem(): Promise<void> {
    if (this.inputLocked || !this.game.items.canUndo || !this.boardView.root) return;
    const result = this.game.undo();
    if (!result.changed) {
      this.refreshItemButtons();
      return;
    }
    const token = this.sceneToken;
    this.inputLocked = true;
    this.refreshItemButtons();
    await this.boardView.fadeRebuild(
      result.board,
      () => token === this.sceneToken && this.boardView.root !== null,
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.updateScore(result.score);
    this.refreshEvolutionPanel();
    this.inputLocked = false;
  }

  private async useRemoveLowestItem(): Promise<void> {
    if (this.inputLocked || !this.game.items.canRemoveLowest || !this.boardView.root) return;
    const result = this.game.removeLowestTiles(3);
    if (!result.changed) {
      this.refreshItemButtons();
      return;
    }
    const token = this.sceneToken;
    this.inputLocked = true;
    this.refreshItemButtons();
    this.haptics.light();
    this.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      result.removedTileIds,
      () => token === this.sceneToken && this.boardView.root !== null,
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.boardView.rebuild(result.board, false);
    this.refreshEvolutionPanel();
    this.inputLocked = false;
  }

  private updateScore(score: number): void {
    if (this.scoreLabel) this.scoreLabel.string = String(score);
    if (score > this.save.highScore) {
      this.save = { ...this.save, highScore: score };
      runtimeStorage.save(this.save);
      if (this.highScoreLabel) this.highScoreLabel.string = String(score);
    }
  }

  private confirmLeave(): void {
    this.showDialog('返回主页？', '当前棋盘不会保存。', '继续游戏', '返回主页', () => this.showHome());
  }

  private showInfoDialog(): void {
    this.showDialog('怎么玩', '滑动屏幕或使用方向键\n合并两只相同猫咪并不断升级', '知道啦', '开始游戏',
      () => this.startGame());
  }

  private showSettingsDialog(): void {
    if (!this.screenRoot) return;
    const origin = settingsOrigin(this.boardView.root !== null);
    this.inputLocked = true;
    this.settings.show(this.screenRoot, {
      soundEnabled: this.save.soundEnabled,
      hapticsEnabled: this.save.hapticsEnabled,
    }, {
      onSoundChange: (enabled) => {
        this.save = { ...this.save, soundEnabled: enabled };
        this.audio.enabled = enabled;
        runtimeStorage.save(this.save);
      },
      onHapticsChange: (enabled) => {
        this.save = { ...this.save, hapticsEnabled: enabled };
        this.haptics.enabled = enabled;
        runtimeStorage.save(this.save);
      },
      onClose: () => {
        this.inputLocked = false;
        if (origin === 'home') this.showHome();
      },
    });
  }

  private showGameOver(): void {
    this.inputLocked = true;
    this.updateScore(this.game.score);
    this.audio.play('game_over', 0.8);
    this.showDialog('猫咪挤满啦', `本局得分  ${this.game.score}
最高分  ${this.save.highScore}`, '返回主页', '再玩一局',
      () => this.startGame(), () => this.showHome(), {
        text: '分享战绩',
        onTap: () => { void this.shareResult(); },
      });
  }

  private async shareResult(): Promise<void> {
    if (this.shareInProgress || !this.screenRoot) return;
    const shareRoot = this.screenRoot;
    const token = this.sceneToken;
    const highestLevel = this.game.board.tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
    const cat = GAME_CONFIG.cats[highestLevel - 1];
    const backgroundPath = this.art.imagePath(GAME_CONFIG.art.shareScoreBackground);
    const catPath = this.art.imagePath(cat.asset);
    if (!backgroundPath || !catPath) {
      this.dialogs.showNotice(this.screenRoot, '分享卡片素材暂不可用');
      return;
    }

    this.shareInProgress = true;
    const result = await this.resultShare.share({
      score: this.game.score,
      bestScore: this.save.highScore,
      catLevel: highestLevel,
      catName: cat.name,
      backgroundPath,
      catPath,
    });
    this.shareInProgress = false;
    if (token !== this.sceneToken || this.screenRoot !== shareRoot || result === 'shared') return;
    this.dialogs.showNotice(shareRoot, result === 'unsupported'
      ? '请在微信小游戏中分享给好友或群'
      : '战绩卡片生成失败，请稍后重试');
  }

  private showDialog(titleText: string, bodyText: string, cancelText: string, confirmText: string,
    onConfirm: () => void, onCancel?: () => void, auxiliary?: { text: string; onTap: () => void }): void {
    if (!this.screenRoot) return;
    this.inputLocked = true;
    this.dialogs.show(this.screenRoot, titleText, bodyText, cancelText, confirmText, {
      onConfirm,
      onCancel: () => {
        this.inputLocked = false;
        onCancel?.();
      },
      auxiliary,
    });
  }

  private createHudCard(titleText: string, valueText: string): { node: Node; value: Label } {
    const node = createUiNode(`Hud:${titleText}`, 190, 92);
    drawRounded(node, 190, 92, new Color(255, 248, 226, 240), 22, { color: COLORS.ink, width: 4 });
    const title = createLabel(titleText, 20, COLORS.teal, 160, 30, 'display');
    title.node.setPosition(0, 24);
    node.addChild(title.node);
    const value = createLabel(valueText, 34, COLORS.ink, 160, 48, 'display');
    value.node.setPosition(0, -15);
    node.addChild(value.node);
    return { node, value };
  }

  private clearScreen(): void {
    Tween.stopAll();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.shareInProgress = false;
    // Unbind first so late touch-cancel/end cannot fire after the board is gone.
    this.swipe?.unbind();
    this.swipe = null;
    this.boardView.unmount();
    this.scoreLabel = null;
    this.highScoreLabel = null;
    this.evolutionPanel = null;
    this.undoButton = null;
    this.removeLowestButton = null;
    this.undoCountLabel = null;
    this.removeLowestCountLabel = null;
    this.screenRoot?.destroy();
    this.screenRoot = null;
  }

  private makeScreen(name: string): Node {
    const root = createUiNode(name, this.uiWidth, this.uiHeight);
    this.node.addChild(root);
    this.screenRoot = root;
    return root;
  }

  private topSafeInset(): number {
    return this.safeTop;
  }

  private bottomSafeInset(): number {
    return this.safeBottom;
  }

  private wechatCapsuleInset(): number {
    const runtime = globalThis as unknown as {
      wx?: {
        getSystemInfoSync?: () => { windowWidth?: number };
        getMenuButtonBoundingClientRect?: () => { bottom?: number };
      };
    };
    try {
      return capsuleBottomInset(this.uiWidth, runtime.wx?.getSystemInfoSync?.(),
        runtime.wx?.getMenuButtonBoundingClientRect?.());
    } catch (error) {
      console.warn('[Cat2048] Unable to read the WeChat menu capsule bounds.', error);
      return 0;
    }
  }
}
