/**
 * 猫咪2048 启动组件（Cocos Component）。
 *
 * 职责精简为：
 * 1. Cocos 生命周期（onLoad / onDestroy）
 * 2. Canvas 与安全区设置
 * 3. 键盘输入
 * 4. 创建所有服务并注入 AppHost
 *
 * 应用逻辑全部在 AppHost 中。
 */
import {
  _decorator,
  Component,
  EventKeyboard,
  input,
  Input,
  KeyCode,
  ResolutionPolicy,
  screen,
  sys,
  Tween,
  UITransform,
  view,
} from 'cc';
import { LocalEconomyRepository } from '../../features/economy/economy';
import { LocalDailyTaskRepository } from '../../features/tasks/dailyTasks';
import { RunSessionStore } from '../../features/storage/runSession';
import type { Direction } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { HapticController } from '../../infrastructure/HapticController';
import { ResultShareController } from '../../infrastructure/ResultShareController';
import { configureWechatHomeShare } from '../../infrastructure/WechatShare';
import { runtimeStorage } from '../../features/storage/runtime';
import { createWechatLeaderboardClient } from '../../features/leaderboard/leaderboard';
import { ArtRepository } from '../utils/ArtRepository';
import { AudioController } from '../components/AudioController';
import { safeInsetsFromRect } from '../styles/layout';
import { ModalView } from '../panels/ModalView';
import { CollectionView } from './CollectionView';
import { HomeView } from './HomeView';
import { LoadingView } from './LoadingView';
import { LeaderboardView } from './LeaderboardView';
import { CosmeticRuntime } from '../components/CosmeticRuntime';
import { DailyRewardView } from '../panels/DailyRewardView';
import { TaskPanelView } from '../panels/TaskPanelView';
import { CatDetailModal } from '../panels/CatDetailModal';
import { ShopView } from './ShopView';
import { SettingsPanel } from '../panels/SettingsPanel';
import { markCocosLoadingReady } from '../utils/cocosLoadingBridge';
import { wechatCapsuleInset } from '../utils/safeInsets';
import { AppHost, type HostPlatform, type HostServices } from './AppHost';

const { ccclass } = _decorator;

@ccclass('Cat2048Boot')
export class Cat2048Boot extends Component {
  private app!: AppHost;
  private uiWidth: number = GAME_CONFIG.designWidth;
  private uiHeight: number = GAME_CONFIG.designHeight;
  private safeTop = 24;
  private safeBottom = 20;

  // ---- Cocos 生命周期 ----

  protected override onLoad(): void {
    this.setupCanvas();
    configureWechatHomeShare();
    const save = runtimeStorage.load();

    // 创建所有服务
    const art = new ArtRepository();
    const cosmetics = new CosmeticRuntime(art);
    cosmetics.setEquipped(save.economy.equipped);
    const audio = new AudioController(this.node, art);
    audio.enabled = save.soundEnabled;
    audio.musicEnabled = save.musicEnabled;
    const haptics = new HapticController();
    haptics.enabled = save.hapticsEnabled;

    const services: HostServices = {
      art,
      cosmetics,
      economy: new LocalEconomyRepository(sys.localStorage),
      tasks: new LocalDailyTaskRepository(sys.localStorage),
      runSession: new RunSessionStore(sys.localStorage),
      leaderboard: createWechatLeaderboardClient(GAME_CONFIG.network.leaderboardBaseUrl, sys.localStorage),
      haptics,
      resultShare: new ResultShareController(),
      audio,
      homeView: new HomeView(art),
      collectionView: new CollectionView(art, cosmetics),
      leaderboardView: new LeaderboardView(art),
      shopView: new ShopView(art, cosmetics),
      loadingView: new LoadingView(),
      dailyRewardView: new DailyRewardView(art),
      taskPanel: new TaskPanelView(art),
      catDetailModal: new CatDetailModal(art, cosmetics),
      settings: new SettingsPanel(() => ({ width: this.uiWidth, height: this.uiHeight }), art),
      dialogs: new ModalView(art, () => ({ width: this.uiWidth, height: this.uiHeight })),
    };

    const platform: HostPlatform = {
      node: this.node,
      isValid: this.isValid,
      scheduleOnce: (cb, delay) => this.scheduleOnce(cb, delay),
      unschedule: (cb) => this.unschedule(cb),
    };

    this.app = new AppHost(platform, services, save, this.uiWidth, this.uiHeight, this.safeTop, this.safeBottom);

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    screen.on('window-resize', this.onResize, this);
    screen.on('orientation-change', this.onResize, this);

    markCocosLoadingReady();
    void this.app.initialize();
  }

  protected override onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    screen.off('window-resize', this.onResize, this);
    screen.off('orientation-change', this.onResize, this);
    Tween.stopAll();
    this.app?.teardown();
  }

  // ---- Canvas ----

  private setupCanvas(): void {
    view.setDesignResolutionSize(GAME_CONFIG.designWidth, GAME_CONFIG.designHeight, ResolutionPolicy.FIXED_WIDTH);
    const visible = view.getVisibleSize();
    this.uiWidth = visible.width;
    this.uiHeight = visible.height;
    const safe = safeInsetsFromRect(this.uiHeight, sys.getSafeAreaRect(false));
    this.safeTop = Math.max(safe.top, wechatCapsuleInset(this.uiWidth));
    this.safeBottom = safe.bottom;
    (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(visible);
  }

  // ---- 窗口尺寸变化 ----

  private readonly onResize = (): void => {
    this.platform.unschedule(this.applyResize);
    this.platform.scheduleOnce(this.applyResize, 0.15);
  };

  private readonly applyResize = (): void => {
    const screenBefore = this.app.currentScreenName;
    this.setupCanvas();
    this.app.updateLayout(this.uiWidth, this.uiHeight, this.safeTop, this.safeBottom);
    this.app.applyResize(screenBefore);
  };

  private get platform(): HostPlatform {
    return {
      node: this.node,
      isValid: this.isValid,
      scheduleOnce: (cb, delay) => this.scheduleOnce(cb, delay),
      unschedule: (cb) => this.unschedule(cb),
    };
  }

  // ---- 键盘输入 ----

  private readonly onKeyDown = (event: EventKeyboard): void => {
    if (!this.app.flow.isBoardActive() || this.app.isInputLocked()) return;
    const directions: Partial<Record<KeyCode, Direction>> = {
      [KeyCode.ARROW_UP]: 'up', [KeyCode.ARROW_DOWN]: 'down',
      [KeyCode.ARROW_LEFT]: 'left', [KeyCode.ARROW_RIGHT]: 'right',
      [KeyCode.KEY_W]: 'up', [KeyCode.KEY_S]: 'down', [KeyCode.KEY_A]: 'left', [KeyCode.KEY_D]: 'right',
    };
    const direction = directions[event.keyCode];
    if (direction) void this.app.flow.performMove(direction);
  };
}
