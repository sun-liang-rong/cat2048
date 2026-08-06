import { Color, Graphics, Label, Node, tween, Vec3 } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import { addCoverBackground } from './background';
import { homeActionDockPositions, homeContentShift, spriteCropTransform } from './layout';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from './uiFactory';

const BOTTOM_EDGE_ICON_CROP = { x: 4, y: 0, width: 144, height: 144 } as const;
const TOP_EDGE_ICON_CROP = { x: 4, y: 16, width: 144, height: 144 } as const;
const SOUND_BUTTON_SIZE = 64;

export interface HomeViewModel {
  highScore: number;
  collectionCount: number;
  coins: number;
  canClaimDaily: boolean;
  dailyReward: number;
  soundEnabled: boolean;
  uiWidth: number;
  uiHeight: number;
  topInset: number;
  bottomInset: number;
}

export interface HomeViewActions {
  onPlay(): void;
  onInfo(): void;
  onCollection(): void;
  onLeaderboard(): void;
  onShop(): void;
  onDailyReward(): void;
  onToggleSound(): void;
  onSettings(): void;
}

export class HomeView {
  private soundButton: Node | null = null;
  private soundLabel: Label | null = null;

  public constructor(private readonly art: ArtRepository) {}

  /** 局部刷新音效按钮，避免整页重建。 */
  public setSoundEnabled(enabled: boolean): void {
    const button = this.soundButton;
    const label = this.soundLabel;
    if (!button?.isValid || !label?.isValid) return;
    for (const child of [...button.children]) child.destroy();
    button.getComponent(Graphics)?.destroy();
    const frame = this.art.frame(enabled ? GAME_CONFIG.art.soundOn : GAME_CONFIG.art.soundOff);
    if (frame) {
      const transform = spriteCropTransform(SOUND_BUTTON_SIZE, frame.originalSize.width, frame.originalSize.height,
        enabled ? TOP_EDGE_ICON_CROP : BOTTOM_EDGE_ICON_CROP);
      const icon = createSpriteNode('SoundToggle:Icon', frame, transform.width, transform.height);
      icon.setPosition(transform.x, transform.y);
      button.addChild(icon);
    } else {
      drawRounded(button, SOUND_BUTTON_SIZE, SOUND_BUTTON_SIZE, new Color(255, 248, 226, 235),
        SOUND_BUTTON_SIZE / 2, { color: COLORS.ink, width: 4 });
      const fallback = createLabel(enabled ? '♪' : '×', SOUND_BUTTON_SIZE * 0.5, COLORS.ink,
        SOUND_BUTTON_SIZE * 0.8, SOUND_BUTTON_SIZE * 0.8);
      button.addChild(fallback.node);
    }
    label.string = enabled ? '音效开' : '音效关';
  }

  public build(parent: Node, model: HomeViewModel, actions: HomeViewActions): void {
    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.homeBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(250, 229, 193, 255),
    );

    this.addHomeHeader(parent, model);
    this.addHomeWallet(parent, model, actions);
    this.addHomeCatShowcase(parent, model);

