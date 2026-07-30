import {
  BlockInputEvents,
  Color,
  Graphics,
  Node,
  tween,
  Vec3,
} from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createToggle,
  createUiNode,
  drawRounded,
} from './uiFactory';

export interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface SettingsHandlers {
  onSoundChange(enabled: boolean): void;
  onHapticsChange(enabled: boolean): void;
  onClose(): void;
}

export class SettingsPanel {
  public constructor(
    private readonly art: ArtRepository,
    private readonly getSize: () => { width: number; height: number },
  ) {}

  public show(parent: Node, state: SettingsState, handlers: SettingsHandlers): void {
    const { width, height } = this.getSize();
    const overlay = createUiNode('SettingsOverlay', width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();
    parent.addChild(overlay);

    const panel = createUiNode('SettingsPanel', 590, 500);
    drawRounded(panel, 590, 500, COLORS.ivory, 38, { color: COLORS.ink, width: 6 });
    overlay.addChild(panel);

    const closeSettings = (): void => {
      overlay.destroy();
      handlers.onClose();
    };
    const closeFrame = this.art.frame(GAME_CONFIG.art.close);
    if (closeFrame) {
      const close = createIconButton('SettingsClose', closeFrame, '×', 66, closeSettings);
      close.setPosition(258, 223);
      panel.addChild(close);
    }

    const title = createLabel('设置', 46, COLORS.coral, 500, 70, 'display');
    title.node.setPosition(0, 172);
    panel.addChild(title.node);

    const addSettingRow = (name: string, labelText: string, enabled: boolean, y: number,
      onChange: (enabled: boolean) => void): void => {
      const label = createLabel(labelText, 30, COLORS.ink, 160, 54, 'display');
      label.node.setPosition(-170, y);
      panel.addChild(label.node);
      const stateLabel = createLabel(enabled ? '开启' : '关闭', 24, enabled ? COLORS.teal : COLORS.ink, 100, 48);
      stateLabel.node.setPosition(38, y);
      panel.addChild(stateLabel.node);
      const toggle = createToggle(name, enabled, (value) => {
        stateLabel.string = value ? '开启' : '关闭';
        stateLabel.color = value ? COLORS.teal : COLORS.ink;
        onChange(value);
      });
      toggle.setPosition(188, y);
      panel.addChild(toggle);
    };

    addSettingRow('SoundSetting', '音效', state.soundEnabled, 70, (enabled) => {
      handlers.onSoundChange(enabled);
    });
    addSettingRow('HapticsSetting', '震动', state.hapticsEnabled, -35, (enabled) => {
      handlers.onHapticsChange(enabled);
    });

    const divider = createUiNode('SettingsDivider', 470, 2);
    drawRounded(divider, 470, 2, new Color(77, 61, 54, 55), 1);
    divider.setPosition(0, 18);
    panel.addChild(divider);

    const close = createButton('关闭', 270, 78, COLORS.coral, closeSettings, 28);
    close.setPosition(0, -170);
    panel.addChild(close);
    panel.setScale(0.8, 0.8, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
  }
}
