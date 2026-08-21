import { describe, expect, it, vi } from 'vitest';
import { HapticController } from '../assets/scripts/infrastructure/HapticController';

describe('HapticController', () => {
  it('prefers a light WeChat vibration when the API is available', () => {
    const vibrateShort = vi.fn();
    const browserVibrate = vi.fn();
    const haptics = new HapticController({
      wx: { vibrateShort },
      navigator: { vibrate: browserVibrate },
    });

    haptics.light();

    expect(vibrateShort).toHaveBeenCalledOnce();
    expect(vibrateShort).toHaveBeenCalledWith({ type: 'light' });
    expect(browserVibrate).not.toHaveBeenCalled();
  });

  it('falls back to a short browser vibration', () => {
    const vibrate = vi.fn(() => true);
    const haptics = new HapticController({ navigator: { vibrate } });

    haptics.light();

    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it('does nothing when vibration is unsupported', () => {
    expect(() => new HapticController({}).light()).not.toThrow();
  });

  it('suppresses vibration while disabled and resumes after re-enabling', () => {
    const vibrateShort = vi.fn();
    const haptics = new HapticController({ wx: { vibrateShort } });

    haptics.enabled = false;
    haptics.light();
    expect(vibrateShort).not.toHaveBeenCalled();

    haptics.enabled = true;
    haptics.light();
    expect(vibrateShort).toHaveBeenCalledOnce();
  });

  it('does not break gameplay when the platform API throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const haptics = new HapticController({
      wx: { vibrateShort: () => { throw new Error('unavailable'); } },
    });

    expect(() => haptics.light()).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
