# Home Leaderboard Layout Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD checkpoints.

**Goal:** Move the leaderboard from the home bottom dock into a prominent horizontal button below classic mode.

**Architecture:** Keep `HomeViewActions.onLeaderboard` unchanged. Add the leaderboard button to the existing content stack and derive bottom-dock positions from the remaining five entries through a pure layout helper.

**Tech Stack:** TypeScript, Cocos Creator UI nodes, Vitest.

---

### Task 1: Test centered dock positions

**Files:**
- Modify: `game/tests/layout.test.ts`
- Modify: `game/assets/scripts/presentation/layout.ts`

- [ ] **Step 1:** Add a test asserting `homeActionDockPositions(5)` returns `[-232, -116, 0, 116, 232]`.
- [ ] **Step 2:** Run the focused layout test and observe failure because the helper is not defined.
- [ ] **Step 3:** Implement the helper and use it for the dock positions.

### Task 2: Recompose the home actions

**Files:**
- Modify: `game/assets/scripts/presentation/HomeView.ts`

- [ ] **Step 1:** Add a 500x76 teal `排行榜` button below the classic-mode button, keeping `actions.onLeaderboard` as its tap handler.
- [ ] **Step 2:** Remove the leaderboard icon and label from the dock and use the five centered positions for the remaining actions.
- [ ] **Step 3:** Run the full game typecheck and test suite.

### Task 3: Final verification

**Files:**
- No additional files.

- [ ] **Step 1:** Run `git diff --check`.
- [ ] **Step 2:** Run `npm run verify` from `game/` and confirm all tests pass.
