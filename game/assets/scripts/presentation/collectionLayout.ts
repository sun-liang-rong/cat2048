export interface CollectionLayout {
  readonly columns: 3;
  readonly rows: number;
  readonly headerY: number;
  readonly progressY: number;
  readonly viewportTop: number;
  readonly viewportBottom: number;
  readonly viewportHeight: number;
  readonly gridWidth: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly columnGap: number;
  readonly rowGap: number;
  readonly contentPadding: number;
  readonly contentHeight: number;
}

const COLUMNS = 3 as const;
const MAX_CARD_WIDTH = 200;
const HORIZONTAL_MARGIN = 28;
const COLUMN_GAP = 16;
const ROW_GAP = 18;
const CONTENT_PADDING = 10;

export function collectionLayout(
  uiWidth: number,
  uiHeight: number,
  topInset: number,
  bottomInset: number,
  entries: number,
): CollectionLayout {
  const safeTop = uiHeight / 2 - topInset;
  const safeBottom = -uiHeight / 2 + bottomInset;
  const headerY = safeTop - 48;
  const progressY = headerY - 70;
  const viewportTop = progressY - 47;
  const viewportBottom = safeBottom + 24;
  const viewportHeight = Math.max(220, viewportTop - viewportBottom);
  const availableWidth = Math.max(300, uiWidth - HORIZONTAL_MARGIN * 2);
  const cardWidth = Math.min(MAX_CARD_WIDTH, Math.floor((availableWidth - COLUMN_GAP * 2) / COLUMNS));
  const gridWidth = cardWidth * COLUMNS + COLUMN_GAP * 2;
  const cardHeight = Math.round(cardWidth * 1.28);
  const rows = Math.ceil(Math.max(0, entries) / COLUMNS);
  const cardsHeight = rows > 0 ? rows * cardHeight + (rows - 1) * ROW_GAP : 0;
  const contentHeight = Math.max(viewportHeight, cardsHeight + CONTENT_PADDING * 2);

  return {
    columns: COLUMNS,
    rows,
    headerY,
    progressY,
    viewportTop,
    viewportBottom,
    viewportHeight,
    gridWidth,
    cardWidth,
    cardHeight,
    columnGap: COLUMN_GAP,
    rowGap: ROW_GAP,
    contentPadding: CONTENT_PADDING,
    contentHeight,
  };
}
