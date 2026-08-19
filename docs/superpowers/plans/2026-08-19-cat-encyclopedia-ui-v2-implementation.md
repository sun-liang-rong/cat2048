# Cat Encyclopedia UI V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Cocos Creator collection screen to match the supplied cat encyclopedia design, preserving existing cats, unlock state and return behavior.

**Architecture:** Generate a no-text collection UI art family with the project-local art skill, then import final PNGs into Cocos resources. `GAME_CONFIG` and `ArtRepository` own resource paths while `CollectionView` uses a pure layout helper to compose a safe-area-aware header and clipped three-column static grid from art frames and existing cat sprites.

**Tech Stack:** Cocos Creator 3.8, TypeScript, Vitest, project-local `skills/generate-kitchen-game-art` image generator.

---

### Task 1: Define reproducible collection art

**Files:**
- Create: `assets/collection-v2/manifest.json`
- Create: `assets/collection-v2/README.md`

- [ ] Define six no-text assets: `collection_background`, `collection_card_light`, `collection_card_locked`, `collection_back_paw`, `collection_locked_cat`, and `collection_lock`. Use a unified warm watercolor picture-book style; UI outputs must be chroma-key transparent and the background must target portrait 750x1334 composition.
- [ ] Run `python skills\generate-kitchen-game-art\scripts\generate_assets.py --check-config` and `python skills\generate-kitchen-game-art\scripts\generate_assets.py --manifest assets\collection-v2\manifest.json --check-manifest`; both must exit `0` without exposing credentials.
- [ ] Generate and inspect `collection_card_light` first with `--only collection_card_light`, then generate all assets into `assets\collection-v2\images`. Reject watermarks, text, malformed edges, opaque UI backgrounds, or unreadable card silhouettes.

### Task 2: Establish failing regression tests

**Files:**
- Create: `game/tests/collectionLayout.test.ts`
- Modify: `game/tests/runtime-assets.test.ts`

- [ ] Write tests for a new `collectionLayout()` helper: a 750px-wide viewport produces exactly three equal columns, 12 entries produce four rows, the header stays below the top inset, and the scroll viewport ends above the bottom inset.
- [ ] Run `npm test -- --run tests/collectionLayout.test.ts` and verify it fails because `collectionLayout` does not exist.
- [ ] Add expected generated collection PNGs to `runtime-assets.test.ts`, run `npm test -- --run tests/runtime-assets.test.ts`, and verify it fails before resource import.

### Task 3: Import and register generated art

**Files:**
- Create: `game/assets/resources/game/ui/collection/collection_*.png`
- Create: matching `game/assets/resources/game/ui/collection/collection_*.png.meta`
- Modify: `game/assets/scripts/infrastructure/gameConfig.ts`
- Modify: `game/assets/scripts/presentation/ArtRepository.ts`

- [ ] Copy the selected six generated PNGs under stable names and create Cocos image metadata consistent with existing resources.
- [ ] Add six collection art paths to `GAME_CONFIG.art` and `ArtRepository.startupFramePaths()`.
- [ ] Run `npm test -- --run tests/collectionLayout.test.ts tests/runtime-assets.test.ts`; both focused suites must pass.

### Task 4: Rebuild collection layout and behavior

**Files:**
- Create: `game/assets/scripts/presentation/collectionLayout.ts`
- Modify: `game/assets/scripts/presentation/CollectionView.ts`
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [ ] Implement the tested pure layout helper with explicit header, viewport, three-column card and content-height values.
- [ ] Compose the generated paper background, paw back button, cards, locked silhouette and lock when available, while retaining `Graphics` fallbacks.
- [ ] Overlay Cocos labels for “猫咪图鉴”, unlock progress, level and existing Chinese cat names. Use `ScrollView` and a `Mask` for the card content.
- [ ] Delete the detail overlay, card touch listeners and related imports. Keep only the header back action.
- [ ] Ensure `showCollection()` loads the six collection paths before `CollectionView.build()` and retains the existing fallback behavior on load failure.
- [ ] Run `npm test -- --run tests/collectionLayout.test.ts tests/runtime-assets.test.ts` and `npm run typecheck:core`; both must exit `0`.

### Task 5: Full verification and visual QA

**Files:**
- Modify only files above if verification exposes a defect.

- [ ] Run `npm run verify`; TypeScript and Vitest must exit `0`.
- [ ] Inspect every generated asset at native resolution and the rendered portrait collection screen at desktop and mobile-like dimensions. Confirm readable labels, no overlap, three columns, scrollable lower rows, static cards and a working return button.
