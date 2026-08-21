import {
  Color,
  Label,
  Node,
  resources,
  SpriteFrame,
  Texture2D,
  Tween,
  Vec3,
  tween,
} from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { createLabel, createSpriteNode, createUiNode, drawRounded } from '../utils/uiFactory';

const DESIGN_HEIGHT = 1334;
const LOGO_SIZE = 320;
const TRACK_WIDTH = 468;
const TRACK_HEIGHT = 20;
const TRACK_INSET = 4;

const BACKGROUND = new Color(55, 39, 43, 255);
const TRACK = new Color(76, 54, 53, 255);
const TRACK_EDGE = new Color(143, 100, 82, 255);
const PROGRESS = new Color(239, 100, 83, 255);
const TEXT = new Color(255, 247, 225, 255);
const MUTED_TEXT = new Color(220, 188, 163, 255);

export class LoadingView {
  private fill: Node | null = null;
  private progressLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private progress = 0;
  private failed = false;
  private barWidth = TRACK_WIDTH;
  private barHeight = TRACK_HEIGHT;
  private contentScale = 1;
  private logoSize = LOGO_SIZE;

  public build(parent: Node, width: number, height: number): void {
    this.fill = null;
    this.progressLabel = null;
    this.statusLabel = null;
    this.contentScale = Math.min(1, Math.max(0.72, height / DESIGN_HEIGHT));
    this.logoSize = Math.round(LOGO_SIZE * this.contentScale);
    this.barWidth = Math.min(TRACK_WIDTH, Math.max(280, width - 112));
    this.barHeight = Math.max(14, Math.round(TRACK_HEIGHT * this.contentScale));

    const background = createUiNode('LoadingBackground', width, height);
    drawRounded(background, width, height, BACKGROUND, 0);
    parent.addChild(background);

    const logoHost = createUiNode('LoadingLogoHost', this.logoSize, this.logoSize);
    logoHost.setPosition(0, Math.round(112 * this.contentScale));
    parent.addChild(logoHost);
    this.loadLogo(logoHost);

    this.statusLabel = createLabel('正在加载游戏资源', Math.round(25 * this.contentScale), TEXT,
      Math.min(620, width - 72), Math.round(46 * this.contentScale), 'display');
    this.statusLabel.node.setPosition(0, Math.round(-116 * this.contentScale));
    parent.addChild(this.statusLabel.node);

    const track = createUiNode('LoadingTrack', this.barWidth, this.barHeight);
    drawRounded(track, this.barWidth, this.barHeight, TRACK, this.barHeight / 2, {
      color: TRACK_EDGE,
      width: 2,
    });
    track.setPosition(0, Math.round(-176 * this.contentScale));
    parent.addChild(track);

    const innerWidth = this.barWidth - TRACK_INSET * 2;
    const innerHeight = this.barHeight - TRACK_INSET * 2;
    const innerTrack = createUiNode('LoadingTrackInner', innerWidth, innerHeight);
    drawRounded(innerTrack, innerWidth, innerHeight, new Color(48, 34, 39, 255), innerHeight / 2);
    track.addChild(innerTrack);

    this.fill = createUiNode('LoadingProgress', innerWidth, innerHeight);
    innerTrack.addChild(this.fill);

    this.progressLabel = createLabel('0%', Math.round(21 * this.contentScale), TEXT, 180,
      Math.round(40 * this.contentScale), 'display', 'number');
    this.progressLabel.node.setPosition(0, Math.round(-222 * this.contentScale));
    parent.addChild(this.progressLabel.node);

    const hint = createLabel('猫咪正在准备中', Math.round(18 * this.contentScale), MUTED_TEXT,
      Math.min(420, width - 96), Math.round(32 * this.contentScale));
    hint.node.setPosition(0, Math.round(-264 * this.contentScale));
    parent.addChild(hint.node);

    this.render();
  }

  public setProgress(ratio: number): void {
    this.progress = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
    this.render();
  }

  public showError(): void {
    this.failed = true;
    this.render();
  }

  private loadLogo(parent: Node): void {
    resources.load(GAME_CONFIG.art.logo, Texture2D, (error, texture) => {
      if (error) {
        console.warn('[Cat2048] Loading logo unavailable.', error);
        return;
      }
      if (!parent.isValid) return;
      const frame = new SpriteFrame();
      frame.texture = texture;
      const logo = createSpriteNode('LoadingLogo', frame, this.logoSize, this.logoSize);
      parent.addChild(logo);
      this.startLogoMotion(logo);
    });
  }

  private startLogoMotion(logo: Node): void {
    Tween.stopAllByTarget(logo);
    logo.setScale(new Vec3(0.985, 0.985, 1));
    tween(logo)
      .to(1.2, { scale: new Vec3(1.015, 1.015, 1) }, { easing: 'sineInOut' })
      .to(1.2, { scale: new Vec3(0.985, 0.985, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }

  private render(): void {
    if (this.statusLabel) {
      this.statusLabel.string = this.failed
        ? '资源加载失败'
        : this.progress >= 0.9
          ? '马上就好啦'
          : this.progress >= 0.55
            ? '正在整理游戏内容'
            : '正在加载游戏资源';
    }
    if (this.progressLabel) {
      this.progressLabel.string = this.failed ? '加载失败' : `${Math.round(this.progress * 100)}%`;
    }
    if (!this.fill) return;

    const innerWidth = this.barWidth - TRACK_INSET * 2;
    const innerHeight = this.barHeight - TRACK_INSET * 2;
    const fillWidth = Math.max(2, innerWidth * this.progress);
    drawRounded(this.fill, fillWidth, innerHeight, PROGRESS, innerHeight / 2);
    this.fill.setPosition((fillWidth - innerWidth) / 2, 0);
  }
}
