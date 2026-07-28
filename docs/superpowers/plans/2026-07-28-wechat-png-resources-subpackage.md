# WeChat PNG Resources Subpackage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore runtime images to PNG and emit the Cocos `resources` Asset Bundle as a local WeChat subpackage so every image exists in the WeChat virtual package without exceeding the main-package limit.

**Architecture:** Keep all logical `resources.load(...)` paths unchanged. Source-level tests enforce PNG assets and WeChat bundle metadata, while a standalone verifier inspects the generated `build/wechatgame` layout before the build is opened in WeChat Developer Tools.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Vitest, Node.js, Python/Pillow, WeChat Mini Game build output

---

### Task 1: Lock Source Asset Requirements

**Files:**
- Modify: `game/tests/runtime-assets.test.ts`
- Modify: `game/assets/resources.meta`

- [ ] **Step 1: Write failing PNG and subpackage tests**

Update the tests to require 34 `.png` images, reject `.webp`, verify every PNG metadata file contains `.png`, and verify `resources.meta` contains:

```json
"compressionType": { "wechatgame": "subpackage" },
"isRemoteBundle": { "wechatgame": false }
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/runtime-assets.test.ts`

Expected: FAIL because the current runtime assets are WebP and `resources.meta` has no WeChat compression configuration.

- [ ] **Step 3: Add the minimal bundle metadata**

Add the two platform maps to `game/assets/resources.meta` without changing its UUID, bundle name, or priority.

- [ ] **Step 4: Restore PNG assets and matching metadata**

Restore the tracked PNG metadata, run `python ../tools/prepare_runtime_assets.py` from `game`, and remove only the replaced WebP files and their metadata from `game/assets/resources/game`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- --run tests/runtime-assets.test.ts`

Expected: PASS with 34 PNG assets, no WebP assets, matching metadata, and WeChat subpackage configuration.

### Task 2: Verify Generated WeChat Layout

**Files:**
- Create: `tools/verify_wechat_build.mjs`
- Modify: `game/package.json`

- [ ] **Step 1: Write the build verifier before rebuilding**

The verifier must parse `game/build/wechatgame/game.json`, require a subpackage named `resources`, require PNG files under `subpackages/resources`, reject WebP files, reject runtime images under `assets/resources/native`, and require the main package excluding declared subpackage roots to stay below 4 MiB.

- [ ] **Step 2: Add an npm command**

Add:

```json
"verify:wechat-build": "node ../tools/verify_wechat_build.mjs"
```

- [ ] **Step 3: Run against the old build and verify RED**

Run: `npm run verify:wechat-build`

Expected: FAIL because the existing `game.json` declares only `main` and the images are WebP under `assets/resources/native`.

### Task 3: Rebuild and Verify End to End

**Files:**
- Regenerate ignored output: `game/build/wechatgame/**`

- [ ] **Step 1: Build with Cocos Creator 3.8.8**

Run Cocos Creator in command-line build mode for project `game` and platform `wechatgame`, using the existing project build profile after source assets have been fully imported.

- [ ] **Step 2: Verify the generated layout**

Run: `npm run verify:wechat-build`

Expected: PASS and report the PNG count, resources subpackage size, and main-package size.

- [ ] **Step 3: Run the complete project verification**

Run: `npm run verify`

Expected: all TypeScript checks and Vitest suites pass with no asset regeneration diff.

- [ ] **Step 4: Inspect the final worktree**

Run: `git status --short` and `git diff --check`.

Expected: only the intended source assets, metadata, tests, package command, verifier, and plan are changed; unrelated pre-existing changes remain untouched.
