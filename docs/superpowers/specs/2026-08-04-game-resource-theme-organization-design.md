# Game Resource Theme Organization Design

**Date:** 2026-08-04

**Goal:** Reorganize the Cocos game resources by resource type and theme, then update every logical asset path and validation rule so the game continues to load the same assets.

## Confirmed Structure

The resource root remains `game/assets/resources/game/`. Resource type is the first directory level; theme or usage is the second level when it exists.

```text
game/assets/resources/game/
├─ backgrounds/
│  ├─ common/
│  │  ├─ bg_home.png
│  │  ├─ bg_page.png
│  │  └─ share_score_bg.png
│  └─ board/
│     ├─ wood/bg_board_wood.png
│     ├─ pink/bg_board_pink.png
│     └─ star/bg_board_star.png
├─ cats/
│  ├─ classic/cat_01.png ... cat_12.png
│  ├─ sunny/cat_01.png ... cat_09.png
│  └─ aurora/cat_01.png ... cat_09.png
├─ ui/
│  ├─ common/
│  │  ├─ logo.png
│  │  ├─ tile_empty.png
│  │  ├─ tile_selected.png
│  │  └─ existing shared UI icons
│  └─ button-themes/
│     ├─ berry/{primary,secondary,reward,cream}.png
│     └─ aurora/{primary,secondary,reward,cream}.png
├─ effects/
│  ├─ classic/{sparkle_small,merge_sparkle,merge_burst,max_halo}.png
│  ├─ aurora/{sparkle,burst,paw-sparkle,paw-burst}.png
│  └─ stars/{sparkle,burst,fish-sparkle,confetti-burst}.png
├─ fonts/
└─ audio/
```

`common` contains assets without theme variants. `fonts/` keeps the TTF, bitmap font descriptor, and its PNG atlas together. `audio/` remains a separate resource type even though it is not an image category.

## Migration Rules

The migration changes paths only; it does not edit image bytes, rename asset basenames, or regenerate asset UUIDs.

- Move `cats/cat_01.png` through `cats/cat_12.png` to `cats/classic/`.
- Move `cosmetics/cat-skins/sunny/` to `cats/sunny/` and `cosmetics/cat-skins/aurora/` to `cats/aurora/`.
- Move `backgrounds/bg_home.png`, `bg_page.png`, and `share_score_bg.png` to `backgrounds/common/`.
- Move each `bg_board_<theme>.png` to `backgrounds/board/<theme>/`.
- Move `branding/logo.png`, `gameplay/tile_empty.png`, and `gameplay/tile_selected.png` to `ui/common/`.
- Move the remaining root `ui/*.png` icons to `ui/common/`; keep `ui/button-themes/{berry,aurora}/` under `ui/button-themes/`.
- Move classic gameplay effect images to `effects/classic/`.
- Move `gameplay/effects/aurora_*` to `effects/aurora/`, removing the redundant `gameplay/effects` path segment.
- Move `gameplay/effects/stars_*` to `effects/stars/`, removing the redundant `gameplay/effects` path segment.
- Move every corresponding `.meta` file with its source asset. Existing directory metadata is moved when its directory is moved; new category directories may receive Cocos-generated metadata without changing asset UUIDs.
- Remove empty legacy directories only after all files and metadata have been moved.

## Code and Tooling Changes

All logical Cocos resource paths will match the new filesystem paths. The primary code changes are:

- Update default cat paths, background paths, tile paths, UI paths, and classic effect paths in `game/assets/scripts/infrastructure/gameConfig.ts`.
- Update default cat paths, skin paths, board theme paths, effect theme paths, and button theme paths in `game/assets/scripts/economy/catalog.ts`.
- Regenerate or update `game/assets/resources/game/asset-map.json` so every key points to the new logical asset path.
- Update `tools/prepare_runtime_assets.py` output destinations and any source-to-runtime mapping that still emits the old layout.
- Update `tools/customize_wechat_loading.mjs` to read the logo from `game/assets/resources/game/ui/common/logo.png`.
- Update tests, build checks, and README references that assert or document the old asset paths.
- Search the full repository after migration for `game/branding`, `game/cosmetics`, `game/gameplay`, and the old root `game/cats/cat_` patterns; no runtime or tooling reference may remain unless it is historical documentation explicitly describing the old layout.

## Loading Contract

`ArtRepository` continues to preload the single `game` resource directory and load `Texture2D`, `ImageAsset`, fonts, and audio by logical Cocos resource path. No loading API or startup sequence changes are needed. The refactor is successful only when all existing configured assets resolve under the new paths, including all three cat themes and all theme-specific board, effect, and button assets.

## Verification

The implementation will verify:

1. Every expected image has exactly one `.png` file and matching `.png.meta` file in its new category path.
2. No image remains under `game/assets/resources/game/branding`, `game/assets/resources/game/cosmetics`, or `game/assets/resources/game/gameplay`.
3. `asset-map.json` contains only paths that correspond to existing imported assets.
4. Repository searches find no stale runtime or tooling references to old paths.
5. The existing TypeScript typecheck, test suite, asset preparation validation, and WeChat build verifier pass.

No gameplay behavior, visual content, asset format, or bundle configuration is intentionally changed.
