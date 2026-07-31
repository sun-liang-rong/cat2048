# Startup Resource Barrier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the loading experience visible until every `resources/game` asset is loaded, then show a complete home screen using the project branding logo on the WeChat first screen.

**Architecture:** A pure startup coordinator enforces the loading-before-home order and is covered by Vitest. `ArtRepository` performs a full `resources.loadDir('game')` barrier with progress reporting before populating its typed caches. A lightweight Cocos `LoadingView` bridges the generated first screen to the home screen, while the build verifier byte-compares the generated loading logo with the source branding logo.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, Vitest, Node.js 20, WeChat Mini Game build output

---

### Task 1: Lock Startup Ordering With a Pure Coordinator

**Files:**
- Create: `game/assets/scripts/presentation/startupSequence.ts`
- Create: `game/assets/scripts/presentation/startupSequence.ts.meta`
- Create: `game/tests/startupSequence.test.ts`
- Modify: `game/tsconfig.core.json`

- [ ] **Step 1: Write the failing startup-order tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { runStartupSequence } from '../assets/scripts/presentation/startupSequence';

describe('runStartupSequence', () => {
  it('keeps home hidden until preload resolves', async () => {
    let resolvePreload!: () => void;
    const preload = new Promise<void>((resolve) => { resolvePreload = resolve; });
    const onReady = vi.fn();
    const running = runStartupSequence({
      preload: () => preload,
      isActive: () => true,
      onReady,
      onError: vi.fn(),
    });

    expect(onReady).not.toHaveBeenCalled();
    resolvePreload();
    await running;
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('reports failure without showing home', async () => {
    const error = new Error('asset load failed');
    const onReady = vi.fn();
    const onError = vi.fn();
    await runStartupSequence({
      preload: () => Promise.reject(error),
      isActive: () => true,
      onReady,
      onError,
    });

    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- startupSequence.test.ts`

Expected: FAIL because `startupSequence.ts` does not exist.

- [ ] **Step 3: Implement the coordinator**

```ts
export interface StartupSequenceOptions {
  preload(): Promise<void>;
  isActive(): boolean;
  onReady(): void;
  onError(error: unknown): void;
}

export async function runStartupSequence(options: StartupSequenceOptions): Promise<void> {
  try {
    await options.preload();
    if (options.isActive()) options.onReady();
  } catch (error) {
    if (options.isActive()) options.onError(error);
  }
}
```

Add `assets/scripts/presentation/startupSequence.ts` to `tsconfig.core.json` and add the normal Cocos TypeScript metadata file.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- startupSequence.test.ts`

Expected: two passing tests.

### Task 2: Load the Complete Runtime Resource Directory

**Files:**
- Modify: `game/assets/scripts/presentation/ArtRepository.ts`

- [ ] **Step 1: Add a full-directory resource barrier**

Change `preload` to accept `onProgress?: (ratio: number) => void`, then begin with:

```ts
await new Promise<void>((resolve, reject) => {
  resources.loadDir('game',
    (finished, total) => onProgress?.(total > 0 ? finished / total : 0),
    (error) => {
      if (error) reject(error);
      else {
        onProgress?.(1);
        resolve();
      }
    });
});
```

Remove the required sprite and font catch blocks so missing required assets reject startup. Keep audio catches because audio is optional. Populate the existing frame/font maps after `loadDir` so all current consumers keep the same API.

- [ ] **Step 2: Type-check the repository integration**

Run: `npx tsc -p temp/tsconfig.cocos.json --noEmit`

Expected: exit code 0 using the Cocos Creator-generated type declarations.

### Task 3: Add the Scene Loading View and Startup Barrier

**Files:**
- Create: `game/assets/scripts/presentation/LoadingView.ts`
- Create: `game/assets/scripts/presentation/LoadingView.ts.meta`
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [ ] **Step 1: Build the lightweight loading view**

Create a `LoadingView` that uses `createUiNode`, `drawRounded`, and `createLabel` to render:

```ts
public build(parent: Node, width: number, height: number): void;
public setProgress(ratio: number): void;
public showError(): void;
```

The root fills the visible canvas with warm ivory. A centered `猫咪 2048` title, coral progress fill, dark warm track, and percentage label match the customized first screen. `setProgress` clamps the ratio to `[0, 1]`, redraws a stable-width bar without moving the layout, and updates the percentage. `showError` changes the label to `资源加载失败` and leaves the home screen hidden.

- [ ] **Step 2: Connect `Cat2048Boot.initialize` to the coordinator**

Replace the early `showHome()` flow with:

```ts
this.showLoading();
await runStartupSequence({
  preload: () => this.art.preload((ratio) => this.loadingView.setProgress(ratio)),
  isActive: () => this.isValid,
  onReady: () => {
    this.assetsReady = true;
    setRuntimeFonts(
      this.art.font(GAME_CONFIG.fonts.display) ?? null,
      this.art.font(GAME_CONFIG.fonts.numbers) ?? null,
    );
    this.showHome();
  },
  onError: (error) => {
    console.error('[Cat2048] Startup asset loading failed', error);
    this.loadingView.showError();
  },
});
```

Add `showLoading()` alongside `showHome()`. Update resize handling so `!assetsReady` rebuilds the loading view instead of calling `showHome()`.

- [ ] **Step 3: Run the startup test and core type-check**

Run: `npm test -- startupSequence.test.ts && npm run typecheck:core`

Expected: all focused tests pass and TypeScript exits 0.

### Task 4: Enforce the Branding Logo in Generated Builds

**Files:**
- Modify: `tools/verify_wechat_build.mjs`
- Modify: `tools/customize_wechat_loading.test.mjs`

- [ ] **Step 1: Add a failing byte-identity test for the logo helper**

Export `filesHaveSameBytes(left, right)` from `tools/customize_wechat_loading.mjs` and test it using temporary files with equal and unequal content:

```js
test('filesHaveSameBytes detects stale generated logos', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cat2048-logo-'));
  const source = join(directory, 'source.png');
  const generated = join(directory, 'generated.png');
  writeFileSync(source, Buffer.from([1, 2, 3]));
  writeFileSync(generated, Buffer.from([1, 2, 3]));
  assert.equal(filesHaveSameBytes(source, generated), true);
  writeFileSync(generated, Buffer.from([3, 2, 1]));
  assert.equal(filesHaveSameBytes(source, generated), false);
});
```

- [ ] **Step 2: Run the Node test and confirm RED**

Run: `node --test tools/customize_wechat_loading.test.mjs`

Expected: FAIL because `filesHaveSameBytes` is not exported.

- [ ] **Step 3: Implement logo identity verification**

Implement the helper with `readFileSync(left).equals(readFileSync(right))`. In `verify_wechat_build.mjs`, require both the generated `game/build/wechatgame/logo.png` and source `game/assets/resources/game/branding/logo.png`, then fail with `generated loading logo does not match branding/logo.png` when their bytes differ.

- [ ] **Step 4: Reapply customization and verify the focused tooling**

Run:

```powershell
Set-Location game
npm run customize:wechat-loading
Set-Location ..
node --test tools/customize_wechat_loading.test.mjs
```

Expected: the generated logo matches the source logo and all Node tests pass.

### Task 5: Complete Verification

**Files:**
- Verify: `game/assets/scripts/presentation/startupSequence.ts`
- Verify: `game/assets/scripts/presentation/ArtRepository.ts`
- Verify: `game/assets/scripts/presentation/LoadingView.ts`
- Verify: `game/assets/scripts/presentation/Cat2048Boot.ts`
- Verify: `tools/customize_wechat_loading.mjs`
- Verify: `tools/verify_wechat_build.mjs`

- [ ] **Step 1: Run project checks**

Run:

```powershell
Set-Location game
npm run typecheck:core
npm test
npm run verify:wechat-build
```

Expected: every command exits 0.

- [ ] **Step 2: Check intended diffs**

Run: `git diff --check` and review only the files listed by this plan.

Expected: no whitespace errors and no unrelated user changes included.

- [ ] **Step 3: Perform the device-level acceptance check**

Open the customized build in WeChat Developer Tools, launch from a cleared cache, and confirm the branding logo appears first, the loading treatment remains visible while `resources/game` loads, and the home screen appears once with every image present.
