import {
  Color,
  Graphics,
  Label,
  Node,
  resources,
  SpriteFrame,
  Texture2D,
  Tween,
  Vec3,
  tween,
} from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { COLORS, createLabel, createSpriteNode, createUiNode, drawRounded } from './uiFactory';

const SHELL_WIDTH = 612;
const SHELL_HEIGHT = 720;
const TRACK_WIDTH = 460;
const TRACK_HEIGHT = 28;
const LOGO_SIZE = 320;
const TRACK_INSET = 10;
const STEP_COUNT = 3;

const LOADING_BACKGROUND = new Color(255, 247, 225, 255);
const SHELL_BACKGROUND = new Color(255, 251, 239, 255);
const TRACK_BACKGROUND = new Color(74, 57, 48, 255);
const TRACK_INNER_BACKGROUND = new Color(255, 235, 194, 255);
const STEP_PENDING = new Color(255, 235, 194, 255);
const STEP_ACTIVE = new Color(239, 100, 83, 255);
const STEP_COMPLETE = new Color(39, 166, 151, 255);

export class LoadingView {
  private fill: Node | null = null;
  private progressMarker: Node | null = null;
  private progressLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private stepDots: Node[] = [];
  private progress = 0;
  private failed = false;

  public build(parent: Node, width: number, height: number): void {
    this.fill = null;
    this.progressMarker = null;
    this.progressLabel = null;
    this.statusLabel = null;
    this.stepDots = [];

    const background = createUiNode('LoadingBackground', width, height);
    drawRounded(background, width, height, LOADING_BACKGROUND, 0);
    parent.addChild(background);

    this.addBackgroundDetails(parent, width, height);

    const shellWidth = Math.min(SHELL_WIDTH, width - 56);
    const shellHeight = Math.min(SHELL_HEIGHT, height - 112);
    const shell = createUiNode('LoadingShell', shellWidth, shellHeight);
    drawRounded(shell, shellWidth, shellHeight, SHELL_BACKGROUND, 42, {
      color: COLORS.ink,
      width: 4,
    });
    shell.setPosition(0, 10);
    parent.addChild(shell);

    const badge = createUiNode('LoadingBadge', 164, 38);
    drawRounded(badge, 164, 38, COLORS.cream, 19, { color: COLORS.mustard, width: 3 });
    badge.setPosition(0, shellHeight / 2 - 52);
    shell.addChild(badge);
    const badgeLabel = createLabel('猫咪 2048', 17, COLORS.ink, 148, 30, 'display');
    badge.addChild(badgeLabel.node);

    this.loadLogo(shell);

    this.statusLabel = createLabel('正在唤醒猫咪', 25, COLORS.ink, shellWidth - 90, 42, 'display');
    this.statusLabel.node.setPosition(0, -91);
    shell.addChild(this.statusLabel.node);

    const track = createUiNode('LoadingTrack', TRACK_WIDTH, TRACK_HEIGHT);
    drawRounded(track, TRACK_WIDTH, TRACK_HEIGHT, TRACK_BACKGROUND, TRACK_HEIGHT / 2);
    track.setPosition(0, -151);
    shell.addChild(track);

    const innerTrack = createUiNode('LoadingTrackInner', TRACK_WIDTH - TRACK_INSET, TRACK_HEIGHT - TRACK_INSET);
    drawRounded(innerTrack, TRACK_WIDTH - TRACK_INSET, TRACK_HEIGHT - TRACK_INSET,
      TRACK_INNER_BACKGROUND, (TRACK_HEIGHT - TRACK_INSET) / 2);
    track.addChild(innerTrack);

    this.fill = createUiNode('LoadingProgress', TRACK_WIDTH - TRACK_INSET, TRACK_HEIGHT - TRACK_INSET);
    innerTrack.addChild(this.fill);

    this.progressMarker = this.createPaw('LoadingProgressMarker');
    this.progressMarker.setPosition(-TRACK_WIDTH / 2 + 16, -151);
    shell.addChild(this.progressMarker);

    this.progressLabel = createLabel('0%', 22, COLORS.ink, 180, 38, 'display', 'number');
    this.progressLabel.node.setPosition(0, -202);
    shell.addChild(this.progressLabel.node);

    this.addSteps(shell, shellHeight);
    this.render();
  }

