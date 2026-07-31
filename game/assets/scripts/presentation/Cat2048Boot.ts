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
import type { BoardSnapshot, Direction, ItemKind } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { HapticController } from '../infrastructure/HapticController';
import { ResultShareController } from '../infrastructure/ResultShareController';
import type { SharePurpose, ShareResult } from '../infrastructure/ResultShareController';
import { RuntimeRandomSource, runtimeStorage } from '../infrastructure/runtime';
import { DEFAULT_SAVE } from '../infrastructure/storage';
import type { SaveDataV2 } from '../infrastructure/storage';
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
import { CollectionView } from './CollectionView';
import type { CollectionOrigin } from './CollectionView';
import { GameOverDialogView } from './GameOverDialogView';
import { HomeView } from './HomeView';
import { LoadingView } from './LoadingView';
import { SettingsPanel } from './SettingsPanel';
import { settingsOrigin } from './settingsNavigation';
import { runStartupSequence } from './startupSequence';
import { SwipeInput } from './SwipeInput';
import { TutorialView } from './TutorialView';
import {
  COLORS,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  setLabelText,
  setRuntimeFonts,
} from './uiFactory';

const { ccclass } = _decorator;

const BOTTOM_EDGE_ICON_CROP = { x: 4, y: 0, width: 144, height: 144 } as const;

interface ItemButtonView {
  readonly node: Node;
  readonly count: Label;
  readonly title: Label;
  readonly icon: Node;
  readonly baseTitle: string;
  readonly baseIcon: string;
}

type ScreenName = 'loading' | 'home' | 'game' | 'collection';

@ccclass('Cat2048Boot')
export class Cat2048Boot extends Component {
  private readonly art = new ArtRepository();
  private readonly boardView = new BoardView(this.art);
  private readonly homeView = new HomeView(this.art);
  private readonly collectionView = new CollectionView(this.art);
  private readonly tutorialView = new TutorialView();
  private readonly gameOverDialog = new GameOverDialogView(this.art);
  private readonly loadingView = new LoadingView();
  private readonly game = new Game2048(new RuntimeRandomSource());
  private readonly haptics = new HapticController();
  private readonly resultShare = new ResultShareController();
  private audio!: AudioController;
  private save: SaveDataV2 = DEFAULT_SAVE;
  private screenRoot: Node | null = null;
  private scoreLabel: Label | null = null;
  private highScoreLabel: Label | null = null;
  private evolutionPanel: Node | null = null;
  private undoItem: ItemButtonView | null = null;
  private removeLowestItem: ItemButtonView | null = null;
  private gameOverOverlay: Node | null = null;
  private pendingUnlockLevels: number[] = [];
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
  private swipeGuideActive = false;
  private assetsReady = false;
  private currentScreen: ScreenName = 'loading';
  private collectionOrigin: CollectionOrigin = 'home';

  protected override onLoad(): void {
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
    await runStartupSequence({
      preload: () => this.art.preload((ratio) => this.loadingView.setProgress(ratio)),
      isActive: () => this.isValid,
      onReady: () => {
        this.assetsReady = true;
        setRuntimeFonts(
          this.art.font(GAME_CONFIG.fonts.display) ?? null,
          this.art.font(GAME_CONFIG.fonts.numbers) ?? null,
        );
        this.showHome();
      },
      onError: (error) => {
        console.error('[Cat2048] Startup asset loading failed', error);
        this.loadingView.showError();
      },
    });
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
    const screenBeforeResize = this.currentScreen;
    this.setupCanvas();
    if (!this.assetsReady) {
      this.showLoading();
      return;
    }
    if (screenBeforeResize === 'game') this.showGame(false);
    else if (screenBeforeResize === 'collection') this.showCollection(this.collectionOrigin);
    else this.showHome();
  };

  private showLoading(): void {
    this.clearScreen();
    this.currentScreen = 'loading';
    const root = this.makeScreen('Loading');
    this.loadingView.build(root, this.uiWidth, this.uiHeight);
  }

