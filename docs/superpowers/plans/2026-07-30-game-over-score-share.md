# Game-over Score Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a cat-and-score result card at game over and open the WeChat friend/group sharing panel.

**Architecture:** Add a platform-independent result sharing controller around a narrow WeChat Canvas API. Keep visual orchestration in the existing game-over flow and expose loaded image paths from the art repository.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, WeChat Mini Game Canvas API, Vitest, Python/Pillow asset preparation

---

### Task 1: Result share controller

**Files:**
- Create: `game/assets/scripts/infrastructure/ResultShareController.ts`
- Test: `game/tests/resultShare.test.ts`
- Modify: `game/tsconfig.core.json`

- [ ] Write tests that inject fake WeChat canvas/image APIs and assert card export and `shareAppMessage` arguments.
- [ ] Run `npm test -- resultShare.test.ts` and confirm it fails because the controller is missing.
- [ ] Implement `ResultShareController.share` with image loading, 1000 x 800 drawing, export, and explicit result states.
- [ ] Re-run `npm test -- resultShare.test.ts` and confirm all result-share tests pass.

### Task 2: Runtime artwork

**Files:**
- Modify: `tools/prepare_runtime_assets.py`
- Modify: `game/assets/scripts/infrastructure/gameConfig.ts`
- Modify: `game/assets/scripts/presentation/ArtRepository.ts`

- [ ] Add `share_score_bg.png` to generated background validation at 1000 x 800.
- [ ] Add its resource path to `GAME_CONFIG.art` and expose loaded image native URLs from `ArtRepository`.
- [ ] Run `npm run prepare:assets` and confirm the runtime score background is generated and validated.

### Task 3: Game-over integration

**Files:**
- Modify: `game/assets/scripts/presentation/DialogView.ts`
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [ ] Extend the dialog with an optional third action that remains open while invoking sharing.
- [ ] Derive the highest board cat at game over and pass its name and image to `ResultShareController`.
- [ ] Show a compact notice when sharing is unsupported or fails without changing score, board, home, or replay behavior.

### Task 4: Verification

**Files:**
- Verify all files above plus existing tests.

- [ ] Run `npm run verify` and confirm asset preparation, core type checking, and all Vitest tests pass.
- [ ] Run the WeChat build verifier when a current build directory exists; otherwise report that editor build verification remains outstanding.
- [ ] Inspect `git diff --check` and the scoped diff for whitespace errors and accidental changes.
