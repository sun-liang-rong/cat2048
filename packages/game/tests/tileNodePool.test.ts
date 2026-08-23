/**
 * TileNodePool 行为仿真测试：用最小 cc mock 实际执行 build/applyLevel/release 路径，
 * 验证复用与新建的棋子节点都具备完整的等级徽章（Badge + Lv.N 文字）。
 */
import { describe, expect, it, vi } from 'vitest';

interface MockLikeNode {
  name: string;
  active: boolean;
  children: MockLikeNode[];
  components: Map<string, { string?: string; fontSize?: number }>;
}

/** 在棋子节点树中查找 Badge 及其文字（模拟 applyLevel 的查找路径）。 */
function findBadgeText(root: MockLikeNode): string | null {
  const surface = root.children.find((child) => child.name === 'Surface');
  const badge = surface?.children.find((child) => child.name === 'Badge');
  if (!badge) return null;
  const labelNode = badge.children[0];
  if (!labelNode) return null;
  // mock 中组件以类名注册，这里按鸭子类型找带 string 字段的 Label 组件
  const values = [...labelNode.components.values()];
  const label = values.find((component) => typeof component?.string === 'string');
  return label?.string ?? null;
}

function makeLayer(): MockLikeNode & { addChild(node: MockLikeNode): void } {
  const layer = {
    name: 'layer',
    active: true,
    children: [],
    components: new Map(),
    addChild(node: MockLikeNode): void {
      (this as unknown as { children: MockLikeNode[] }).children.push(node);
    },
  };
  return layer as unknown as MockLikeNode & { addChild(node: MockLikeNode): void };
}

