import { describe, expect, it, vi } from 'vitest';
import { StartupMetrics } from '../assets/scripts/infrastructure/StartupMetrics';

describe('StartupMetrics', () => {
  it('measures boot-to-home and home-to-secondary durations', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const metrics = new StartupMetrics();
      metrics.mark('boot');

      vi.setSystemTime(1_800);
      metrics.mark('home-ready');

      vi.setSystemTime(2_600);
      metrics.mark('secondary-loaded');

      expect(metrics.measure()).toEqual({ homeReadyMs: 800, secondaryMs: 800 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the first mark when the same stage is marked twice', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const metrics = new StartupMetrics();
      metrics.mark('boot');
      vi.setSystemTime(5_000);
      metrics.mark('boot');
      vi.setSystemTime(6_000);
      metrics.mark('home-ready');

      expect(metrics.measure()).toEqual({ homeReadyMs: 5_000, secondaryMs: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns nulls for missing marks and never throws on report failures', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const metrics = new StartupMetrics();
      metrics.mark('boot');
      vi.setSystemTime(1_500);
      metrics.mark('home-ready');

      expect(metrics.measure()).toEqual({ homeReadyMs: 500, secondaryMs: null });
      expect(() => metrics.report({
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 模拟宿主上报抛错
        reportPerformance: () => { throw new Error('report failed'); },
      })).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
