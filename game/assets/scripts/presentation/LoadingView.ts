import { Color, Label, Node, resources, SpriteFrame, Texture2D } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { COLORS, createLabel, createSpriteNode, createUiNode, drawRounded } from './uiFactory';

const TRACK_WIDTH = 380;
const TRACK_HEIGHT = 18;
const LOGO_SIZE = 300;

export class LoadingView {
  private fill: Node | null = null;
  private progressLabel: Label | null = null;
  private progress = 0;
  private failed = false;

  public build(parent: Node, width: number, height: number): void {
    const background = createUiNode('LoadingBackground', width, height);
    drawRounded(background, width, height, new Color(255, 240, 212, 255), 0);
    parent.addChild(background);

    this.loadLogo(parent);

    const track = createUiNode('LoadingTrack', TRACK_WIDTH, TRACK_HEIGHT);
    drawRounded(track, TRACK_WIDTH, TRACK_HEIGHT, new Color(41, 33, 28, 255), TRACK_HEIGHT / 2);
    track.setPosition(0, -55);
    parent.addChild(track);

    this.fill = createUiNode('LoadingProgress', TRACK_WIDTH, TRACK_HEIGHT);
    track.addChild(this.fill);

    this.progressLabel = createLabel('0%', 22, COLORS.ink, 180, 42, 'display');
    this.progressLabel.node.setPosition(0, -107);
    parent.addChild(this.progressLabel.node);

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
      const logo = createSpriteNode('LoadingLogo', frame, LOGO_SIZE, LOGO_SIZE);
      logo.setPosition(0, 145);
      parent.addChild(logo);
    });
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
    if (this.progressLabel) {
      this.progressLabel.string = this.failed ? '资源加载失败' : `${Math.round(this.progress * 100)}%`;
    }
    if (!this.fill) return;
    const fillWidth = Math.max(2, TRACK_WIDTH * this.progress);
    drawRounded(this.fill, fillWidth, TRACK_HEIGHT, COLORS.coral, Math.min(TRACK_HEIGHT / 2, fillWidth / 2));
    this.fill.setPosition((fillWidth - TRACK_WIDTH) / 2, 0);
  }
}
