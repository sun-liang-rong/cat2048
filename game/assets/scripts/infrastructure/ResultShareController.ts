export type ShareResult = 'shared' | 'unsupported' | 'failed';
export type SharePurpose = 'score' | 'revive' | 'undo-refill' | 'remove-lowest-refill';

export interface ResultCardData {
  readonly purpose?: SharePurpose;
  readonly score: number;
  readonly bestScore: number;
  readonly catLevel: number;
  readonly catName: string;
  readonly backgroundPath: string;
  readonly catPath: string;
}

interface ShareImage {
  src: string;
  onload?: () => void;
  onerror?: (error: unknown) => void;
}

interface ShareCanvasContext {
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  drawImage(image: ShareImage, x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  save(): void;
  restore(): void;
}

interface ShareCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): ShareCanvasContext | null;
  toTempFilePathSync(options: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly destWidth: number;
    readonly destHeight: number;
    readonly fileType: 'jpg';
    readonly quality: number;
  }): string;
}

interface WeChatShareApi {
  createCanvas(): ShareCanvas;
  createImage(): ShareImage;
  shareAppMessage(options: {
    readonly title: string;
    readonly imageUrl: string;
    readonly query: string;
  }): void;
}

export interface ResultShareRuntime {
  readonly wx?: WeChatShareApi;
}

const CARD_WIDTH = 1000;
const CARD_HEIGHT = 800;

export class ResultShareController {
  public constructor(private readonly runtime: ResultShareRuntime = globalThis as ResultShareRuntime) {}

  public async share(data: ResultCardData): Promise<ShareResult> {
    const wx = this.runtime.wx;
    if (!wx
      || typeof wx.createCanvas !== 'function'
      || typeof wx.createImage !== 'function'
      || typeof wx.shareAppMessage !== 'function') return 'unsupported';

    try {
      const canvas = wx.createCanvas();
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context || typeof canvas.toTempFilePathSync !== 'function') return 'unsupported';

      const [background, cat] = await Promise.all([
        this.loadImage(wx, data.backgroundPath),
        this.loadImage(wx, data.catPath),
      ]);
      this.drawCard(context, background, cat, data);
      const imageUrl = canvas.toTempFilePathSync({
        x: 0,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        destWidth: CARD_WIDTH,
        destHeight: CARD_HEIGHT,
        fileType: 'jpg',
        quality: 0.92,
      });
      wx.shareAppMessage({
        title: this.shareTitle(data.purpose ?? 'score', data.score),
        imageUrl,
        query: `from=${this.shareSource(data.purpose ?? 'score')}&score=${data.score}`,
      });
      return 'shared';
    } catch (error) {
      console.warn('[Cat2048] Unable to share the result card.', error);
      return 'failed';
    }
  }

  private loadImage(wx: WeChatShareApi, path: string): Promise<ShareImage> {
    return new Promise((resolve, reject) => {
      const image = wx.createImage();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = path;
    });
  }

  private drawCard(context: ShareCanvasContext, background: ShareImage, cat: ShareImage,
    data: ResultCardData): void {
    context.drawImage(background, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.save();
    context.fillStyle = 'rgba(255, 247, 225, 0.90)';
    context.fillRect(68, 62, 864, 676);
    context.drawImage(cat, 104, 192, 320, 320);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#3c302c';
    context.font = 'bold 42px sans-serif';
    context.fillText('本局得分', 690, 202);
    context.fillStyle = '#ef6453';
    context.font = 'bold 112px sans-serif';
    context.fillText(String(data.score), 690, 322);
    context.fillStyle = '#279f91';
    context.font = 'bold 34px sans-serif';
    context.fillText(`最高分 ${data.bestScore}`, 690, 420);
    context.fillStyle = '#3c302c';
    context.font = 'bold 36px sans-serif';
    context.fillText(`Lv.${data.catLevel} ${data.catName}`, 264, 570);
    context.font = 'bold 31px sans-serif';
    context.fillText(this.cardPrompt(data.purpose ?? 'score'), 500, 670);
    context.restore();
  }

  private shareTitle(purpose: SharePurpose, score: number): string {
    const titles: Record<SharePurpose, string> = {
      score: `我在猫咪2048拿到了${score}分，来挑战我吧！`,
      revive: '猫咪挤满啦，帮我腾出两个位置继续挑战！',
      'undo-refill': '帮我补充一次撤回机会，继续挑战猫咪2048！',
      'remove-lowest-refill': '帮我补充一次消除机会，继续挑战猫咪2048！',
    };
    return titles[purpose];
  }

  private shareSource(purpose: SharePurpose): string {
    const sources: Record<SharePurpose, string> = {
      score: 'score_share',
      revive: 'revive_share',
      'undo-refill': 'undo_refill_share',
      'remove-lowest-refill': 'remove_refill_share',
    };
    return sources[purpose];
  }

  private cardPrompt(purpose: SharePurpose): string {
    const prompts: Record<SharePurpose, string> = {
      score: '猫咪2048 · 来挑战我的分数',
      revive: '猫咪2048 · 帮我继续挑战',
      'undo-refill': '猫咪2048 · 帮我补充撤回',
      'remove-lowest-refill': '猫咪2048 · 帮我补充消除',
    };
    return prompts[purpose];
  }
}
