import { describe, expect, it } from 'vitest';
import { selectLabelFont } from '../assets/scripts/ui/styles/fontPolicy';

describe('label font policy', () => {
  it('keeps numeric score values on a dynamic-safe font path', () => {
    expect(selectLabelFont('display', '0')).toBe('display');
    expect(selectLabelFont('display', '36')).toBe('display');
    expect(selectLabelFont('display', '9480')).toBe('display');
  });

  it('still uses the number font for static mixed level labels', () => {
    expect(selectLabelFont('display', 'Lv1')).toBe('number');
    expect(selectLabelFont('display', 'Lv.9')).toBe('number');
  });
});
