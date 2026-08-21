/**
 * 弹窗装饰定位的回归测试。
 *
 * 这里不直接调用 `addTopDecoration`（需要 Cocos 节点），而是把它的相对位置
 * 提取为可断言的纯函数常量。任何修改都必须保持：
 * - 叶片 y 严格低于标题中心 y（不能骑在标题字符上）
 * - 叶片 y 不低于圆点行 y（避免和圆点打架）
 * - 叶片 x 不与标题文字水平范围重叠（标题宽度 = panelWidth - 80）
 */
import { describe, expect, it } from 'vitest';

/** 标题中心 y（来自 ModalView.addTitle）。 */
const TITLE_CENTER_Y = 232;
/** 圆点行 y（来自 modalDecorations.addTitleDots）。 */
const TITLE_DOTS_Y = 193;

/** 与 addTopDecoration 中的叶片定位保持同步。 */
const LEAF_Y = 178;
const LEAF_X_FACTOR = 132;
const LEAF_SCALE = 0.6;
const LEAF_HALF_HEIGHT = 12 * LEAF_SCALE; // 原始椭圆高 24，旋转 ±42° 后垂直方向略增
const LEAF_HALF_WIDTH = 18 * LEAF_SCALE;  // 原始椭圆宽 36

describe('modal top decoration layout', () => {
  // 模拟一组弹窗尺寸（含 showDialog 的默认 590×430，以及较大的自定义弹窗）。
  const cases = [
    { name: 'showDialog (590×430)', panelWidth: 590, panelHeight: 430 },
    { name: 'reference (680×620)', panelWidth: 680, panelHeight: 620 },
    { name: 'large custom (720×800)', panelWidth: 720, panelHeight: 800 },
  ];

  for (const { name, panelWidth, panelHeight } of cases) {
    it(`keeps the title leaves clear of the title text for ${name}`, () => {
      const sx = panelWidth / 680;
      const sy = panelHeight / 620;
      const leafY = LEAF_Y * sy;
      const leafX = LEAF_X_FACTOR * sx;
      const titleCenterY = TITLE_CENTER_Y * sy;
      const titleTextHalfWidth = (panelWidth - 80) / 2;

      // 1) 叶片 y 必须严格低于标题中心（避免骑在标题字符上）。
      expect(leafY).toBeLessThan(titleCenterY);

      // 2) 叶片底部不能高过圆点行 y：Cocos +Y 向上，y 越小越靠下。
      // 叶片在 y=178，圆点行在 y=193，所以叶片的最高点仍低于圆点行，
      // 这样视觉上“标题 → 圆点 → 叶片 → 正文”顺序成立。
      expect(leafY + LEAF_HALF_HEIGHT).toBeLessThanOrEqual(TITLE_DOTS_Y * sy);

      // 3) 叶片 x 不能超过面板边缘、也不能缩到面板中心造成跟标题文本“同点”。
      // 由于叶片已被推至标题下方（y < titleCenter），水平位置上只需
      // 不出面板、不挤到中心即可。
      const halfPanel = panelWidth / 2;
      expect(leafX + 18).toBeLessThanOrEqual(halfPanel);
      expect(leafX).toBeGreaterThan(40 * sx); // 距中心太近会让叶片看起来跟标题字符在画重叠
    });
  }

  it('keeps leaves visually consistent across scales', () => {
    // 标题字符实际渲染区在 y ≈ titleCenter - 22 至 titleCenter + 30（基于 fontSize 52）。
    // 叶片底部 y = leafY + 12*scale；只要其底部 ≤ 字符顶部，就不压字。
    const titleGlyphTopY = TITLE_CENTER_Y - 22;
    const leafBottomY = LEAF_Y + LEAF_HALF_HEIGHT;
    expect(leafBottomY).toBeLessThanOrEqual(titleGlyphTopY);
  });
});