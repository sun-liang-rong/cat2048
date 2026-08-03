# Shop Default Cosmetics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the default cosmetic in each shop category while keeping default cosmetics free and non-purchasable.

**Architecture:** The catalog module remains the single source for all cosmetic definitions. `EconomySnapshot.catalog` will expose `allCosmetics()`, while `LocalEconomyRepository.purchase()` will continue to resolve only against `SHOP_ITEMS`; `ShopView` will use its existing category filtering and ownership actions.

**Tech Stack:** TypeScript, Vitest, Cocos Creator asset path strings.

---

### Task 1: Add the regression coverage

**Files:**
- Modify: `game/tests/catalog.test.ts`
- Modify: `game/tests/economy.test.ts`

- [x] **Step 1: Add catalog assertions for the four default entries and available previews**

In `game/tests/catalog.test.ts`, import `allCosmetics` and add this test inside the existing `cosmetic catalog` suite:

```ts
it('includes default cosmetics in every category with available previews', () => {
  const defaults = allCosmetics().filter((item) => item.price === 0);

  expect(defaults.map((item) => item.id)).toEqual([
    'cat-skin.default', 'board.wood', 'effect.classic', 'button-theme.classic',
  ]);
  expect(defaults.map((item) => item.previewAsset)).toEqual([
    'game/cats/cat_01/texture',
    'game/backgrounds/bg_board_wood/texture',
    'game/gameplay/merge_burst/texture',
    undefined,
  ]);
});
```

- [x] **Step 2: Add the shop snapshot regression test**

In `game/tests/economy.test.ts`, import `allCosmetics` and add this test inside the existing `LocalEconomyRepository` suite:

```ts
it('exposes default cosmetics in the shop catalog', async () => {
  const repository = new LocalEconomyRepository(new MemoryStorage());
  const snapshot = await repository.load();

  expect(snapshot.catalog.map((item) => item.id)).toEqual(allCosmetics().map((item) => item.id));
});
```

- [x] **Step 3: Add the default purchase guard test**

In `game/tests/economy.test.ts`, add this test inside the existing `LocalEconomyRepository` suite:

```ts
it('does not allow purchasing a default cosmetic', async () => {
  const repository = new LocalEconomyRepository(new MemoryStorage());

  const result = await repository.purchase('cat-skin.default');

  expect(result.ok).toBe(false);
  expect(result.reason).toBe('invalid-item');
  expect(result.coins).toBe(DEFAULT_ECONOMY.coins);
});
```

- [x] **Step 4: Run the focused tests and verify the new behavior is red**

Run from `game/`:

```powershell
npm test -- tests/catalog.test.ts tests/economy.test.ts
```

Expected result: the new preview test fails because default definitions have no preview assets, and the shop catalog test fails because the snapshot currently contains only `SHOP_ITEMS`. The default purchase guard remains passing.

### Task 2: Expose complete catalog data and default previews

**Files:**
- Modify: `game/assets/scripts/economy/catalog.ts`
- Modify: `game/assets/scripts/economy/economy.ts`

- [x] **Step 1: Add default runtime preview paths**

In `game/assets/scripts/economy/catalog.ts`, define the default cat level paths before `DEFAULT_ITEM_DEFINITIONS` and add the existing runtime preview paths to each default item:

```ts
const defaultCatAssets: readonly string[] = Array.from({ length: 9 }, (_, index) =>
  `game/cats/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);

const DEFAULT_ITEM_DEFINITIONS: readonly CosmeticDefinition[] = [
  {
    id: 'cat-skin.default',
    category: 'cat-skin',
    name: 'classic cat',
    price: 0,
    previewAsset: defaultCatAssets[0],
    levelAssets: defaultCatAssets,
  },
  {
    id: 'board.wood',
    category: 'board',
    name: 'wooden den',
    price: 0,
    previewAsset: 'game/backgrounds/bg_board_wood/texture',
    boardAsset: 'game/backgrounds/bg_board_wood/texture',
  },
  {
    id: 'effect.classic',
    category: 'effect',
    name: 'classic merge',
    price: 0,
    previewAsset: 'game/gameplay/merge_burst/texture',
    sparkleAsset: 'game/gameplay/merge_sparkle/texture',
    burstAsset: 'game/gameplay/merge_burst/texture',
  },
  {
    id: 'button-theme.classic',
    category: 'button-theme',
    name: 'classic theme',
    price: 0,
  },
];
```

Keep the existing localized names if the project file already contains them; only the asset fields and default cat asset constant are required.

- [x] **Step 2: Return the complete catalog from economy snapshots**

In `game/assets/scripts/economy/economy.ts`:

1. Import `allCosmetics` from `./catalog`.
2. Change `EconomySnapshot.catalog` to `ReturnType<typeof allCosmetics>`.
3. Change the `snapshot()` return value from `catalog: SHOP_ITEMS` to `catalog: allCosmetics()`.
4. Leave `purchase()` using `SHOP_ITEMS.find(...)` unchanged so default items remain invalid purchase targets.

The resulting relevant code is:

```ts
import {
  allCosmetics,
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
  findCosmetic,
  SHOP_ITEMS,
  type CosmeticCategory,
  type EconomySaveData,
  type EquippedCosmetics,
} from './catalog';

export interface EconomySnapshot extends EconomySaveData {
  readonly catalog: ReturnType<typeof allCosmetics>;
  readonly canClaimDaily: boolean;
  readonly dailyReward: number;
}
```

And in `snapshot()`:

```ts
catalog: allCosmetics(),
```

- [x] **Step 3: Run the focused tests and verify they pass**

Run from `game/`:

```powershell
npm test -- tests/catalog.test.ts tests/economy.test.ts
```

Expected result: all tests in both files pass, including the default preview, complete shop catalog, and non-purchasable default assertions.

### Task 3: Run the existing regression suite

**Files:**
- No additional files.

- [x] **Step 1: Run all Vitest tests**

Run from `game/`:

```powershell
npm test
```

Expected result: Vitest exits with code 0 and reports no failed tests.

- [x] **Step 2: Review the final diff scope**

Run from the repository root:

```powershell
git diff -- game/assets/scripts/economy/catalog.ts game/assets/scripts/economy/economy.ts game/tests/catalog.test.ts game/tests/economy.test.ts
```

Confirm that the change only adds default preview metadata, exposes `allCosmetics()` in snapshots, and adds the regression tests. Do not stage or alter unrelated existing worktree changes.
