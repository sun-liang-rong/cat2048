# Shop Default Cosmetics Design

**Date:** 2026-08-03

**Status:** Approved for implementation planning

## Goal

Show the default cosmetic in each of the four shop categories alongside the
currently purchasable cosmetics:

- cat skin
- board
- merge effect
- button theme

## Root Cause

`ShopView` renders `EconomySnapshot.catalog`, but the local economy snapshot
currently exposes only `SHOP_ITEMS`. The default definitions are present in
`allCosmetics()` and in the default owned/equipped state, so they can be used
in the game but never reach the shop list.

## Design

Use `allCosmetics()` as the catalog exposed by `EconomySnapshot`. Keep
`SHOP_ITEMS` as the purchase-only catalog used by
`LocalEconomyRepository.purchase()`. This keeps display data complete without
allowing default cosmetics to be purchased again or charging coins for them.

Default definitions should use existing runtime assets where those assets are
already available. The shop can keep its existing category-color fallback for
the button theme default when no dedicated theme preview asset exists.

No `ShopView` filtering change is required: it already filters the complete
catalog by category and derives the action from ownership and equipped state.

## Data Flow

1. `catalog.ts` defines default and purchasable cosmetics.
2. `LocalEconomyRepository.snapshot()` returns `allCosmetics()` as
   `EconomySnapshot.catalog`.
3. `ShopView` renders all entries for the selected category.
4. Owned default entries show the equipped or equip action; purchasable
   unowned entries continue to show their price.
5. Purchase requests still resolve only against `SHOP_ITEMS`.

## Testing

- Verify the complete catalog contains one default item for each category.
- Verify a loaded economy snapshot exposes default and purchasable items.
- Verify attempting to purchase a default item is rejected without changing
  the coin balance.
- Keep the existing purchase, equip, and duplicate-purchase coverage passing.

## Scope

This change does not add new cosmetic assets, alter prices, change ownership
migration rules, or change the shop layout and interactions.
