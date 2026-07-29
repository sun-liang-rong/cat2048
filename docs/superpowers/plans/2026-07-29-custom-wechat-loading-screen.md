# Custom WeChat Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cocos Creator's generated WeChat first-screen branding with a Cat 2048 loading screen after every build.

**Architecture:** A Node CLI patches only the stable visual configuration anchors in the generated `first-screen.js`, copies the existing first-cat art as its logo, and invokes a tiny Pillow generator to create the Chinese title image from the repository font. Node's built-in test runner verifies the patcher using a temporary generated-build fixture; the existing WeChat verifier requires the patch marker.

**Tech Stack:** Node.js 20, node:test, Python 3 with Pillow, Cocos Creator 3.8.8, WeChat Mini Game build output

---

### Task 1: Define the patcher contract with a failing test

**Files:**
- Create: `tools/customize_wechat_loading.test.mjs`
- Create: `tools/customize_wechat_loading.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customizeFirstScreen } from './customize_wechat_loading.mjs';

test('customizeFirstScreen replaces Cocos loading colors and leaves an idempotent marker', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cat2048-loading-'));
  const firstScreen = join(directory, 'first-screen.js');
  writeFileSync(firstScreen, [
    'let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];',
    'let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];',
    'let bgColor = [0.01568627450980392,0.03529411764705882,0.0392156862745098,0.00392156862745098];',
  ].join('\n'));

  customizeFirstScreen(firstScreen);
  customizeFirstScreen(firstScreen);

  const output = readFileSync(firstScreen, 'utf8');
  assert.match(output, /CAT2048_CUSTOM_LOADING_SCREEN/);
  assert.match(output, /let progressBarColor = \[0\.92, 0\.31, 0\.23, 1\];/);
  assert.match(output, /let progressBackground = \[0\.16, 0\.13, 0\.11, 1\];/);
  assert.match(output, /let bgColor = \[1, 0\.94, 0\.83, 1\];/);
  assert.equal((output.match(/CAT2048_CUSTOM_LOADING_SCREEN/g) ?? []).length, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/customize_wechat_loading.test.mjs`

Expected: FAIL because `tools/customize_wechat_loading.mjs` does not exist.

- [ ] **Step 3: Implement the minimal exported patcher and CLI**

```js
export const customizeFirstScreen = (firstScreenPath) => {
  const source = readFileSync(firstScreenPath, 'utf8');
  if (source.includes('CAT2048_CUSTOM_LOADING_SCREEN')) return;
  const output = source
    .replace('let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];', 'let progressBarColor = [0.92, 0.31, 0.23, 1];')
    .replace('let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];', 'let progressBackground = [0.16, 0.13, 0.11, 1];')
    .replace('let bgColor = [0.01568627450980392,0.03529411764705882,0.0392156862745098,0.00392156862745098];', 'let bgColor = [1, 0.94, 0.83, 1]; // CAT2048_CUSTOM_LOADING_SCREEN');
  if (output === source) throw new Error('Unsupported Cocos first-screen template');
  writeFileSync(firstScreenPath, output);
};
```

The CLI resolves `game/build/wechatgame`, validates it contains `first-screen.js`, invokes the patcher, copies `game/assets/resources/game/cats/cat_01.png` to `logo.png`, and runs the title generator for `slogan.png`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/customize_wechat_loading.test.mjs`

Expected: PASS with one passing test.

### Task 2: Generate the title image and connect build commands

**Files:**
- Create: `tools/generate_wechat_loading_title.py`
- Modify: `game/package.json`

- [ ] **Step 1: Add the title generator**

Render transparent `slogan.png` using `game/assets/resources/game/fonts/display.ttf`, the exact text `猫咪 2048`, a dark warm fill, and a coral offset shadow. It accepts its output path as the first positional argument, creates its parent directory, and exits nonzero for missing font or failed writes.

- [ ] **Step 2: Expose the customization command**

Add this package script:

```json
"customize:wechat-loading": "node ../tools/customize_wechat_loading.mjs"
```

The command is intentionally separate from Cocos Build: it must run only after Creator produces `game/build/wechatgame`.

- [ ] **Step 3: Run the command against the existing build**

Run: `npm run customize:wechat-loading`

Expected: exit code 0, with `game/build/wechatgame/logo.png`, `slogan.png`, and `first-screen.js` updated.

### Task 3: Prevent uncustomized builds from passing verification

**Files:**
- Modify: `tools/verify_wechat_build.mjs`

- [ ] **Step 1: Add the loading-screen guard**

Read `game/build/wechatgame/first-screen.js`, then fail when either the file is absent or it does not include `CAT2048_CUSTOM_LOADING_SCREEN`:

```js
const firstScreenPath = join(buildRoot, 'first-screen.js');
if (!existsSync(firstScreenPath)) {
  fail('missing generated WeChat first-screen file');
}
if (!readFileSync(firstScreenPath, 'utf8').includes('CAT2048_CUSTOM_LOADING_SCREEN')) {
  fail('custom WeChat loading screen has not been applied');
}
```

- [ ] **Step 2: Run build verification**

Run: `npm run verify:wechat-build`

Expected: JSON output with package sizes and exit code 0.

### Task 4: Complete verification

**Files:**
- Verify: `tools/customize_wechat_loading.mjs`
- Verify: `tools/generate_wechat_loading_title.py`
- Verify: `tools/customize_wechat_loading.test.mjs`
- Verify: `game/package.json`
- Verify: `tools/verify_wechat_build.mjs`

- [ ] **Step 1: Run unit and project checks**

Run:

```powershell
node --test tools/customize_wechat_loading.test.mjs
Set-Location game
npm test
npm run typecheck:core
npm run verify:wechat-build
```

Expected: each command exits with code 0.

- [ ] **Step 2: Inspect the generated image dimensions and customization marker**

Run:

```powershell
Select-String -Path game/build/wechatgame/first-screen.js -Pattern CAT2048_CUSTOM_LOADING_SCREEN
```

Expected: exactly one marker line. Inspect `logo.png` and `slogan.png` in WeChat Developer Tools during a fresh launch; the Cocos logo must not appear.

- [ ] **Step 3: Review source changes**

Run: `git diff --check` and `git diff -- tools game/package.json`.

Expected: no whitespace errors; no edits to the user's existing gameplay changes.
