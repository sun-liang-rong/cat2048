# Gameplay UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Cocos Creator gameplay screen to match the supplied cat merge design while preserving gameplay behavior.

**Architecture:** Import the supplied gameplay artwork into `resources`, register it in `GAME_CONFIG.art`, and load it through `ArtRepository`. Recompose the existing presentation views in place: `GameScreen` positions HUD/board/items, `EvolutionPanelView` renders the route, `BoardView` owns tile visuals, and `ItemBarView` keeps current item callbacks.

**Tech Stack:** Cocos Creator 3.x, TypeScript, `Sprite`, `Graphics`, `Tween`, existing presentation views.

---

### Task 1: Import gameplay interface textures

**Files:**
- Create: `game/assets/resources/game/ui/gameplay/board_center.png`
- Create: `game/assets/resources/game/ui/gameplay/button_broom.png`
- Create: `game/assets/resources/game/ui/gameplay/button_paw.png`
- Create: `game/assets/resources/game/ui/gameplay/grid_4x4.png`
- Create: `game/assets/resources/game/ui/gameplay/instruction_panel.png`
- Create: `game/assets/resources/game/ui/gameplay/tile_yellow.png`
- Create: `game/assets/resources/game/ui/gameplay/wood_slot_left.png`
- Create: `game/assets/resources/game/ui/gameplay.meta` and texture `.meta` files
- Create: `game/assets/resources/game/ui/common/gameplay_back.png` and its `.meta` file

- [ ] Copy the seven `assets/youxi` PNGs to `game/assets/resources/game/ui/gameplay/` and copy `assets/shangdian/01_back_button.png` to `game/assets/resources/game/ui/common/gameplay_back.png`.
- [ ] Give each imported PNG a Cocos image importer `.meta` whose texture subasset is named `texture`.

### Task 2: Add runtime art paths

**Files:**
- Modify: `game/assets/scripts/infrastructure/gameConfig.ts`
- Modify: `game/assets/scripts/presentation/ArtRepository.ts`

- [ ] Add `gameplayBack`, `gameplayBoard`, `gameplayTile`, `gameplayEvolutionPanel`, `gameplayUndoButton`, `gameplayRemoveButton`, `gameplayBoardCenter`, and `gameplayWoodSlot` to `GAME_CONFIG.art` using `game/ui/.../texture` resource paths.
- [ ] Include each new path in `ArtRepository.startupFramePaths()` so gameplay can display the artwork without a route-specific loading delay.

### Task 3: Restyle top HUD and composition

**Files:**
- Modify: `game/assets/scripts/presentation/GameScreen.ts`
- Modify: `game/assets/scripts/presentation/layout.ts`

- [ ] Render the return control from `GAME_CONFIG.art.gameplayBack` and retain its existing `onBack` callback.
- [ ] Keep settings callback active, move it to an unobtrusive safe-area position, and restyle the two score cards as wood-toned rounded capsules.
- [ ] Adjust `gameLayout()` vertical spacing so the HUD, 180-236px evolution panel, board, and 96px item bar fit with the design's clear hierarchy while retaining responsive scale constraints.

### Task 4: Restyle route, board, tiles, and items

**Files:**
- Modify: `game/assets/scripts/presentation/EvolutionPanelView.ts`
- Modify: `game/assets/scripts/presentation/BoardView.ts`
- Modify: `game/assets/scripts/presentation/ItemBarView.ts`

- [ ] Use `gameplayEvolutionPanel` behind the evolution route while retaining the collection button, current/next cat labels, and progress state.
- [ ] Use `gameplayBoard` as the board background and `gameplayTile` as the visual base for empty cells and cats while retaining tile coordinates, merge effects, and touch highlights.
- [ ] Use `gameplayUndoButton` and `gameplayRemoveButton` as the two item controls; retain all existing `ItemState` refresh, disabled, refill, touch, and callback behavior.

### Task 5: Finish source-level review

**Files:**
- Review: `game/assets/scripts/infrastructure/gameConfig.ts`
- Review: `game/assets/scripts/presentation/ArtRepository.ts`
- Review: `game/assets/scripts/presentation/GameScreen.ts`
- Review: `game/assets/scripts/presentation/EvolutionPanelView.ts`
- Review: `game/assets/scripts/presentation/BoardView.ts`
- Review: `game/assets/scripts/presentation/ItemBarView.ts`

- [ ] Check that every `GAME_CONFIG.art.gameplay*` reference is declared and that all methods retain their existing public signatures.
- [ ] Do not run test, build, or visual verification commands because the user explicitly requested code-only delivery.
