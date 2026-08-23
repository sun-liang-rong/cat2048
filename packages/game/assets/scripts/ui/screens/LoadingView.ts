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
import { COLORS, createButton, createLabel, createSpriteNode, createUiNode, drawRounded } from '../utils/uiFactory';

const DESIGN_HEIGHT = 1334;
const LOGO_SIZE = 388;
const TRACK_WIDTH = 468;
const TRACK_HEIGHT = 24;
const TRACK_INSET = 4;

const BACKGROUND = new Color(255, 244, 222, 255); // 比 pageCream 略暖（无背景图时的启动页）
const TRACK = COLORS.trackSand;
const TRACK_EDGE = new Color(154, 103, 72, 210); // 轨道描边
const PROGRESS = COLORS.coral;
const TEXT = COLORS.textBody;
const MUTED_TEXT = new Color(143, 100, 75, 255); // 次级说明文字

export class LoadingView {
  private fill: Node | null = null;
  private track: Node | null = null;
  private progressLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private hintLabel: Label | null = null;
  private retryButton: Node | null = null;
  private progress = 0;
  private failed = false;
  private barWidth = TRACK_WIDTH;
  private barHeight = TRACK_HEIGHT;
  private contentScale = 1;
  private logoSize = LOGO_SIZE;

  public build(parent: Node, width: number, height: number, onRetry: () => void): void {
    this.fill = null;
    this.track = null;
    this.progressLabel = null;
    this.statusLabel = null;
    this.hintLabel = null;
    this.retryButton = null;
    this.contentScale = Math.min(1, Math.max(0.72, height / DESIGN_HEIGHT));
    this.logoSize = Math.min(Math.round(LOGO_SIZE * this.contentScale), Math.max(260, width - 150));
    this.barWidth = Math.min(TRACK_WIDTH, Math.max(280, width - 112));
    this.barHeight = Math.max(14, Math.round(TRACK_HEIGHT * this.contentScale));

    const background = createUiNode('LoadingBackground', width, height);
    drawRounded(background, width, height, BACKGROUND, 0);
    parent.addChild(background);

    const logoHost = createUiNode('LoadingLogoHost', this.logoSize, this.logoSize);
    logoHost.setPosition(0, Math.round(132 * this.contentScale));
    parent.addChild(logoHost);
    this.loadLogo(logoHost);

    this.statusLabel = createLabel('正在加载游戏资源', Math.round(28 * this.contentScale), TEXT,
      Math.min(620, width - 72), Math.round(46 * this.contentScale), 'display');
    this.statusLabel.node.setPosition(0, Math.round(-104 * this.contentScale));
    parent.addChild(this.statusLabel.node);

    const track = createUiNode('LoadingTrack', this.barWidth, this.barHeight);
    drawRounded(track, this.barWidth, this.barHeight, TRACK, this.barHeight / 2, {
      color: TRACK_EDGE,
      width: 2,
    });
    track.setPosition(0, Math.round(-164 * this.contentScale));
    parent.addChild(track);
    this.track = track;

    const innerWidth = this.barWidth - TRACK_INSET * 2;
    const innerHeight = this.barHeight - TRACK_INSET * 2;
    const innerTrack = createUiNode('LoadingTrackInner', innerWidth, innerHeight);
    drawRounded(innerTrack, innerWidth, innerHeight, TRACK, innerHeight / 2);
    track.addChild(innerTrack);

    this.fill = createUiNode('LoadingProgress', innerWidth, innerHeight);
    innerTrack.addChild(this.fill);

    this.progressLabel = createLabel('0%', Math.round(24 * this.contentScale), TEXT, 180,
      Math.round(40 * this.contentScale), 'display', 'number');
    this.progressLabel.node.setPosition(0, Math.round(-210 * this.contentScale));
    parent.addChild(this.progressLabel.node);

    this.hintLabel = createLabel('猫咪正在准备中', Math.round(23 * this.contentScale), MUTED_TEXT,
      Math.min(420, width - 96), Math.round(32 * this.contentScale));
    this.hintLabel.node.setPosition(0, Math.round(-254 * this.contentScale));
    parent.addChild(this.hintLabel.node);

    this.retryButton = createButton('重新加载', 250, 76, PROGRESS, onRetry,
      Math.round(27 * this.contentScale));
    this.retryButton.setPosition(0, Math.round(-184 * this.contentScale));
    this.retryButton.active = false;
    parent.addChild(this.retryButton);

    this.render();
  }

  public setProgress(ratio: number): void {
    this.progress = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
    this.render();
  }

  public reset(): void {
    this.progress = 0;
    this.failed = false;
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
        ? '资源加载失败，请检查网络'
        : this.progress >= 0.9
          ? '马上就好啦'
          : this.progress >= 0.55
            ? '正在整理游戏内容'
            : '正在加载游戏资源';
    }
    if (this.progressLabel) {
      this.progressLabel.string = `${Math.round(this.progress * 100)}%`;
      this.progressLabel.node.active = !this.failed;
    }
    if (this.track) this.track.active = !this.failed;
    if (this.hintLabel) this.hintLabel.node.active = !this.failed;
    if (this.retryButton) this.retryButton.active = this.failed;
    if (!this.fill) return;

    const innerWidth = this.barWidth - TRACK_INSET * 2;
    const innerHeight = this.barHeight - TRACK_INSET * 2;
    const fillWidth = Math.max(2, innerWidth * this.progress);
    drawRounded(this.fill, fillWidth, innerHeight, PROGRESS, innerHeight / 2);
    this.fill.setPosition((fillWidth - innerWidth) / 2, 0);
  }
}
