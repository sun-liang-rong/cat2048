import { Color, Node } from 'cc';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView, MODAL_CARD } from './ModalView';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import {
  COLORS,
  createLabel,
  createSpriteNode,
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
const PANEL_HEIGHT = 500;
const ROW_WIDTH = 600;
const ROW_HEIGHT = 96;
const ROW_RADIUS = 32;
const ROW_EDGE = new Color(246, 231, 204, 255);
/** 三行设置项统一使用主题青色，同级功能不做多彩区分。 */
const ICON_BACKGROUND = new Color(101, 190, 177, 255);
/** 关闭态开关用中性暖灰，避免粉红色暗示"错误"。 */
const TOGGLE_OFF_COLOR = new Color(233, 221, 200, 255);

export class SettingsPanel {
  private readonly modal: ModalView;

  public constructor(
    getSize: () => { width: number; height: number },
    private readonly art: ArtRepository,
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
      label.node.setPosition(-105, 0);
      row.addChild(label.node);

      // 开关自身的颜色与滑块位置已表达状态，不再叠加"开启/关闭"文字
      const toggle = createToggle(name, enabled, onChange, {
        onColor: new Color(70, 173, 157, 255),
        offColor: TOGGLE_OFF_COLOR,
        pawColor: new Color(224, 199, 174, 150),
      });
      toggle.setPosition(222, 0);
      row.addChild(toggle);
    };

    addSettingRow('SoundSetting', '音效', state.soundEnabled, 95, 'sound', (enabled) => {
      handlers.onSoundChange(enabled);
    });
    addSettingRow('MusicSetting', '音乐', state.musicEnabled, -15, 'music', (enabled) => {
      handlers.onMusicChange(enabled);
    });
    addSettingRow('HapticsSetting', '震动', state.hapticsEnabled, -125, 'haptics', (enabled) => {
      handlers.onHapticsChange(enabled);
    });
  }

  private addSettingIcon(parent: Node, type: 'sound' | 'music' | 'haptics', x: number): void {
    const icon = createUiNode(`${parent.name}:${type}Icon`, 66, 66);
    drawRounded(icon, 66, 66, ICON_BACKGROUND, 33,
      { color: new Color(255, 255, 255, 92), width: 2 });
    // 图标字形：Remix Icon 字体渲染的白色 PNG，与任务图标同一套生成管线。
    const iconFrame = this.art.frame(GAME_CONFIG.art.settingsIcons[type]);
    if (iconFrame) {
      const glyph = createSpriteNode(`${parent.name}:${type}Glyph`, iconFrame, 44, 44);
      icon.addChild(glyph);
    }
    icon.setPosition(x, 0);
    parent.addChild(icon);
  }
}
