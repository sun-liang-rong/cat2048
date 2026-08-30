/**
 * 启动性能埋点：记录冷启动关键时间点并输出/上报。
 * 纯 TypeScript 无引擎依赖；宿主上报能力缺失时静默降级为控制台日志。
 *
 * 关键指标：
 * - homeReadyMs：脚本启动 → 首页可交互（Tier 1 资源就绪），加载速度的核心指标
 * - secondaryMs：首页可交互 → 对局与次级资源全部就绪（后台资源加载耗时）
 */

type StartupMark = 'boot' | 'home-ready' | 'secondary-loaded';

export interface StartupMeasurements {
  readonly homeReadyMs: number | null;
  readonly secondaryMs: number | null;
}

interface PerformanceRuntime {
  reportPerformance?(id: number, value: number): void;
}

/** 微信后台「自定义性能指标」ID：配置后可在小游戏数据看板查看启动趋势。 */
const HOME_READY_METRIC_ID = 2101;

export class StartupMetrics {
  private readonly marks = new Map<StartupMark, number>();

  /** 记录时间点；同名标记只记首次，保证重复调用不污染测量。 */
  public mark(name: StartupMark): void {
    if (!this.marks.has(name)) this.marks.set(name, Date.now());
  }

  public measure(): StartupMeasurements {
    const boot = this.marks.get('boot');
    const homeReady = this.marks.get('home-ready');
    const secondary = this.marks.get('secondary-loaded');
    return {
      homeReadyMs: boot !== undefined && homeReady !== undefined ? homeReady - boot : null,
      secondaryMs: homeReady !== undefined && secondary !== undefined ? secondary - homeReady : null,
    };
  }

  /** 输出测量结果；微信环境额外上报自定义指标，失败静默。 */
  public report(runtime: PerformanceRuntime = globalThis as unknown as PerformanceRuntime): StartupMeasurements {
    const measurements = this.measure();
    console.log('[Perf] startup', measurements);
    if (measurements.homeReadyMs !== null && typeof runtime.reportPerformance === 'function') {
      try {
        runtime.reportPerformance(HOME_READY_METRIC_ID, measurements.homeReadyMs);
      } catch {
        // 上报失败不影响游戏
      }
    }
    return measurements;
  }
}
