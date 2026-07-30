import { describe, expect, it, vi } from 'vitest';
import { ResultShareController } from '../assets/scripts/infrastructure/ResultShareController';

function makeImage() {
  let source = '';
  return {
    onload: undefined as (() => void) | undefined,
    onerror: undefined as ((error: unknown) => void) | undefined,
    get src(): string { return source; },
    set src(value: string) {
      source = value;
      queueMicrotask(() => this.onload?.());
    },
  };
}

function makeRuntime() {
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: 'left' as const,
    textBaseline: 'alphabetic' as const,
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toTempFilePathSync: vi.fn(() => 'wxfile://result-card.jpg'),
  };
  const runtime = {
    createCanvas: vi.fn(() => canvas),
    createImage: vi.fn(makeImage),
    shareAppMessage: vi.fn(),
  };
  return { runtime, canvas, context };
}

describe('ResultShareController', () => {
  it('draws the cat and score before sharing the exported card', async () => {
    const { runtime, canvas, context } = makeRuntime();
    const controller = new ResultShareController({ wx: runtime });

    const result = await controller.share({
      score: 4096,
      bestScore: 8192,
      catLevel: 7,
      catName: '奶牛猫',
      backgroundPath: 'assets/share-score.png',
      catPath: 'assets/cat-07.png',
    });

    expect(result).toBe('shared');
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(800);
    expect(runtime.createImage).toHaveBeenCalledTimes(2);
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.fillText.mock.calls.map(([text]) => text)).toEqual(expect.arrayContaining([
      '本局得分', '4096', '最高分 8192', 'Lv.7 奶牛猫',
    ]));
    expect(canvas.toTempFilePathSync).toHaveBeenCalledWith(expect.objectContaining({
      fileType: 'jpg', quality: 0.92,
    }));
    expect(runtime.shareAppMessage).toHaveBeenCalledWith({
      title: '我在猫咪2048拿到了4096分，来挑战我吧！',
      imageUrl: 'wxfile://result-card.jpg',
      query: 'from=score_share&score=4096',
    });
  });

  it('reports unsupported outside WeChat without creating a card', async () => {
    const result = await new ResultShareController({}).share({
      score: 16,
      bestScore: 32,
      catLevel: 2,
      catName: '蓝白英短',
      backgroundPath: 'background.png',
      catPath: 'cat.png',
    });

    expect(result).toBe('unsupported');
  });

  it('reports a failed image load without invoking sharing', async () => {
    const { runtime } = makeRuntime();
    runtime.createImage.mockImplementation(() => {
      let source = '';
      return {
        onload: undefined,
        onerror: undefined as ((error: unknown) => void) | undefined,
        get src(): string { return source; },
        set src(value: string) {
          source = value;
          queueMicrotask(() => this.onerror?.(new Error('missing image')));
        },
      };
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await new ResultShareController({ wx: runtime }).share({
      score: 64,
      bestScore: 64,
      catLevel: 3,
      catName: '三花猫',
      backgroundPath: 'missing.png',
      catPath: 'cat.png',
    });

    expect(result).toBe('failed');
    expect(runtime.shareAppMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
