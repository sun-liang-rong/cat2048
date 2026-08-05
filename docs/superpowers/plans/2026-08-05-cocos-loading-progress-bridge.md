# Cocos Loading Progress Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Cocos Creator WeChat first screen visible until the project's remote runtime assets finish loading, while removing the project's separate loading view.

**Architecture:** A source-controlled Cocos builder extension patches the generated WeChat `game.js` after each build. The patched bootstrap exposes progress and ready callbacks on `globalThis`; `Cat2048Boot` reports `resources/game` loading progress through those callbacks and no longer creates `LoadingView`.

**Tech Stack:** Cocos Creator 3.8.8 builder extension, Node.js ESM, TypeScript, Vitest.

---

### Task 1: Define the runtime bridge contract

**Files:**
- Create: `game/assets/scripts/presentation/cocosLoadingBridge.ts`
- Test: `game/tests/cocosLoadingBridge.test.ts`

- [ ] **Step 1: Add tests for progress mapping and lifecycle calls**

Define a test-only global bridge with `setProgress`, `markReady`, and `markError`, then assert that runtime ratios are clamped and forwarded unchanged to the generated bridge. Assert that ready and error callbacks are optional and never throw when the game runs without the WeChat build hook.

- [ ] **Step 2: Implement the minimal bridge adapter**

Export `reportCocosLoadingProgress(ratio)`, `markCocosLoadingReady()`, and `markCocosLoadingError(error)`. Read the bridge from `globalThis` using the stable keys `__cat2048CocosLoading`, `setProgress`, `markReady`, and `markError`. Clamp progress to `[0, 1]`; keep the adapter a no-op on browser preview and other platforms.

### Task 2: Remove the project-owned loading screen without removing the resource barrier

**Files:**
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`
- Delete: `game/assets/scripts/presentation/LoadingView.ts`
- Delete: `game/assets/scripts/presentation/LoadingView.ts.meta`
- Modify: `game/tests/startupSequence.test.ts`

- [ ] **Step 1: Remove `LoadingView` construction and loading-screen branches**

Remove the import, field, `'loading'` screen name, `showLoading()` method, and resize branch that rebuilds it. Keep `assetsReady` to prevent interaction before preload completes.

- [ ] **Step 2: Route resource progress into the bridge**

Keep `ArtRepository.preload()` and `runStartupSequence()`. Change the preload callback to `reportCocosLoadingProgress(ratio)`. After fonts are installed and `showHome()` completes, call `markCocosLoadingReady()`. On failure call `markCocosLoadingError(error)` and do not call `showHome()`.

- [ ] **Step 3: Update startup tests for the retained resource barrier**

Keep assertions that `onReady` waits for preload and `onError` prevents readiness. Add no test dependency on `LoadingView`; the bridge adapter owns platform-specific callbacks.

### Task 3: Patch Cocos' generated bootstrap after every WeChat build

**Files:**
- Modify: `tools/customize_wechat_loading.mjs`
- Modify: `tools/customize_wechat_loading.test.mjs`
- Create: `game/extensions/cat2048-loading/package.json`
- Create: `game/extensions/cat2048-loading/builder.mjs`

- [ ] **Step 1: Replace visual customization with a generated-bootstrap patcher**

Export `patchWeChatBootstrap(buildDirectory)`. Require `game.js` and `first-screen.js`. Replace the stable Cocos 3.8.8 startup chain so it creates `globalThis.__cat2048CocosLoading`, maps runtime progress into `0.6..0.99`, starts the application, waits for `markReady()`, and only then calls `firstScreen.end()`. Add the marker `CAT2048_COCOS_LOADING_BRIDGE` and return safely when already patched.

- [ ] **Step 2: Validate the patcher against a generated fixture**

Use a temporary `game.js` fixture containing the actual Cocos startup anchors. Assert that the patch is idempotent, that the marker occurs once, and that unsupported bootstrap text throws before writing.

- [ ] **Step 3: Register the Cocos builder hook**

Create an extension package with `contributions.builder: './builder.mjs'`. Export `onAfterBuild(options, result)` from `builder.mjs`; skip platforms other than `wechatgame`, resolve `result.dest` or `options.buildPath`, and invoke `patchWeChatBootstrap` for the generated output directory. Let patch errors reject the build hook so an unpatched build cannot be mistaken for a valid package.

- [ ] **Step 4: Preserve a CLI fallback**

Keep `customize:wechat-loading` as a compatibility command but change its output and behavior to apply the bootstrap bridge only. Remove the title generator and image replacement path so the generated Cocos logo and slogan remain untouched.

### Task 4: Align build verification and current documentation

**Files:**
- Modify: `tools/verify_wechat_build.mjs`
- Modify: `game/package.json`
- Modify: `game/README.md`
- Delete: `tools/generate_wechat_loading_title.py`

- [ ] **Step 1: Verify the Cocos first screen and bridge marker**

Require `first-screen.js`, `logo.png`, and `slogan.png`, then require the `CAT2048_COCOS_LOADING_BRIDGE` marker in `game.js`. Keep the existing package size, resource bundle, and image checks.

- [ ] **Step 2: Update commands and docs**

Point the npm command and README at the automatic extension hook and CLI fallback. Document that `useSplashScreen:false` and `separateEngine:false` do not remove Cocos' WeChat first screen; the hook keeps it visible through the remote resource barrier.

- [ ] **Step 3: Remove obsolete custom-loading assets tooling**

Delete only the title-generation path that is no longer used. Keep Cocos-generated loading assets in the build output.

### Task 5: Final source review

**Files:**
- Review all files changed by Tasks 1-4.

- [ ] **Step 1: Check source references**

Search for `LoadingView`, `CAT2048_CUSTOM_LOADING_SCREEN`, `generate_wechat_loading_title`, and stale verifier messages. The only remaining loading references should be Cocos bridge logic and the resource barrier.

- [ ] **Step 2: Review the generated bootstrap contract**

Confirm the patch calls `firstScreen.end()` only after `markReady()` and that the runtime adapter never reveals the home screen on a preload error.

