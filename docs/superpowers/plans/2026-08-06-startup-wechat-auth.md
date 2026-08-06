# Startup WeChat Authentication Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD checkpoints.

**Goal:** Authenticate the WeChat player after game startup while preventing duplicate login requests and preserving offline play.

**Architecture:** `LeaderboardClient` owns session state and an in-flight authentication promise. `Cat2048Boot` starts `ensureAuthenticated()` after assets are ready and the home screen is visible; authorized leaderboard requests use the same session and retain their current retry behavior.

**Tech Stack:** TypeScript, Cocos Creator runtime APIs, Vitest.

---

### Task 1: Add the concurrent startup-authentication regression test

**Files:**
- Modify: `game/tests/leaderboard.test.ts`
- Test: `game/tests/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

Add a `LeaderboardClient` test that starts `ensureAuthenticated()` and `getLeaderboard()` together with an empty storage. Mock the transport so the auth response resolves and the leaderboard response succeeds. Assert both promises resolve and `login.getLoginCode` is called once.

- [ ] **Step 2: Run the focused test**

Run from `game/`:

```bash
npx vitest run tests/leaderboard.test.ts -t "reuses an in-flight startup login"
```

Expected: FAIL because `ensureAuthenticated` does not exist yet.

### Task 2: Implement idempotent client authentication

**Files:**
- Modify: `game/assets/scripts/infrastructure/leaderboard.ts`
- Test: `game/tests/leaderboard.test.ts`

- [ ] **Step 1: Add the in-flight authentication state**

Add a private `loginInFlight` promise field. Extract the existing login request body into a private operation and make `ensureAuthenticated()` return the current stored player, reuse `loginInFlight`, or start one login operation. Clear `loginInFlight` in `finally`.

- [ ] **Step 2: Route authorized requests through the new operation**

Change `ensureAccessToken()` to call `ensureAuthenticated()` when there is no access token. Keep `login()` as the fresh-login path used after a 401, and preserve session persistence.

- [ ] **Step 3: Run the focused test**

Run:

```bash
npx vitest run tests/leaderboard.test.ts -t "reuses an in-flight startup login"
```

Expected: PASS with one login-code request.

### Task 3: Trigger authentication after startup

**Files:**
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [ ] **Step 1: Start background authentication after the home screen is ready**

Inside the existing `onReady` callback, after `showHome()`, call `void this.authenticateLeaderboard()` before flushing queued scores. Catch and log failures in the helper without changing the current screen.

- [ ] **Step 2: Run the game checks**

From `game/` run:

```bash
npm run typecheck:core
npm test
```

Expected: all existing tests pass and the core typecheck succeeds.

### Task 4: Verify the final behavior

**Files:**
- No additional files.

- [ ] **Step 1: Inspect the diff**

Run `git diff --check` and confirm only the leaderboard client, boot flow, regression test, and approved design/plan documents changed.

- [ ] **Step 2: Re-run the focused and full checks**

Run the focused test, full game test suite, and core typecheck again. Report any unavailable Cocos editor or WeChat Developer Tools verification separately.
