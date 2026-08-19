# Cat Encyclopedia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Cocos Creator collection screen to match the provided cat encyclopedia design without a bottom navigation bar.

**Architecture:** Keep `Cat2048Boot` as the screen owner and `CollectionView` as the isolated view. Add the supplied `tujian` textures to the runtime resources bundle, expose their frames through `ArtRepository`, then let `CollectionView` compose the fixed header, scrollable three-column catalog, and existing detail overlay.

**Tech Stack:** Cocos Creator 3.x, TypeScript, `Graphics`, `Sprite`, `ScrollView`, existing UI factory helpers.

---

### Task 1: Add encyclopedia textures to runtime resources

**Files:**
- Create: `game/assets/resources/game/ui/collection/*.png`
- Create: matching Cocos `.meta` files through the project asset pipeline if available

- [ ] Copy the seven source textures from `assets/tujian/` into `game/assets/resources/game/ui/collection/` while preserving PNG content and stable names: `title`, `card_light`, `card_dark`, `paw`, `panel`, `locked_cat_card`, `lock`.
- [ ] Keep the runtime paths under `game/ui/collection/.../texture` so `resources.load` can resolve them.

### Task 2: Register encyclopedia frames

**Files:**
- Modify: `game/assets/scripts/infrastructure/gameConfig.ts`
- Modify: `game/assets/scripts/presentation/ArtRepository.ts`

- [ ] Add the seven collection texture paths under `GAME_CONFIG.art.collection*`.
- [ ] Include all collection paths in `ArtRepository.startupFramePaths()` so the screen can render immediately after startup.

### Task 3: Rebuild the collection view layout

**Files:**
- Modify: `game/assets/scripts/presentation/CollectionView.ts`

- [ ] Remove `BottomNavigation` imports, construction, and `build()` call.
- [ ] Use the collection title and paw textures when available, with the existing drawn fallbacks retained.
- [ ] Recompose the header at the existing design resolution: title, 516px progress track, and safe-area-aware scroll viewport.
- [ ] Render three columns of 188px cards with light and dark card surfaces, cat sprites for unlocked entries, and the locked-cat/lock textures for locked entries.
- [ ] Preserve touch scale feedback, vertical scrolling, and the existing detail overlay.
- [ ] Keep the view model/actions signatures compatible with `Cat2048Boot`.

### Task 4: Ensure collection assets are loaded on the collection route

**Files:**
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [ ] Add the collection texture paths to the asset load list used before `renderCollection()`.
- [ ] Leave navigation behavior unchanged except that the collection screen itself has no bottom dock.

### Task 5: TypeScript syntax pass

**Files:**
- Modify only files from Tasks 2-4 as needed.

- [ ] Run the project TypeScript compiler or the existing game typecheck command and fix syntax/type errors only; no visual verification is required for this request.