vi.mock('cc', () => {
  class Ctor {}
  class Vec3 { public static ONE = new Vec3(1, 1, 1); constructor(public x = 0, public y = 0, public z = 0) {} }
  class Vec2 { constructor(public x = 0, public y = 0) {} }
  class Color {}
  class Component {
    public node: Ctor & Record<string, unknown>;
    constructor(node: Ctor & Record<string, unknown>) { this.node = node; }
  }
  class LabelComp extends Component {
    public string = '';
    public fontSize = 0;
    public color = {};
    public useSystemFont = true;
    public lineHeight = 0;
    static HorizontalAlign = { CENTER: 0 };
    static VerticalAlign = { CENTER: 0 };
    static Overflow = { SHRINK: 0 };
  }
  class SpriteComp extends Component {
    public spriteFrame: unknown = null;
    public sizeMode = '';
    static SizeMode = { CUSTOM: 'CUSTOM' };
  }
  class UiTransformComp extends Component {
    public setContentSize(): void {}
  }
  class GraphicsComp extends Component {
    public fillColor = {};
    public strokeColor = {};
    public lineWidth = 0;
    public clear(): void {}
    public roundRect(): void {}
    public fill(): void {}
    public stroke(): void {}
  }
  const NodeImpl = class {
    public name: string;
    public active = true;
    public angle = 0;
    public children: unknown[] = [];
    public parent: unknown = null;
    public isValid = true;
    public components = new Map<string, InstanceType<typeof Component>>();
    constructor(name = '') { this.name = name; }
    addChild(child: { parent?: unknown }): void {
      this.children.push(child);
      (child as { parent?: unknown }).parent = this;
    }
    removeFromParent(): void {
      const parent = this.parent as { children: unknown[] } | null;
      if (parent) {
        const index = parent.children.indexOf(this);
        if (index >= 0) parent.children.splice(index, 1);
        this.parent = null;
      }
    }
    getChildByName(name: string): unknown {
      return this.children.find((child) => (child as { name: string }).name === name) ?? null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getComponent(type: any): any {
      return this.components.get((type as { name: string }).name) ?? null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addComponent(type: any): any {
      const instance = new type(this);
      this.components.set((type as { name: string }).name, instance);
      return instance;
    }
    setPosition(): void {}
    setScale(): void {}
    setRotationFromEuler(): void {}
    destroy(): void { this.isValid = false; this.removeFromParent(); }
  };
  const chain = {
    to: () => chain,
    by: () => chain,
    delay: () => chain,
    call: () => chain,
    repeatForever: () => chain,
    start: () => undefined,
  };
  return {
    Node: NodeImpl,
    Vec3,
    Vec2,
    Color,
    Font: Ctor,
    Layers: { Enum: { UI_2D: 0 } },
    Mask: Ctor,
    SpriteFrame: Ctor,
    Label: LabelComp,
    Sprite: SpriteComp,
    UITransform: UiTransformComp,
    Graphics: GraphicsComp,
    Tween: { stopAllByTarget: (): void => undefined },
    tween: (): typeof chain => chain,
  };
});

import { TileNodePool, type TileViewContext } from '../assets/scripts/ui/components/board/TileView';
import type { ArtRepository } from '../assets/scripts/ui/utils/ArtRepository';
import type { CosmeticRuntime } from '../assets/scripts/ui/components/CosmeticRuntime';
import type { Tile } from '../assets/scripts/core/types';

function makeCtx(): TileViewContext {
  return {
    art: { frame: vi.fn().mockReturnValue(undefined) } as unknown as ArtRepository,
    cosmetics: {
      catFrame: vi.fn().mockReturnValue({ fake: true }),
      mergeSparkleFrame: vi.fn().mockReturnValue(undefined),
      mergeBurstFrame: vi.fn().mockReturnValue(undefined),
    } as unknown as CosmeticRuntime,
    positionFor: vi.fn(),
    pool: null as unknown as TileNodePool,
  };
}

function makeTile(level: number, id: string): Tile {
  return { id, level, row: 0, col: 0 };
}

describe('TileNodePool 等级徽章渲染', () => {
  it('全新构建的棋子具备 Lv 徽章文字', () => {
    const ctx = makeCtx();
    ctx.pool = new TileNodePool(20);

    const node = ctx.pool.acquire(makeTile(3, 'a'), makeLayer() as never, ctx);
    expect(findBadgeText(node as unknown as MockLikeNode)).toBe('Lv.3');
  });

  it('复用池中节点后徽章文字随新等级更新', () => {
    const ctx = makeCtx();
    ctx.pool = new TileNodePool(20);

    const first = ctx.pool.acquire(makeTile(2, 'a'), makeLayer() as never, ctx);
    ctx.pool.release(first);
    const reused = ctx.pool.acquire(makeTile(9, 'b'), makeLayer() as never, ctx);

    expect(reused).toBe(first);
    expect(findBadgeText(reused as unknown as MockLikeNode)).toBe('Lv.9');
  });

  it('连续 acquire 各自独立构建且文字正确', () => {
    const ctx = makeCtx();
    ctx.pool = new TileNodePool(20);

    const a = ctx.pool.acquire(makeTile(1, 'a'), makeLayer() as never, ctx);
    const b = ctx.pool.acquire(makeTile(12, 'b'), makeLayer() as never, ctx);
    expect(findBadgeText(a as unknown as MockLikeNode)).toBe('Lv.1');
    expect(findBadgeText(b as unknown as MockLikeNode)).toBe('Lv.12');
  });

  it('release 后 destroyAll 清空池，再次 acquire 全新构建', () => {
    const ctx = makeCtx();
    ctx.pool = new TileNodePool(20);

    const first = ctx.pool.acquire(makeTile(5, 'a'), makeLayer() as never, ctx);
    ctx.pool.release(first);
    ctx.pool.destroyAll();
    const fresh = ctx.pool.acquire(makeTile(7, 'c'), makeLayer() as never, ctx);

    expect(fresh).not.toBe(first);
    expect(findBadgeText(fresh as unknown as MockLikeNode)).toBe('Lv.7');
  });
});
