/**
 * 排行榜流程控制器（从 Cat2048Boot 拆出）。
 *
 * 负责排行榜页面的打开、数据加载、后台认证与待提交成绩补交。
 */
import { Node } from 'cc';
import type { LeaderboardClient, LeaderboardResponse } from '../../features/leaderboard/leaderboard';
import type { LeaderboardView, LeaderboardViewModel } from '../screens/LeaderboardView';
import type { SaveDataV3 } from '../../features/storage/saveTypes';
import type { ScreenName } from './EconomyPanelsController';

export interface LeaderboardControllerDeps {
  readonly leaderboard: LeaderboardClient;
  readonly leaderboardView: LeaderboardView;
  readonly getSave: () => SaveDataV3;
  readonly getSize: () => { width: number; height: number };
  readonly topInset: () => number;
  readonly bottomInset: () => number;
  readonly getCurrentScreen: () => ScreenName;
  readonly getSceneToken: () => number;
  readonly showHome: () => void;
  readonly makeScreen: (name: string) => Node;
  readonly clearScreen: () => void;
  readonly setCurrentScreen: (name: ScreenName) => void;
}

export class LeaderboardController {
  private requestSequence = 0;

  public constructor(private readonly deps: LeaderboardControllerDeps) {}

  /** 打开排行榜页面并开始加载。 */
  public showLeaderboard(): void {
    this.deps.clearScreen();
    this.deps.setCurrentScreen('leaderboard');
    const root = this.deps.makeScreen('Leaderboard');
    const model = this.viewModel(null, 'loading');
    this.deps.leaderboardView.build(root, model, {
      onBack: () => this.deps.showHome(),
      onRetry: () => { void this.loadLeaderboard(); },
    });
    void this.loadLeaderboard();
  }

  /** 拉取排行榜数据（带场景令牌与请求序号防竞态）。 */
  public async loadLeaderboard(): Promise<void> {
    if (this.deps.getCurrentScreen() !== 'leaderboard') return;
    const token = this.deps.getSceneToken();
    const requestSequence = ++this.requestSequence;
    this.deps.leaderboardView.update(this.viewModel(null, 'loading'));
    try {
      const data = await this.deps.leaderboard.getLeaderboard();
      if (token !== this.deps.getSceneToken()
        || requestSequence !== this.requestSequence
        || this.deps.getCurrentScreen() !== 'leaderboard') return;
      this.deps.leaderboardView.update(this.viewModel(data, 'ready'));
    } catch (error) {
      if (token !== this.deps.getSceneToken()
        || requestSequence !== this.requestSequence
        || this.deps.getCurrentScreen() !== 'leaderboard') return;
      console.warn('[Cat2048] Failed to load leaderboard.', error);
      this.deps.leaderboardView.update(this.viewModel(null, 'error'));
    }
  }

  /** 后台认证（失败静默）。 */
  public async authenticate(): Promise<void> {
    try {
      await this.deps.leaderboard.ensureAuthenticated();
    } catch (error) {
      console.warn('[Cat2048] Leaderboard authentication unavailable.', error);
    }
  }

  /** 后台补交待提交成绩（失败静默）。 */
  public async flushPendingScores(): Promise<void> {
    try {
      await this.deps.leaderboard.flushPendingScores();
    } catch (error) {
      console.warn('[Cat2048] Failed to flush pending leaderboard scores.', error);
    }
  }

  private viewModel(data: LeaderboardResponse | null,
    status: 'loading' | 'ready' | 'error'): LeaderboardViewModel {
    return {
      data,
      status,
      localHighScore: this.deps.getSave().highScore,
      ownProfile: this.deps.leaderboard.currentPlayer(),
      uiWidth: this.deps.getSize().width,
      uiHeight: this.deps.getSize().height,
      topInset: this.deps.topInset(),
      bottomInset: this.deps.bottomInset(),
    };
  }
}