    const playShadow = createUiNode('PlayButtonShadow', 568, 112);
    drawRounded(playShadow, 568, 112, new Color(117, 63, 47, 155), 32);
    playShadow.setPosition(0, this.homeTopY(model, 710) - 10);
    parent.addChild(playShadow);
    const playGlow = createUiNode('PlayButtonGlow', 588, 130);
    drawRounded(playGlow, 588, 130, new Color(239, 100, 83, 56), 36);
    playGlow.setPosition(0, this.homeTopY(model, 710));
    parent.addChild(playGlow);
    const play = createButton('开始经典模式', 500, 104, COLORS.coral, () => actions.onPlay(), 36,
      this.art.frame(GAME_CONFIG.art.classicMode));
    play.setPosition(0, this.homeTopY(model, 710));
    parent.addChild(play);
    play.setScale(1.02, 1.02, 1);
    tween(play).to(0.24, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'backOut' }).start();

    const leaderboardShadow = createUiNode('LeaderboardButtonShadow', 516, 88);
    drawRounded(leaderboardShadow, 516, 88, new Color(117, 63, 47, 130), 26);
    leaderboardShadow.setPosition(0, this.homeTopY(model, 842) - 8);
    parent.addChild(leaderboardShadow);
    const leaderboard = createButton('排行榜', 500, 76, COLORS.teal,
      () => actions.onLeaderboard(), 30);
    leaderboard.setPosition(0, this.homeTopY(model, 842));
    parent.addChild(leaderboard);

    const hint = createLabel('滑动合成  ·  轻松上手', 22, new Color(90, 72, 64, 220), 500, 50);
    hint.node.setPosition(0, this.homeTopY(model, 928));
    hint.node.setScale(0.9, 0.9, 1);
    parent.addChild(hint.node);

    this.addHomeActionDock(parent, model, actions);
  }

  private addHomeWallet(root: Node, model: HomeViewModel, actions: HomeViewActions): void {
    const text = model.canClaimDaily
      ? `领取 +${model.dailyReward}`
      : `金币 ${model.coins}`;
    const wallet = createButton(text, 220, 62, model.canClaimDaily ? COLORS.coral : COLORS.mustard,
      () => actions.onDailyReward(), 22, this.art.frame(GAME_CONFIG.art.coin));
    wallet.setPosition(0, this.homeTopY(model, 302));
    root.addChild(wallet);
    if (model.canClaimDaily) {
      tween(wallet).to(0.75, { scale: new Vec3(1.06, 1.06, 1) })
        .to(0.75, { scale: Vec3.ONE }).union().repeatForever().start();
    }
  }

  private addHomeHeader(root: Node, model: HomeViewModel): void {
    const kicker = createUiNode('HomeKicker', 248, 38);
    drawRounded(kicker, 248, 38, new Color(39, 166, 151, 238), 19);
    kicker.setPosition(0, this.homeTopY(model, 78));
    const kickerText = createLabel('治愈系 · 合成小游戏', 21, COLORS.white, 270, 42, 'display');
    kickerText.node.setScale(0.84, 0.84, 1);
    kicker.addChild(kickerText.node);
    root.addChild(kicker);

    const titleGroup = createUiNode('HomeTitle', 650, 118);
    titleGroup.setPosition(0, this.homeTopY(model, 154));
    const catTitle = createLabel('猫咪', 78, COLORS.ink, 300, 100, 'display');
    catTitle.node.setPosition(-130, 0);
    catTitle.node.setScale(1.1, 1.1, 1);
    titleGroup.addChild(catTitle.node);

    const numberShadow = createUiNode('TitleNumberShadow', 248, 94);
    drawRounded(numberShadow, 248, 94, new Color(111, 61, 47, 150), 30);
    numberShadow.setPosition(152, -8);
    titleGroup.addChild(numberShadow);
    const numberBadge = createUiNode('TitleNumberBadge', 248, 94);
    drawRounded(numberBadge, 248, 94, COLORS.coral, 30, { color: COLORS.ink, width: 4 });
    numberBadge.setPosition(152, 0);
    const number = createLabel('2048', 64, COLORS.white, 220, 80, 'display');
    numberBadge.addChild(number.node);
    titleGroup.addChild(numberBadge);
    root.addChild(titleGroup);

    const titleRule = createUiNode('HomeTitleRule', 430, 4);
    drawRounded(titleRule, 430, 4, new Color(39, 166, 151, 145), 2);
    titleRule.setPosition(0, this.homeTopY(model, 218));
    root.addChild(titleRule);

    const subtitle = createLabel('两只相同猫咪，碰出一个新伙伴', 27, new Color(76, 61, 54, 240), 620, 54);
    subtitle.node.setPosition(0, this.homeTopY(model, 246));
    subtitle.node.setScale(0.9, 0.9, 1);
    root.addChild(subtitle.node);
  }

  private addHomeCatShowcase(root: Node, model: HomeViewModel): void {
    const showcase = createUiNode('CatShowcase', 650, 330);
    showcase.setPosition(0, this.homeTopY(model, 432));

    const shadow = createUiNode('CatShowcaseShadow', 650, 330);
    drawRounded(shadow, 650, 330, new Color(109, 72, 47, 88), 36);
    shadow.setPosition(0, -12);
    showcase.addChild(shadow);
    const card = createUiNode('CatShowcaseCard', 650, 330);
    drawRounded(card, 650, 330, new Color(255, 249, 230, 242), 36,
      { color: new Color(77, 61, 54, 235), width: 4 });
    showcase.addChild(card);

    const goal = createUiNode('GoalBadge', 126, 40);
    drawRounded(goal, 126, 40, new Color(245, 180, 54, 245), 20);
    goal.setPosition(238, 132);
    const goalText = createLabel('进化目标', 18, COLORS.ink, 105, 36, 'display');
    goalText.node.setScale(0.94, 0.94, 1);
    goal.addChild(goalText.node);
    card.addChild(goal);

    const path = createUiNode('EvolutionPath', 402, 6);
    drawRounded(path, 402, 6, new Color(39, 166, 151, 105), 3);
    path.setPosition(0, 42);
    card.addChild(path);
    for (const x of [-120, 120]) {
      const marker = createUiNode(`EvolutionMarker:${x}`, 16, 16);
      drawRounded(marker, 16, 16, COLORS.mustard, 8, { color: COLORS.teal, width: 2 });
      marker.setPosition(x, 42);
      card.addChild(marker);
    }

    const haloFrame = this.art.frame(GAME_CONFIG.art.maxHalo);
    const finalCat = GAME_CONFIG.cats[GAME_CONFIG.cats.length - 1];
    const galaxyFrame = this.art.frame(finalCat.asset);
    const orangeFrame = this.art.frame(GAME_CONFIG.cats[0].asset);
    if (orangeFrame) {
      const orange = createSpriteNode('HomeOrangeCat', orangeFrame, 206, 206);
      orange.setPosition(-176, 45);
      orange.setRotationFromEuler(0, 0, -4);
      card.addChild(orange);
      tween(orange).to(1.25, { position: new Vec3(-176, 52, 0) }, { easing: 'sineInOut' })
        .to(1.25, { position: new Vec3(-176, 45, 0) }, { easing: 'sineInOut' }).union().repeatForever().start();
    }
    if (haloFrame) {
      const halo = createSpriteNode('HomeGalaxyHalo', haloFrame, 240, 240);
      halo.setPosition(176, 48);
      card.addChild(halo);
      tween(halo).by(8, { angle: 360 }).repeatForever().start();
    }
    if (galaxyFrame) {
      const galaxy = createSpriteNode('HomeGalaxyCat', galaxyFrame, 214, 214);
      galaxy.setPosition(176, 45);
      galaxy.setRotationFromEuler(0, 0, 4);
      card.addChild(galaxy);
      tween(galaxy).to(1.1, { scale: new Vec3(1.04, 1.04, 1) }, { easing: 'sineInOut' })
        .to(1.1, { scale: Vec3.ONE }, { easing: 'sineInOut' }).union().repeatForever().start();
    }

    const evolution = createUiNode('EvolutionBadge', 82, 82);
    drawRounded(evolution, 82, 82, new Color(255, 255, 255, 245), 41,
      { color: COLORS.teal, width: 4 });
    evolution.setPosition(0, 42);
    const arrow = createLabel('›', 58, COLORS.teal, 62, 66);
    arrow.node.setPosition(3, 3);
    evolution.addChild(arrow.node);
    card.addChild(evolution);
    const evolveText = createLabel('不断进化', 18, COLORS.teal, 130, 34, 'display');
    evolveText.node.setPosition(0, -10);
    card.addChild(evolveText.node);

    const orangeName = this.createHomePill('Lv.1  橘猫', 182, COLORS.teal);
    orangeName.setPosition(-176, -68);
    card.addChild(orangeName);
    const galaxyName = this.createHomePill(`Lv.${finalCat.level}  ${finalCat.name}`, 254, new Color(117, 87, 184, 255));
    galaxyName.setPosition(176, -68);
    card.addChild(galaxyName);

    const scoreStrip = createUiNode('HighScoreStrip', 582, 58);
    drawRounded(scoreStrip, 582, 58, new Color(248, 225, 181, 232), 20,
      { color: new Color(77, 61, 54, 70), width: 2 });
    scoreStrip.setPosition(0, -126);
    const scoreTitle = createLabel('★  我的最高分', 22, COLORS.teal, 240, 48, 'display');
    scoreTitle.node.setPosition(-150, 0);
    scoreStrip.addChild(scoreTitle.node);
    const score = createLabel(String(model.highScore), 38, COLORS.ink, 225, 52, 'display');
    score.node.setPosition(150, 0);
    scoreStrip.addChild(score.node);
    card.addChild(scoreStrip);

    const sparkleFrame = this.art.frame(GAME_CONFIG.art.sparkleSmall);
    if (sparkleFrame) {
      const sparkle = createSpriteNode('HomeSparkle', sparkleFrame, 55, 55);
      sparkle.setPosition(58, 104);
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

  private addHomeActionDock(root: Node, model: HomeViewModel, actions: HomeViewActions): void {
    const dockY = -model.uiHeight / 2 + model.bottomInset + 78;
    const shadow = createUiNode('HomeDockShadow', 710, 106);
    drawRounded(shadow, 710, 106, new Color(91, 58, 40, 92), 28);
    shadow.setPosition(0, dockY - 7);
    root.addChild(shadow);
    const dock = createUiNode('HomeActionDock', 710, 106);
    drawRounded(dock, 710, 106, new Color(255, 249, 230, 242), 28,
      { color: new Color(77, 61, 54, 210), width: 4 });
    dock.setPosition(0, dockY);
    root.addChild(dock);

    const positions = homeActionDockPositions(5);
    const info = createIconButton('Info', this.art.frame(GAME_CONFIG.art.info), 'i', 64,
      () => actions.onInfo(), BOTTOM_EDGE_ICON_CROP);
    info.setPosition(positions[0], 11);
    dock.addChild(info);
    const infoText = createLabel('玩法', 18, COLORS.ink, 100, 28, 'display');
    infoText.node.setPosition(positions[0], -36);
    dock.addChild(infoText.node);

    const collection = createIconButton('Collection', this.art.frame(GAME_CONFIG.art.collection), '图', 64,
      () => actions.onCollection());
    collection.setPosition(positions[1], 11);
    dock.addChild(collection);
    const collectionText = createLabel(`图鉴 ${model.collectionCount}/${GAME_CONFIG.cats.length}`, 17, COLORS.ink, 140, 28, 'display');
    collectionText.node.setPosition(positions[1], -36);
    dock.addChild(collectionText.node);

    const shop = createIconButton('Shop', this.art.frame(GAME_CONFIG.art.coin), '商', 64,
      () => actions.onShop());
    shop.setPosition(positions[2], 11);
    dock.addChild(shop);
    const shopText = createLabel('商店', 18, COLORS.ink, 100, 28, 'display');
    shopText.node.setPosition(positions[2], -36);
    dock.addChild(shopText.node);

    const sound = createIconButton('SoundToggle', this.art.frame(model.soundEnabled
      ? GAME_CONFIG.art.soundOn : GAME_CONFIG.art.soundOff), model.soundEnabled ? '♪' : '×', 64,
      () => actions.onToggleSound(), model.soundEnabled ? TOP_EDGE_ICON_CROP : BOTTOM_EDGE_ICON_CROP);
    sound.setPosition(positions[3], 11);
    dock.addChild(sound);
    this.soundButton = sound;
    const soundText = createLabel(model.soundEnabled ? '音效开' : '音效关', 18, COLORS.ink, 110, 28, 'display');
    soundText.node.setPosition(positions[3], -36);
    dock.addChild(soundText.node);
    this.soundLabel = soundText;

    const settings = createIconButton('Settings', this.art.frame(GAME_CONFIG.art.settings), '⚙', 64,
      () => actions.onSettings(), BOTTOM_EDGE_ICON_CROP);
    settings.setPosition(positions[4], 11);
    dock.addChild(settings);
    const settingsText = createLabel('设置', 18, COLORS.ink, 100, 28, 'display');
    settingsText.node.setPosition(positions[4], -36);
    dock.addChild(settingsText.node);

    const dividerColor = new Color(77, 61, 54, 55);
    for (let index = 0; index < positions.length - 1; index += 1) {
      const x = (positions[index] + positions[index + 1]) / 2;
      const divider = createUiNode(`DockDivider:${x}`, 2, 60);
      drawRounded(divider, 2, 60, dividerColor, 1);
      divider.setPosition(x, 0);
      dock.addChild(divider);
    }
  }

  private homeTopY(model: HomeViewModel, offsetFromTop: number): number {
    const shift = homeContentShift(model.uiHeight, model.topInset, model.bottomInset);
    return model.uiHeight / 2 - model.topInset - offsetFromTop - shift;
  }
}
