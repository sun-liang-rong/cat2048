import { Color, Graphics, Node } from 'cc';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView, MODAL_CARD } from './ModalView';
import {
  COLORS,
  createLabel,
  createToggle,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';

export interface SettingsState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface SettingsHandlers {
  onSoundChange(enabled: boolean): void;
  onMusicChange(enabled: boolean): void;
  onHapticsChange(enabled: boolean): void;
  onClose(): void;
}

const PANEL_WIDTH = 680;
const PANEL_HEIGHT = 620;
const ROW_WIDTH = 600;
const ROW_HEIGHT = 96;
const ROW_RADIUS = 32;
const ROW_EDGE = new Color(246, 231, 204, 255);
const MUTED_RULE = new Color(221, 188, 142, 74);

export class SettingsPanel {
  private readonly modal: ModalView;

  public constructor(
    getSize: () => { width: number; height: number },
    art: ArtRepository,
  ) {
    this.modal = new ModalView(art, getSize);
  }

  public show(parent: Node, state: SettingsState, handlers: SettingsHandlers): void {
    const { panel } = this.modal.open(parent, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      title: '设置',
      onClose: handlers.onClose,
    });

    const addSettingRow = (name: string, labelText: string, enabled: boolean, y: number,
      icon: 'sound' | 'music' | 'haptics', onChange: (enabled: boolean) => void): void => {
      const shadow = createUiNode(`${name}RowShadow`, ROW_WIDTH + 4, ROW_HEIGHT + 8);
      drawRounded(shadow, ROW_WIDTH + 4, ROW_HEIGHT + 8,
        new Color(221, 190, 144, 42), ROW_RADIUS + 2);
      shadow.setPosition(0, y - 5);
      panel.addChild(shadow);

      const row = createUiNode(`${name}Row`, ROW_WIDTH, ROW_HEIGHT);
      drawRounded(row, ROW_WIDTH, ROW_HEIGHT, MODAL_CARD, ROW_RADIUS,
        { color: ROW_EDGE, width: 2 });
      row.setPosition(0, y);
      panel.addChild(row);

      this.addSettingIcon(row, icon, -239);

      const label = createLabel(labelText, 32, COLORS.ink, 150, 58, 'display');
      label.node.setPosition(-132, 0);
      row.addChild(label.node);

      const stateLabel = createLabel(enabled ? '开启' : '关闭', 26,
        enabled ? COLORS.teal : new Color(126, 115, 106, 255), 110, 48);
      stateLabel.node.setPosition(32, 0);
      row.addChild(stateLabel.node);

      const toggle = createToggle(name, enabled, (value) => {
        stateLabel.string = value ? '开启' : '关闭';
        stateLabel.color = value ? COLORS.teal : new Color(126, 115, 106, 255);
        onChange(value);
      }, {
        onColor: new Color(70, 173, 157, 255),
        offColor: new Color(247, 198, 185, 255),
        pawColor: new Color(224, 199, 174, 150),
      });
      toggle.setPosition(222, 0);
      row.addChild(toggle);
    };

    addSettingRow('SoundSetting', '音效', state.soundEnabled, 117, 'sound', (enabled) => {
      handlers.onSoundChange(enabled);
    });
    addSettingRow('MusicSetting', '音乐', state.musicEnabled, 7, 'music', (enabled) => {
      handlers.onMusicChange(enabled);
    });

    const divider = createUiNode('SettingsDivider', ROW_WIDTH - 24, 4);
    drawRounded(divider, ROW_WIDTH - 24, 4, MUTED_RULE, 2);
    divider.setPosition(0, -52);
    panel.addChild(divider);

    addSettingRow('HapticsSetting', '震动', state.hapticsEnabled, -106, 'haptics', (enabled) => {
      handlers.onHapticsChange(enabled);
    });
  }

  private addSettingIcon(parent: Node, type: 'sound' | 'music' | 'haptics', x: number): void {
    const icon = createUiNode(`${parent.name}:${type}Icon`, 66, 66);
    const background = type === 'sound'
      ? new Color(101, 190, 177, 255)
      : type === 'music'
        ? new Color(247, 143, 128, 255)
        : new Color(251, 195, 102, 255);
    drawRounded(icon, 66, 66, background, 33,
      { color: new Color(255, 255, 255, 92), width: 2 });
    const graphics = icon.addComponent(Graphics);
    graphics.fillColor = COLORS.white;
    graphics.strokeColor = COLORS.white;
    graphics.lineWidth = 5;
    if (type === 'sound') this.drawSoundIcon(graphics);
    else if (type === 'music') this.drawMusicIcon(graphics);
    else this.drawHapticsIcon(graphics);
    icon.setPosition(x, 0);
    parent.addChild(icon);
  }

  private drawSoundIcon(graphics: Graphics): void {
    graphics.moveTo(-22, -10);
    graphics.lineTo(-11, -10);
    graphics.lineTo(6, -23);
    graphics.lineTo(6, 23);
    graphics.lineTo(-11, 10);
    graphics.lineTo(-22, 10);
    graphics.close();
    graphics.fill();
    graphics.arc(4, 0, 19, -0.78, 0.78, false);
    graphics.stroke();
    graphics.arc(5, 0, 28, -0.72, 0.72, false);
    graphics.stroke();
  }

  private drawMusicIcon(graphics: Graphics): void {
    graphics.circle(-11, -17, 7);
    graphics.circle(12, -9, 7);
    graphics.fill();
    graphics.moveTo(-4, -17);
    graphics.lineTo(-4, 16);
    graphics.moveTo(19, -9);
    graphics.lineTo(19, 9);
    graphics.moveTo(-4, 16);
    graphics.lineTo(19, 9);
    graphics.stroke();
  }

  private drawHapticsIcon(graphics: Graphics): void {
    graphics.roundRect(-12, -22, 24, 44, 6);
    graphics.stroke();
    graphics.lineWidth = 3;
    graphics.moveTo(-20, -12);
    graphics.lineTo(-24, -8);
    graphics.lineTo(-24, 8);
    graphics.lineTo(-20, 12);
    graphics.moveTo(20, -12);
    graphics.lineTo(24, -8);
    graphics.lineTo(24, 8);
    graphics.lineTo(20, 12);
    graphics.stroke();
    graphics.lineWidth = 4;
    graphics.moveTo(-5, -14);
    graphics.lineTo(5, -14);
    graphics.stroke();
  }
}
