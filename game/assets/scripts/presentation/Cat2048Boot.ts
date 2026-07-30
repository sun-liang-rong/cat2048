import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  Graphics,
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
import { RuntimeRandomSource, runtimeStorage } from '../infrastructure/runtime';
import type { SaveDataV1 } from '../infrastructure/storage';
import { ArtRepository } from './ArtRepository';
import { AudioController } from './AudioController';
import { BoardView } from './BoardView';
import { BOARD_PIXELS } from './boardGeometry';
import {
  capsuleBottomInset,
  gameLayout,
  homeContentShift,
  safeInsetsFromRect,
} from './layout';
import { DialogView } from './DialogView';
import { SettingsPanel } from './SettingsPanel';
import { SwipeInput } from './SwipeInput';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
  setDisplayFont,
} from './uiFactory';

const { ccclass } = _decorator;

const BOTTOM_EDGE_ICON_CROP = { x: 4, y: 0, width: 144, height: 144 } as const;
const TOP_EDGE_ICON_CROP = { x: 4, y: 16, width: 144, height: 144 } as const;

@ccclass('Cat2048Boot')
export class Cat2048Boot extends Component {
  private readonly art = new ArtRepository();
  private readonly boardView = new BoardView(this.art);
  private readonly game = new Game2048(new RuntimeRandomSource());
  private readonly haptics = new HapticController();
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
    this.addBackground(root, GAME_CONFIG.art.homeBackground, new Color(250, 229, 193, 255));

    this.addHomeHeader(root);
    this.addHomeCatShowcase(root);

    const playShadow = createUiNode('PlayButtonShadow', 500, 104);
    drawRounded(playShadow, 500, 104, new Color(117, 63, 47, 145), 30);
    playShadow.setPosition(0, this.homeTopY(718) - 9);
    root.addChild(playShadow);
    const play = createButton('开始经典模式', 500, 104, COLORS.coral, () => this.startGame(), 36,
      this.art.frame(GAME_CONFIG.art.check));
    play.setPosition(0, this.homeTopY(710));
    root.addChild(play);
    play.setScale(0.96, 0.96, 1);
    tween(play).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start();

    const hint = createLabel('滑动合成  ·  轻松上手', 22, new Color(90, 72, 64, 220), 500, 50);
    hint.node.setPosition(0, this.homeTopY(790));
    root.addChild(hint.node);

