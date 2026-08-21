export const NUMBER_FONT_CHARACTERS = '0123456789Lv.+×';
const NUMBER_FONT_CHARACTER_SET = new Set(NUMBER_FONT_CHARACTERS);
const DIGIT_CHARACTER_SET = new Set('0123456789');
const DISPLAY_SYSTEM_FALLBACK_CHARACTER_SET = new Set('复活补充跳过查看已未解锁收录永久');

export type LabelFontKind = 'body' | 'display' | 'number';

export function selectLabelFont(style: 'body' | 'display', text: string): LabelFontKind {
  if (style === 'body') return 'body';
  const isNumberFontText = text.length > 0
    && [...text].every((character) => NUMBER_FONT_CHARACTER_SET.has(character))
    && [...text].some((character) => !DIGIT_CHARACTER_SET.has(character));
  if (isNumberFontText) {
    return 'number';
  }
  if ([...text].some((character) => DISPLAY_SYSTEM_FALLBACK_CHARACTER_SET.has(character))) return 'body';
  return 'display';
}
