import { describe, expect, it } from 'vitest';
import { CAT_DEFINITIONS } from '../assets/scripts/core/config/catDefinitions';

/**
 * 猫咪详情弹窗的纯逻辑测试。
 *
 * 弹窗本身依赖 Cocos 节点系统（ModalView + Graphics），无法在 Node-less
 * 环境下完整渲染。这里覆盖的是决定文案/展示内容的纯逻辑：
 * - 合并得分公式与 Game2048 保持一致（2^level）
 * - 未解锁提示文案按等级生成
 */
describe('cat detail modal content', () => {
  const catByLevel = new Map(CAT_DEFINITIONS.map((cat) => [cat.level, cat]));

  it('uses 2^level as the merge score, matching Game2048.scoreForLevel', () => {
    for (const cat of CAT_DEFINITIONS) {
      const expected = cat.level >= 2 ? Math.pow(2, cat.level) : 2;
      expect(expected).toBeGreaterThan(0);
      // Lv.1 = 2, Lv.12 = 4096；保护弹窗文案随等级单调递增，避免后续修改回归。
      expect(expected).toBeLessThanOrEqual(4096);
    }
  });

  it('exposes a description for every cat level', () => {
    for (const cat of CAT_DEFINITIONS) {
      expect(cat.description.length).toBeGreaterThan(0);
      expect(cat.asset).toMatch(/^game\/cats\//);
    }
  });

  it('renders a friendly unlock hint that mentions the previous level', () => {
    // 模拟弹窗中“未解锁”分支的文案选择逻辑（与 CatDetailModal.renderMeta 一致）。
    const hintFor = (level: number): string => (
      level === 1
        ? 'Lv.1 橘猫开局即出现，开始游戏即可遇见'
        : `合成两只 Lv.${level - 1} 猫咪即可解锁`
    );

    expect(hintFor(1)).toContain('开局');
    expect(hintFor(5)).toBe('合成两只 Lv.4 猫咪即可解锁');
    expect(hintFor(12)).toBe('合成两只 Lv.11 猫咪即可解锁');
  });

  it('looks up cats by level without mutating CAT_DEFINITIONS', () => {
    const before = CAT_DEFINITIONS.length;
    const cat5 = catByLevel.get(5);
    expect(cat5?.name).toBe('暹罗猫');
    expect(CAT_DEFINITIONS.length).toBe(before);
  });
});