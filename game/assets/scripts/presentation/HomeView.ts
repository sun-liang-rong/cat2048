import { Color, Node, tween, Vec3 } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import { addCoverBackground } from './background';
import { homeContentShift } from './layout';
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

export interface HomeViewModel {
  highScore: number;
  collectionCount: number;
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
  onToggleSound(): void;
  onSettings(): void;
}

export class HomeView {
  public constructor(private readonly art: ArtRepository) {}

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
    this.addHomeCatShowcase(parent, model);

    const playShadow = createUiNode('PlayButtonShadow', 500, 104);
    drawRounded(playShadow, 500, 104, new Color(117, 63, 47, 145), 30);
    playShadow.setPosition(0, this.homeTopY(model, 718) - 9);
    parent.addChild(playShadow);
    const play = createButton('开始经典模式', 500, 104, COLORS.coral, () => actions.onPlay(), 36,
      this.art.frame(GAME_CONFIG.art.check));
    play.setPosition(0, this.homeTopY(model, 710));
    parent.addChild(play);
    play.setScale(0.96, 0.96, 1);
    tween(play).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start();

    const hint = createLabel('滑动合成  ·  轻松上手', 22, new Color(90, 72, 64, 220), 500, 50);
    hint.node.setPosition(0, this.homeTopY(model, 790));
    parent.addChild(hint.node);

    this.addHomeActionDock(parent, model, actions);
  }

  private addHomeHeader(root: Node, model: HomeViewModel): void {
    const kicker = createUiNode('HomeKicker', 300, 48);
    drawRounded(kicker, 300, 48, new Color(39, 166, 151, 235), 24);
    kicker.setPosition(0, this.homeTopY(model, 88));
    const kickerText = createLabel('治愈系 · 合成小游戏', 21, COLORS.white, 270, 42, 'display');
    kicker.addChild(kickerText.node);
    root.addChild(kicker);

    const titleGroup = createUiNode('HomeTitle', 600, 104);
    titleGroup.setPosition(0, this.homeTopY(model, 166));
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
    subtitle.node.setPosition(0, this.homeTopY(model, 242));
    root.addChild(subtitle.node);
  }

  private addHomeCatShowcase(root: Node, model: HomeViewModel): void {
    const showcase = createUiNode('CatShowcase', 620, 360);
    showcase.setPosition(0, this.homeTopY(model, 452));

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
    const score = createLabel(String(model.highScore), 38, COLORS.ink, 225, 52, 'display');
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

  private addHomeActionDock(root: Node, model: HomeViewModel, actions: HomeViewActions): void {
    const dockY = -model.uiHeight / 2 + model.bottomInset + 82;
    const shadow = createUiNode('HomeDockShadow', 610, 112);
    drawRounded(shadow, 610, 112, new Color(91, 58, 40, 80), 34);
    shadow.setPosition(0, dockY - 8);
    root.addChild(shadow);
    const dock = createUiNode('HomeActionDock', 610, 112);
    drawRounded(dock, 610, 112, new Color(255, 249, 230, 238), 34,
      { color: new Color(77, 61, 54, 220), width: 4 });
    dock.setPosition(0, dockY);
    root.addChild(dock);

    const positions = [-222, -74, 74, 222] as const;
    const info = createIconButton('Info', this.art.frame(GAME_CONFIG.art.info), 'i', 64,
      () => actions.onInfo(), BOTTOM_EDGE_ICON_CROP);
    info.setPosition(positions[0], 13);
    dock.addChild(info);
    const infoText = createLabel('玩法', 18, COLORS.ink, 100, 28, 'display');
    infoText.node.setPosition(positions[0], -38);
    dock.addChild(infoText.node);

    const collection = createIconButton('Collection', this.art.frame(GAME_CONFIG.cats[0].asset), '图', 64,
      () => actions.onCollection());
    collection.setPosition(positions[1], 13);
    dock.addChild(collection);
    const collectionText = createLabel(`图鉴 ${model.collectionCount}/9`, 17, COLORS.ink, 120, 28, 'display');
    collectionText.node.setPosition(positions[1], -38);
    dock.addChild(collectionText.node);

    const sound = createIconButton('SoundToggle', this.art.frame(model.soundEnabled
      ? GAME_CONFIG.art.soundOn : GAME_CONFIG.art.soundOff), model.soundEnabled ? '♪' : '×', 64,
      () => actions.onToggleSound(), model.soundEnabled ? TOP_EDGE_ICON_CROP : BOTTOM_EDGE_ICON_CROP);
    sound.setPosition(positions[2], 13);
    dock.addChild(sound);
    const soundText = createLabel(model.soundEnabled ? '音效开' : '音效关', 18, COLORS.ink, 110, 28, 'display');
    soundText.node.setPosition(positions[2], -38);
    dock.addChild(soundText.node);

    const settings = createIconButton('Settings', this.art.frame(GAME_CONFIG.art.settings), '⚙', 64,
      () => actions.onSettings(), BOTTOM_EDGE_ICON_CROP);
    settings.setPosition(positions[3], 13);
    dock.addChild(settings);
    const settingsText = createLabel('设置', 18, COLORS.ink, 100, 28, 'display');
    settingsText.node.setPosition(positions[3], -38);
    dock.addChild(settingsText.node);

    const dividerColor = new Color(77, 61, 54, 55);
    for (const x of [-148, 0, 148]) {
      const divider = createUiNode(`DockDivider:${x}`, 2, 66);
      drawRounded(divider, 2, 66, dividerColor, 1);
      divider.setPosition(x, 0);
      dock.addChild(divider);
    }
  }

  private homeTopY(model: HomeViewModel, offsetFromTop: number): number {
    const shift = homeContentShift(model.uiHeight, model.topInset, model.bottomInset);
    return model.uiHeight / 2 - model.topInset - offsetFromTop - shift;
  }
}