  private showHome(): void {
    this.clearScreen();
    this.currentScreen = 'home';
    const root = this.makeScreen('Home');
    this.homeView.build(root, {
      highScore: this.save.highScore,
      collectionCount: this.save.unlockedCatLevels.length,
      soundEnabled: this.save.soundEnabled,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onPlay: () => { if (this.assetsReady) this.startGame(); },
      onInfo: () => { if (this.assetsReady) this.showInfoDialog(); },
      onCollection: () => { if (this.assetsReady) this.showCollection('home'); },
      onToggleSound: () => { if (this.assetsReady) this.toggleSound(); },
      onSettings: () => { if (this.assetsReady) this.showSettingsDialog(); },
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

  private showCollection(origin: CollectionOrigin): void {
    this.clearScreen();
    this.currentScreen = 'collection';
    this.collectionOrigin = origin;
    const root = this.makeScreen('Collection');
    this.collectionView.build(root, {
      unlockedLevels: this.save.unlockedCatLevels,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onBack: () => {
        if (origin === 'game') this.showGame(false);
        else this.showHome();
      },
    });
  }

  private showGame(startNewGame: boolean): void {
    this.clearScreen();
    this.currentScreen = 'game';
    if (startNewGame) {
      this.pendingUnlockLevels = [];
      this.registerBoardCats(this.game.start());
    }
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
      () => { if (!this.inputLocked && !this.swipeGuideActive) this.confirmLeave(); });
    back.setPosition(-this.uiWidth / 2 + 62, hudY);
    root.addChild(back);
    const settings = createIconButton('Settings', this.art.frame(GAME_CONFIG.art.settings), '⚙', 76,
      () => { if (!this.inputLocked && !this.swipeGuideActive) this.showSettingsDialog(); }, BOTTOM_EDGE_ICON_CROP);
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
    } else {
      this.createCompactCollectionEntry(root, this.uiHeight / 2 - layout.hudCenterFromTop - 75);
    }

    const board = this.boardView.mount(root, BOARD_PIXELS);
    const boardY = this.uiHeight / 2 - layout.boardTop - BOARD_PIXELS * layout.boardScale / 2;
    board.setPosition(0, boardY);
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
    this.showSwipeGuideIfNeeded(root, boardY, BOARD_PIXELS * layout.boardScale);
    if (this.save.tutorial.swipeGuideCompleted && !this.showNextUnlockIfReady()
      && this.game.status === 'game-over') this.showGameOver();
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
    const collectionCount = this.save.unlockedCatLevels.length;
    const collection = createLabel(collectionCount === GAME_CONFIG.cats.length
      ? '全图鉴达成' : `图鉴 ${collectionCount}/${GAME_CONFIG.cats.length}`, compact ? 18 : 20,
      COLORS.teal, 160, 36, 'display');
    collection.node.setPosition(220, panelHeight / 2 - (compact ? 26 : 31));
    collection.node.on(Node.EventType.TOUCH_END, () => {
      if (!this.inputLocked && !this.swipeGuideActive) this.showCollection('game');
    });
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

  private createCompactCollectionEntry(root: Node, y: number): void {
    const entry = createUiNode('CompactCollectionEntry', 250, 44);
    drawRounded(entry, 250, 44, new Color(255, 248, 226, 240), 22,
      { color: COLORS.teal, width: 3 });
    entry.setPosition(0, y);
    const label = createLabel(`图鉴 ${this.save.unlockedCatLevels.length}/${GAME_CONFIG.cats.length}  ›`,
      19, COLORS.teal, 225, 38, 'display');
    entry.addChild(label.node);
    entry.on(Node.EventType.TOUCH_END, () => {
      if (!this.inputLocked && !this.swipeGuideActive) this.showCollection('game');
    });
    root.addChild(entry);
  }

  private createItemBar(root: Node, y: number): void {
    const bar = createUiNode('ItemBar', 650, 96);
    bar.setPosition(0, y);
    root.addChild(bar);

    const undo = this.createItemButton('undo', 'UndoItem', '撤回一步', '↶',
      () => { void this.useUndoItem(); });
    undo.node.setPosition(-167, 0);
    bar.addChild(undo.node);
    this.undoItem = undo;

    const remove = this.createItemButton('remove-lowest', 'RemoveLowestItem', '消除最低 ×3', '×3',
      () => { void this.useRemoveLowestItem(); });
    remove.node.setPosition(167, 0);
    bar.addChild(remove.node);
    this.removeLowestItem = remove;
    this.refreshItemButtons();
  }

  private createItemButton(kind: ItemKind, name: string, titleText: string, iconText: string,
    onUse: () => void): ItemButtonView {
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
      if (!this.canTapItem(kind) || this.inputLocked) return;
      tween(node).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
    node.on(Node.EventType.TOUCH_END, () => {
      if (!this.canTapItem(kind) || this.inputLocked) return;
      tween(node).to(0.08, { scale: Vec3.ONE }).call(() => {
        if (this.canUseItem(kind)) onUse();
        else void this.shareItemRefill(kind);
      }).start();
    });
    return { node, count, title, icon, baseTitle: titleText, baseIcon: iconText };
  }

  private refreshItemButtons(): void {
    const state = this.game.items;
    this.setItemButtonState(this.undoItem, state.canUndo, state.canRequestUndoRefill,
      state.undoRemaining, state.undoRefillRemaining);
    this.setItemButtonState(this.removeLowestItem, state.canRemoveLowest, state.canRequestRemoveLowestRefill,
      state.removeLowestRemaining, state.removeLowestRefillRemaining);
  }

  private setItemButtonState(view: ItemButtonView | null, canUse: boolean, canRefill: boolean,
    remaining: number, refillRemaining: number): void {
    if (!view) return;
    view.count.string = String(remaining);
    setLabelText(view.title, canRefill ? '分享补充' : view.baseTitle, 'display');
    for (const child of [...view.icon.children]) child.destroy();
    const shareFrame = canRefill ? this.art.frame(GAME_CONFIG.art.share) : undefined;
    if (shareFrame) view.icon.addChild(createSpriteNode(`${view.node.name}:Share`, shareFrame, 50, 50));
    else view.icon.addChild(createLabel(view.baseIcon, 29, COLORS.white, 60, 58, 'display').node);
    const opacity = view.node.getComponent(UIOpacity) ?? view.node.addComponent(UIOpacity);
    opacity.opacity = canUse || canRefill ? 255 : refillRemaining > 0 || remaining > 0 ? 145 : 90;
  }

  private canUseItem(kind: ItemKind): boolean {
    return kind === 'undo' ? this.game.items.canUndo : this.game.items.canRemoveLowest;
  }

  private canTapItem(kind: ItemKind): boolean {
    if (this.swipeGuideActive) return false;
    const state = this.game.items;
    return kind === 'undo'
      ? state.canUndo || state.canRequestUndoRefill
      : state.canRemoveLowest || state.canRequestRemoveLowestRefill;
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
    this.registerBoardCats(result.board);
    if (!this.save.tutorial.swipeGuideCompleted) this.completeSwipeGuide(false);
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
    if (!this.showNextUnlockIfReady() && result.status === 'game-over') this.showGameOver();
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
    this.showItemRefillGuideIfNeeded(this.undoItem);
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
    this.showItemRefillGuideIfNeeded(this.removeLowestItem);
  }

  private registerBoardCats(board: BoardSnapshot): void {
    const unlocked = new Set(this.save.unlockedCatLevels);
    const newLevels = [...new Set(board.tiles.map((tile) => tile.level))]
      .filter((level) => !unlocked.has(level))
      .sort((a, b) => a - b);
    if (newLevels.length === 0) return;
    for (const level of newLevels) unlocked.add(level);
    this.save = {
      ...this.save,
      unlockedCatLevels: [...unlocked].sort((a, b) => a - b),
    };
    runtimeStorage.save(this.save);
    for (const level of newLevels) {
      if (!this.pendingUnlockLevels.includes(level)) this.pendingUnlockLevels.push(level);
    }
  }

  private showNextUnlockIfReady(): boolean {
    if (!this.save.tutorial.swipeGuideCompleted || !this.screenRoot || this.currentScreen !== 'game') return false;
    const level = this.pendingUnlockLevels.shift();
    if (!level) return false;
    const isFirstCollectionGuide = !this.save.tutorial.collectionGuideCompleted;
    if (isFirstCollectionGuide) {
      this.save = {
        ...this.save,
        tutorial: { ...this.save.tutorial, collectionGuideCompleted: true },
      };
      runtimeStorage.save(this.save);
    }
    this.inputLocked = true;
    this.collectionView.showUnlock(this.screenRoot, this.uiWidth, this.uiHeight, level,
      isFirstCollectionGuide, {
        onContinue: () => {
          if (this.currentScreen !== 'game') return;
          this.inputLocked = false;
          if (!this.showNextUnlockIfReady() && this.game.status === 'game-over') this.showGameOver();
        },
        onViewCollection: () => this.showCollection('game'),
      });
    return true;
  }

  private showSwipeGuideIfNeeded(root: Node, boardY: number, boardSize: number): void {
    if (this.save.tutorial.swipeGuideCompleted) return;
    this.swipeGuideActive = true;
    this.tutorialView.showSwipe(root, this.uiWidth, this.uiHeight, boardY, boardSize,
      () => this.completeSwipeGuide(true));
  }

  private completeSwipeGuide(showPendingUnlock: boolean): void {
    if (this.save.tutorial.swipeGuideCompleted) return;
    this.save = {
      ...this.save,
      tutorial: { ...this.save.tutorial, swipeGuideCompleted: true },
    };
    runtimeStorage.save(this.save);
    this.swipeGuideActive = false;
    this.tutorialView.dismissSwipe();
    if (showPendingUnlock) this.showNextUnlockIfReady();
  }

  private showItemRefillGuideIfNeeded(item: ItemButtonView | null): void {
    if (!item || this.save.tutorial.itemRefillGuideCompleted || this.currentScreen !== 'game') return;
    this.save = {
      ...this.save,
      tutorial: { ...this.save.tutorial, itemRefillGuideCompleted: true },
    };
    runtimeStorage.save(this.save);
    this.tutorialView.showItemRefillHint(this.screenRoot ?? item.node.parent ?? item.node, item.node, this.uiHeight);
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
    if (this.gameOverOverlay?.isValid) return;
    this.inputLocked = true;
    this.updateScore(this.game.score);
    this.audio.play('game_over', 0.8);
    if (!this.screenRoot) return;
    this.gameOverOverlay = this.gameOverDialog.show(this.screenRoot, {
      score: this.game.score,
      bestScore: this.save.highScore,
      canRevive: this.game.reviveState.canRevive,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
    }, {
      onHome: () => { if (!this.shareInProgress) this.showHome(); },
      onReplay: () => { if (!this.shareInProgress) this.startGame(); },
      onShareScore: () => { void this.shareResult(); },
      onRevive: () => { void this.shareRevive(); },
    });
  }

  private async shareResult(): Promise<void> {
    await this.shareCurrentGame('score');
  }

  private async shareItemRefill(kind: ItemKind): Promise<void> {
    if (this.inputLocked || !this.canTapItem(kind)) return;
    const canRefill = kind === 'undo'
      ? this.game.items.canRequestUndoRefill
      : this.game.items.canRequestRemoveLowestRefill;
    if (!canRefill) return;
    this.inputLocked = true;
    const purpose: SharePurpose = kind === 'undo' ? 'undo-refill' : 'remove-lowest-refill';
    const result = await this.shareCurrentGame(purpose);
    if (this.currentScreen !== 'game' || !this.boardView.root) return;
    if (result === 'shared') this.game.refillItem(kind);
    this.refreshItemButtons();
    this.inputLocked = false;
  }

  private async shareRevive(): Promise<void> {
    if (this.shareInProgress || !this.game.reviveState.canRevive || !this.boardView.root) return;
    const result = await this.shareCurrentGame('revive');
    if (result !== 'shared' || this.currentScreen !== 'game' || !this.boardView.root) return;
    const revived = this.game.revive();
    if (!revived.revived || !revived.changed) return;

    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = null;
    const token = this.sceneToken;
    this.haptics.light();
    this.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      revived.removedTileIds,
      () => token === this.sceneToken && this.boardView.root !== null,
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.boardView.rebuild(revived.board, false);
    this.refreshEvolutionPanel();
    this.refreshItemButtons();
    this.inputLocked = false;
  }

  private async shareCurrentGame(purpose: SharePurpose): Promise<ShareResult | null> {
    if (this.shareInProgress || !this.screenRoot) return null;
    const shareRoot = this.screenRoot;
    const token = this.sceneToken;
    const highestLevel = this.game.board.tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
    const cat = GAME_CONFIG.cats[highestLevel - 1];
    const backgroundPath = this.art.imagePath(GAME_CONFIG.art.shareScoreBackground);
    const catPath = this.art.imagePath(cat.asset);
    if (!backgroundPath || !catPath) {
      this.dialogs.showNotice(this.screenRoot, '分享卡片素材暂不可用');
      return 'failed';
    }

    this.shareInProgress = true;
    const result = await this.resultShare.share({
      purpose,
      score: this.game.score,
      bestScore: this.save.highScore,
      catLevel: highestLevel,
      catName: cat.name,
      backgroundPath,
      catPath,
    });
    this.shareInProgress = false;
    if (token !== this.sceneToken || this.screenRoot !== shareRoot) return null;
    if (result === 'shared') return result;
    this.dialogs.showNotice(shareRoot, result === 'unsupported'
      ? '请在微信小游戏中分享给好友或群'
      : '分享卡片生成失败，请稍后重试');
    return result;
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
    const value = createLabel(valueText, 34, COLORS.ink, 178, 48, 'display');
    value.enableWrapText = false;
    value.overflow = Label.Overflow.CLAMP;
    value.node.setPosition(0, -15);
    node.addChild(value.node);
    return { node, value };
  }

  private clearScreen(): void {
    Tween.stopAll();
    this.tutorialView.dismissSwipe();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.swipeGuideActive = false;
    this.shareInProgress = false;
    // Unbind first so late touch-cancel/end cannot fire after the board is gone.
    this.swipe?.unbind();
    this.swipe = null;
    this.boardView.unmount();
    this.scoreLabel = null;
    this.highScoreLabel = null;
    this.evolutionPanel = null;
    this.undoItem = null;
    this.removeLowestItem = null;
    this.gameOverOverlay = null;
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