    this.addHomeActionDock(root);
  }

  private addHomeHeader(root: Node): void {
    const kicker = createUiNode('HomeKicker', 300, 48);
    drawRounded(kicker, 300, 48, new Color(39, 166, 151, 235), 24);
    kicker.setPosition(0, this.homeTopY(88));
    const kickerText = createLabel('治愈系 · 合成小游戏', 21, COLORS.white, 270, 42, 'display');
    kicker.addChild(kickerText.node);
    root.addChild(kicker);

    const titleGroup = createUiNode('HomeTitle', 600, 104);
    titleGroup.setPosition(0, this.homeTopY(166));
    const catTitle = createLabel('猫咪', 78, COLORS.ink, 300, 100, 'display');
    catTitle.node.setPosition(-105, 0);
    titleGroup.addChild(catTitle.node);

    const numberShadow = createUiNode('TitleNumberShadow', 230, 88);
    drawRounded(numberShadow, 230, 88, new Color(111, 61, 47, 150), 28);
    numberShadow.setPosition(145, -7);
    titleGroup.addChild(numberShadow);
    const numberBadge = createUiNode('TitleNumberBadge', 230, 88);
    drawRounded(numberBadge, 230, 88, COLORS.coral, 28, { color: COLORS.ink, width: 4 });
    numberBadge.setPosition(145, 0);
    const number = createLabel('2048', 58, COLORS.white, 205, 76, 'display');
    numberBadge.addChild(number.node);
    titleGroup.addChild(numberBadge);
    root.addChild(titleGroup);

    const subtitle = createLabel('两只相同猫咪，碰出一个新伙伴', 27, new Color(76, 61, 54, 240), 620, 54);
    subtitle.node.setPosition(0, this.homeTopY(242));
    root.addChild(subtitle.node);
  }

  private addHomeCatShowcase(root: Node): void {
    const showcase = createUiNode('CatShowcase', 620, 360);
    showcase.setPosition(0, this.homeTopY(452));

    const shadow = createUiNode('CatShowcaseShadow', 620, 360);
    drawRounded(shadow, 620, 360, new Color(109, 72, 47, 75), 40);
    shadow.setPosition(0, -10);
    showcase.addChild(shadow);
    const card = createUiNode('CatShowcaseCard', 620, 360);
    drawRounded(card, 620, 360, new Color(255, 249, 230, 235), 40,
      { color: new Color(77, 61, 54, 235), width: 4 });
    showcase.addChild(card);

    const goal = createUiNode('GoalBadge', 116, 42);
    drawRounded(goal, 116, 42, new Color(245, 180, 54, 245), 21);
    goal.setPosition(228, 146);
    const goalText = createLabel('进化目标', 18, COLORS.ink, 105, 36, 'display');
    goal.addChild(goalText.node);
    card.addChild(goal);

    const haloFrame = this.art.frame(GAME_CONFIG.art.maxHalo);
    const galaxyFrame = this.art.frame(GAME_CONFIG.cats[8].asset);
    const orangeFrame = this.art.frame(GAME_CONFIG.cats[0].asset);
    if (orangeFrame) {
      const orange = createSpriteNode('HomeOrangeCat', orangeFrame, 195, 195);
      orange.setPosition(-158, 48);
      orange.setRotationFromEuler(0, 0, -4);
      card.addChild(orange);
      tween(orange).to(1.25, { position: new Vec3(-158, 55, 0) }, { easing: 'sineInOut' })
        .to(1.25, { position: new Vec3(-158, 48, 0) }, { easing: 'sineInOut' }).union().repeatForever().start();
    }
    if (haloFrame) {
      const halo = createSpriteNode('HomeGalaxyHalo', haloFrame, 230, 230);
      halo.setPosition(158, 50);
      card.addChild(halo);
      tween(halo).by(8, { angle: 360 }).repeatForever().start();
    }
    if (galaxyFrame) {
      const galaxy = createSpriteNode('HomeGalaxyCat', galaxyFrame, 202, 202);
      galaxy.setPosition(158, 48);
      galaxy.setRotationFromEuler(0, 0, 4);
      card.addChild(galaxy);
      tween(galaxy).to(1.1, { scale: new Vec3(1.04, 1.04, 1) }, { easing: 'sineInOut' })
        .to(1.1, { scale: Vec3.ONE }, { easing: 'sineInOut' }).union().repeatForever().start();
    }

    const evolution = createUiNode('EvolutionBadge', 76, 76);
    drawRounded(evolution, 76, 76, new Color(255, 255, 255, 240), 38,
      { color: COLORS.teal, width: 4 });
    evolution.setPosition(0, 50);
    const arrow = createLabel('›', 58, COLORS.teal, 62, 66);
    arrow.node.setPosition(3, 3);
    evolution.addChild(arrow.node);
    card.addChild(evolution);
    const evolveText = createLabel('不断进化', 18, COLORS.teal, 130, 34, 'display');
    evolveText.node.setPosition(0, -4);
    card.addChild(evolveText.node);

    const orangeName = this.createHomePill('Lv.1  橘猫', 182, COLORS.teal);
    orangeName.setPosition(-158, -62);
    card.addChild(orangeName);
    const galaxyName = this.createHomePill('Lv.9  银河猫', 202, new Color(117, 87, 184, 255));
    galaxyName.setPosition(158, -62);
    card.addChild(galaxyName);

    const scoreStrip = createUiNode('HighScoreStrip', 554, 66);
    drawRounded(scoreStrip, 554, 66, new Color(248, 225, 181, 215), 24);
    scoreStrip.setPosition(0, -137);
    const scoreTitle = createLabel('★  我的最高分', 22, COLORS.teal, 240, 48, 'display');
    scoreTitle.node.setPosition(-138, 0);
    scoreStrip.addChild(scoreTitle.node);
    const score = createLabel(String(this.save.highScore), 38, COLORS.ink, 225, 52, 'display');
    score.node.setPosition(140, 0);
    scoreStrip.addChild(score.node);
    card.addChild(scoreStrip);

    const sparkleFrame = this.art.frame(GAME_CONFIG.art.sparkleSmall);
    if (sparkleFrame) {
      const sparkle = createSpriteNode('HomeSparkle', sparkleFrame, 55, 55);
      sparkle.setPosition(47, 95);
      card.addChild(sparkle);
      tween(sparkle).to(0.8, { scale: new Vec3(1.22, 1.22, 1) })
        .to(0.8, { scale: new Vec3(0.75, 0.75, 1) }).union().repeatForever().start();
    }
    root.addChild(showcase);
    showcase.setScale(0.96, 0.96, 1);
    tween(showcase).to(0.25, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  }

  private createHomePill(text: string, width: number, color: Color): Node {
    const pill = createUiNode(`HomePill:${text}`, width, 44);
    drawRounded(pill, width, 44, color, 22);
    const label = createLabel(text, 19, COLORS.white, width - 18, 38, 'display');
    pill.addChild(label.node);
    return pill;
  }

  private addHomeActionDock(root: Node): void {
    const dockY = -this.uiHeight / 2 + this.bottomSafeInset() + 82;
    const shadow = createUiNode('HomeDockShadow', 610, 112);
    drawRounded(shadow, 610, 112, new Color(91, 58, 40, 80), 34);
    shadow.setPosition(0, dockY - 8);
    root.addChild(shadow);
    const dock = createUiNode('HomeActionDock', 610, 112);
    drawRounded(dock, 610, 112, new Color(255, 249, 230, 238), 34,
      { color: new Color(77, 61, 54, 220), width: 4 });
    dock.setPosition(0, dockY);
    root.addChild(dock);

    const info = createIconButton('Info', this.art.frame(GAME_CONFIG.art.info), 'i', 64,
      () => this.showInfoDialog(), BOTTOM_EDGE_ICON_CROP);
    info.setPosition(-198, 13);
    dock.addChild(info);
    const infoText = createLabel('玩法', 18, COLORS.ink, 100, 28, 'display');
    infoText.node.setPosition(-198, -38);
    dock.addChild(infoText.node);

    const sound = createIconButton('SoundToggle', this.art.frame(this.save.soundEnabled
      ? GAME_CONFIG.art.soundOn : GAME_CONFIG.art.soundOff), this.save.soundEnabled ? '♪' : '×', 64,
      () => this.toggleSound(), this.save.soundEnabled ? TOP_EDGE_ICON_CROP : BOTTOM_EDGE_ICON_CROP);
    sound.setPosition(0, 13);
    dock.addChild(sound);
    const soundText = createLabel(this.save.soundEnabled ? '音效开' : '音效关', 18, COLORS.ink, 110, 28, 'display');
    soundText.node.setPosition(0, -38);
    dock.addChild(soundText.node);

    const settings = createIconButton('Settings', this.art.frame(GAME_CONFIG.art.settings), '⚙', 64,
      () => this.showSettingsDialog(), BOTTOM_EDGE_ICON_CROP);
    settings.setPosition(198, 13);
    dock.addChild(settings);
    const settingsText = createLabel('设置', 18, COLORS.ink, 100, 28, 'display');
    settingsText.node.setPosition(198, -38);
    dock.addChild(settingsText.node);

    const dividerColor = new Color(77, 61, 54, 55);
    for (const x of [-99, 99]) {
      const divider = createUiNode(`DockDivider:${x}`, 2, 66);
      drawRounded(divider, 2, 66, dividerColor, 1);
      divider.setPosition(x, 0);
      dock.addChild(divider);
    }
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
    this.addBackground(root, GAME_CONFIG.art.pageBackground, new Color(249, 235, 206, 255));

    const layout = gameLayout(this.uiWidth, this.uiHeight, this.topSafeInset(), this.bottomSafeInset(), BOARD_PIXELS);
    const hudY = this.uiHeight / 2 - layout.hudCenterFromTop;
    const back = createIconButton('Back', this.art.frame(GAME_CONFIG.art.back), '‹', 76,
      () => { if (!this.inputLocked) this.confirmLeave(); });
    back.setPosition(-this.uiWidth / 2 + 62, hudY);
    root.addChild(back);
    const restart = createIconButton('Restart', this.art.frame(GAME_CONFIG.art.settings), '↻', 76,
      () => { if (!this.inputLocked) this.confirmRestart(); }, BOTTOM_EDGE_ICON_CROP);
    restart.setPosition(this.uiWidth / 2 - 62, hudY);
    root.addChild(restart);

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

  private confirmRestart(): void {
    this.showDialog('重新开始？', '当前棋盘进度将会丢失。', '继续游戏', '重新开始', () => this.startGame());
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
        this.showHome();
      },
    });
  }

  private showGameOver(): void {
    this.inputLocked = true;
    this.updateScore(this.game.score);
    this.audio.play('game_over', 0.8);
    this.showDialog('猫咪挤满啦', `本局得分  ${this.game.score}
最高分  ${this.save.highScore}`, '返回主页', '再玩一局',
      () => this.startGame(), () => this.showHome());
  }

  private showDialog(titleText: string, bodyText: string, cancelText: string, confirmText: string,
    onConfirm: () => void, onCancel?: () => void): void {
    if (!this.screenRoot) return;
    this.inputLocked = true;
    this.dialogs.show(this.screenRoot, titleText, bodyText, cancelText, confirmText, {
      onConfirm,
      onCancel: () => {
        this.inputLocked = false;
        onCancel?.();
      },
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

  private addBackground(root: Node, path: string, fallback: Color): void {
    const frame = this.art.frame(path);
    if (frame) {
      const textureWidth = Math.max(1, frame.texture.width);
      const textureHeight = Math.max(1, frame.texture.height);
      const coverScale = Math.max(this.uiWidth / textureWidth, this.uiHeight / textureHeight);
      const background = createSpriteNode('Background', frame, textureWidth * coverScale, textureHeight * coverScale);
      root.addChild(background);
      background.setSiblingIndex(0);
    } else {
      const node = createUiNode('Background', this.uiWidth, this.uiHeight);
      const graphics = node.addComponent(Graphics);
      graphics.fillColor = fallback;
      graphics.rect(-this.uiWidth / 2, -this.uiHeight / 2, this.uiWidth, this.uiHeight);
      graphics.fill();
      root.addChild(node);
      node.setSiblingIndex(0);
    }
  }

  private clearScreen(): void {
    Tween.stopAll();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.swipe?.reset();
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

  private homeTopY(offsetFromTop: number): number {
    const shift = homeContentShift(this.uiHeight, this.topSafeInset(), this.bottomSafeInset());
    return this.uiHeight / 2 - this.topSafeInset() - offsetFromTop - shift;
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
