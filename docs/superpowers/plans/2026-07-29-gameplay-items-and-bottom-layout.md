# Gameplay Items And Bottom Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the gameplay board into the lower one-hand reach area and add one-use undo and remove-three-lowest item controls beneath it.

**Architecture:** Keep all board mutations and per-game item state in the engine-independent `Game2048` core. Extend the pure layout calculator with an item-bar position, while `Cat2048Boot` owns only Cocos nodes, enabled styling, input locking, and feedback animation.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, Vitest

---

### Task 1: Core item behavior

**Files:**
- Modify: `game/assets/scripts/core/types.ts`
- Modify: `game/assets/scripts/core/Game2048.ts`
- Test: `game/tests/core.test.ts`

- [x] Add failing tests proving that one undo restores the previous board and score, ineffective moves preserve undo history, remove-lowest uses level/row/column ordering, empty operations do not consume an item, successful removal clears undo history, and `start()` restores both item counts.
- [x] Run `npm test -- tests/core.test.ts` and confirm failures are caused by missing item APIs.
- [x] Add `ItemState`, `UndoResult`, and `RemoveTilesResult` contracts; store one immutable pre-move snapshot; implement `undo()` and `removeLowestTiles(3)` in `Game2048`.
- [x] Run `npm test -- tests/core.test.ts` and confirm all core tests pass.

### Task 2: Responsive board and item-bar placement

**Files:**
- Modify: `game/assets/scripts/presentation/layout.ts`
- Test: `game/tests/layout.test.ts`

- [x] Replace the instruction-position assertions with failing assertions for `itemBarCenterFromTop`, bottom-safe-area clearance, non-overlap, and a lower tall-screen board position.
- [x] Run `npm test -- tests/layout.test.ts` and confirm failure because the item-bar layout is absent.
- [x] Calculate board scale from the space remaining after the HUD, item bar, gap, comfort inset, and safe area; bias unused vertical space toward placing the operation group lower.
- [x] Run `npm test -- tests/layout.test.ts` and confirm tall, short, and compact viewport cases pass.

### Task 3: Cocos item controls and feedback

**Files:**
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [x] Add two 96-unit-high warm cream/teal controls beneath the board with titles `撤回一步` and `消除最低×3`, plus remaining-count badges.
- [x] Derive enabled state from `game.items`; use opacity and guarded touch handlers for disabled state; refresh buttons after new game, effective movement, and item use.
- [x] Implement undo feedback by fading the tile layer, rebuilding from the core snapshot, updating the score without lowering the saved high score, and fading back in.
- [x] Implement removal feedback by shrinking the returned tile IDs in stable order, rebuilding the remaining board, and unlocking input only after animation completion.
- [x] Remove the old gameplay instruction label and position the item bar using `gameLayout`.

### Task 4: Verification

**Files:**
- Verify: all modified files

- [ ] Run `npm test` and require all Vitest suites to pass.
- [ ] Run `npm run typecheck:core`; if the pre-existing Node-type configuration failure remains, report it separately and run `npx tsc -p tsconfig.core.json --noEmit --types vitest/globals,node --target ES2022` after ensuring Node typings are available.
- [ ] Run `git diff --check`, inspect `git diff`, and confirm the existing WeChat build-setting changes are untouched.
- [ ] Report changed behavior, verification evidence, and any Cocos-editor-only visual check still required.