  private addBackgroundDetails(parent: Node, width: number, height: number): void {
    const topWidth = Math.min(260, width * 0.38);
    const topLine = createUiNode('LoadingTopLine', topWidth, 8);
    drawRounded(topLine, topWidth, 8, COLORS.teal, 4);
    topLine.setPosition(0, height / 2 - 31);
    parent.addChild(topLine);

    const bottomWidth = Math.min(152, width * 0.24);
    const bottomLine = createUiNode('LoadingBottomLine', bottomWidth, 8);
    drawRounded(bottomLine, bottomWidth, 8, COLORS.coral, 4);
    bottomLine.setPosition(0, -height / 2 + 31);
    parent.addChild(bottomLine);
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
      const logo = createSpriteNode('LoadingLogo', frame, LOGO_SIZE, LOGO_SIZE);
      logo.setPosition(0, 104);
      parent.addChild(logo);
      this.startLogoMotion(logo);
    });
  }

  private startLogoMotion(logo: Node): void {
    Tween.stopAllByTarget(logo);
    logo.setScale(new Vec3(0.985, 0.985, 1));
    tween(logo)
      .to(1.25, { scale: new Vec3(1.015, 1.015, 1) }, { easing: 'sineInOut' })
      .to(1.25, { scale: new Vec3(0.985, 0.985, 1) }, { easing: 'sineInOut' })
      .repeatForever()
      .start();
  }

  private addSteps(parent: Node, shellHeight: number): void {
    const labels = ['准备资源', '整理棋盘', '马上开始'];
    const stepWidth = 138;
    const gap = 16;
    const startX = -((STEP_COUNT * stepWidth + (STEP_COUNT - 1) * gap) / 2) + stepWidth / 2;
    this.stepDots = [];

    labels.forEach((text, index) => {
      const step = createUiNode(`LoadingStep:${index}`, stepWidth, 72);
      step.setPosition(startX + index * (stepWidth + gap), -shellHeight / 2 + 82);
      parent.addChild(step);

      const dot = createUiNode(`LoadingStepDot:${index}`, 28, 28);
      dot.setPosition(0, 20);
      step.addChild(dot);
      this.stepDots.push(dot);

      const label = createLabel(text, 16, COLORS.ink, stepWidth, 28, 'body');
      label.node.setPosition(0, -20);
      step.addChild(label.node);
    });
  }

  private createPaw(name: string): Node {
    const node = createUiNode(name, 46, 46);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = COLORS.coral;
    graphics.strokeColor = COLORS.ink;
    graphics.lineWidth = 3;
    graphics.circle(0, -4, 10);
    graphics.fill();
    graphics.stroke();
    for (const x of [-12, -4, 4, 12]) {
      graphics.circle(x, 9, 4.5);
      graphics.fill();
      graphics.stroke();
    }
    return node;
  }

  public setProgress(ratio: number): void {
    this.progress = Math.min(1, Math.max(0, ratio));
    this.render();
  }

  public showError(): void {
    this.failed = true;
    this.render();
  }

  private render(): void {
    const activeStep = this.progress >= 0.9 ? 2 : this.progress >= 0.55 ? 1 : 0;
    if (this.progressLabel) {
      this.progressLabel.string = this.failed ? '璧勬簮鍔犺浇澶辫触' : `${Math.round(this.progress * 100)}%`;
    }
    if (this.statusLabel) {
      this.statusLabel.string = this.failed
        ? '资源加载失败'
        : this.progress >= 0.9
          ? '马上就好啦'
          : this.progress >= 0.55
            ? '正在整理棋盘'
            : '正在唤醒猫咪';
    }
    this.stepDots.forEach((dot, index) => {
      const color = index < activeStep ? STEP_COMPLETE : index === activeStep ? STEP_ACTIVE : STEP_PENDING;
      drawRounded(dot, 28, 28, color, 14, { color: COLORS.ink, width: 3 });
    });
    if (!this.fill) return;
    const fillWidth = Math.max(2, (TRACK_WIDTH - TRACK_INSET) * this.progress);
    const fillHeight = TRACK_HEIGHT - TRACK_INSET;
    drawRounded(this.fill, fillWidth, fillHeight, COLORS.coral, Math.min(fillHeight / 2, fillWidth / 2));
    this.fill.setPosition((fillWidth - (TRACK_WIDTH - TRACK_INSET)) / 2, 0);
    if (this.progressMarker) {
      const markerX = -TRACK_WIDTH / 2 + 16 + (TRACK_WIDTH - 32) * this.progress;
      this.progressMarker.setPosition(markerX, -151);
    }
  }
}
