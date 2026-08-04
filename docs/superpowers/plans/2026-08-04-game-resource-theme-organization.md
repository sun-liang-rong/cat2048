# Themed Game Resource Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize all committed Cocos game resources by type and theme, then update runtime paths, asset generation mappings, documentation, and tests without changing asset bytes or gameplay behavior.

**Architecture:** Keep game/assets/resources/game/ as the single Cocos resources bundle. Use resource type as the first directory level and theme or usage as the second level: cats/{classic,sunny,aurora}, backgrounds/{common,board/{wood,pink,star}}, ui/{common,button-themes/{berry,aurora}}, effects/{classic,aurora,stars}}, plus unchanged fonts and audio. Preserve each PNG and its .meta file together, and keep logical asset keys stable while changing only their paths.

**Tech Stack:** Cocos Creator 3.8.8 resource paths, TypeScript, Vitest, Python/Pillow asset preparation script, Node.js build customization script.

---

## Implementation Notes

The repository's source art directory assets/ was intentionally deleted before this task. The committed runtime resources remain available, but npm run prepare:assets cannot regenerate them in the current worktree. Update tools/prepare_runtime_assets.py so a future restored source directory emits the new layout, but verify this change with the committed runtime resources, TypeScript checks, and Vitest. Change game/package.json so normal verification no longer invokes the unavailable source-art generator.

## Task 1: Add Failing Layout and Path Tests

**Files:**
- Modify: game/tests/runtime-assets.test.ts
- Modify: game/tests/catalog.test.ts

- [ ] **Step 1: Add the expected new image layout before changing production paths.**

Add this constant after filesBelow:

~~~ts
const expectedImagePaths = [
  ...['bg_home.png', 'bg_page.png', 'share_score_bg.png'].map((name) => `backgrounds/common/${name}`),
  ...['wood', 'pink', 'star'].map((theme) => `backgrounds/board/${theme}/bg_board_${theme}.png`),
  ...['classic', 'sunny', 'aurora'].flatMap((theme) =>
    Array.from({ length: theme === 'classic' ? 12 : 9 }, (_, index) =>
      `cats/${theme}/cat_${String(index + 1).padStart(2, '0')}.png`)),
  'ui/common/logo.png',
  'ui/common/tile_empty.png',
  'ui/common/tile_selected.png',
  ...[
    'back', 'check', 'classic_mode', 'close', 'coin', 'collection', 'daily', 'home', 'info',
    'level_complete', 'level_current', 'level_locked', 'locked', 'remove_lowest',
    'reward_video', 'settings', 'share', 'sound_off', 'sound_on', 'undo', 'weekly',
  ].map((name) => `ui/common/${name}.png`),
  ...['berry', 'aurora'].flatMap((theme) =>
    ['primary', 'secondary', 'reward', 'cream'].map((state) =>
      `ui/button-themes/${theme}/${state}.png`)),
  ...['sparkle_small', 'merge_sparkle', 'merge_burst', 'max_halo']
    .map((name) => `effects/classic/${name}.png`),
  ...['aurora_sparkle', 'aurora_burst', 'aurora_paw_sparkle', 'aurora_paw_burst']
    .map((name) => `effects/aurora/${name}.png`),
  ...['stars_sparkle', 'stars_burst', 'stars_fish_sparkle', 'stars_confetti_burst']
    .map((name) => `effects/stars/${name}.png`),
  'fonts/score.png',
].sort();
~~~

Add this test:

~~~ts
it('keeps every runtime image in its type and theme directory', () => {
  const actual = filesBelow(assetRoot)
    .filter((path) => extname(path) === '.png')
    .map((path) => relative(assetRoot, path).replaceAll('\\\\', '/'))
    .sort();

  expect(actual).toEqual(expectedImagePaths);
  expect(actual.some((path) => /^(branding|cosmetics|gameplay)\\//.test(path))).toBe(false);
});
~~~

Update the two existing literal PNG count assertions to expect expectedImagePaths.length. This keeps the current total of 81 images while enforcing the new tree.

- [ ] **Step 2: Change catalog expectations to the desired logical paths.**

In game/tests/catalog.test.ts, expect these default preview paths:

~~~ts
expect(defaults.map((item) => item.previewAsset)).toEqual([
  'game/cats/classic/cat_01/texture',
  'game/backgrounds/board/wood/bg_board_wood/texture',
  'game/effects/classic/merge_burst/texture',
  undefined,
]);
~~~

- [ ] **Step 3: Run the focused tests and confirm the new contract fails against the old tree.**

Run from game/:

~~~powershell
npm test -- runtime-assets.test.ts catalog.test.ts
~~~

Expected: the new layout test and catalog path assertion fail because the current files and code still use the old categories. Do not proceed if these tests pass before the move.

## Task 2: Update the Runtime Asset Preparation Layout

**Files:**
- Modify: tools/prepare_runtime_assets.py

- [ ] **Step 1: Change generated output targets without changing image slicing.**

Use these targets in main():

~~~python
slice_grid("sheet_cats.png", 3, 3,
           [f"cat_{i:02}" for i in range(1, 10)], "cats/classic", 256)
slice_grid_cells("sheet_gameplay.png", 3, 2,
                 {0: "tile_empty", 1: "tile_selected"}, "ui/common", 256)
slice_grid_cells("sheet_gameplay.png", 3, 2,
                 {2: "sparkle_small", 3: "merge_sparkle", 4: "merge_burst", 5: "max_halo"},
                 "effects/classic", 256)
slice_grid("sheet_utility.png", 4, 4,
           ["close", "back", "home", "locked", "check", "share", "reward_video", "sound_on",
            "sound_off", "settings", "info", "level_locked", "level_current", "level_complete",
            "daily", "weekly"], "ui/common", 160)
slice_grid_cells("sheet_navigation.png", 3, 2,
                 {0: "classic_mode", 2: "collection"}, "ui/common", 160)
slice_grid_cells("sheet_economy.png", 4, 2,
                 {0: "undo", 3: "remove_lowest", 4: "coin"}, "ui/common", 160)
slice_grid("cat_skin_sunny.png", 3, 3,
           [f"cat_{level:02}" for level in range(1, 10)], "cats/sunny", 256)
slice_grid("cat_skin_aurora.png", 3, 3,
           [f"cat_{level:02}" for level in range(1, 10)], "cats/aurora", 256)
slice_grid("effect_aurora.png", 2, 2,
           ["aurora_sparkle", "aurora_burst", "aurora_paw_sparkle", "aurora_paw_burst"],
           "effects/aurora", 256)
slice_grid("effect_stars.png", 2, 2,
           ["stars_sparkle", "stars_burst", "stars_fish_sparkle", "stars_confetti_burst"],
           "effects/stars", 256)
~~~

Set copy_generated_cats() output to OUTPUT / "cats" / "classic". Keep the existing 16 utility names unchanged: close, back, home, locked, check, share, reward_video, sound_on, sound_off, settings, info, level_locked, level_current, level_complete, daily, weekly.

- [ ] **Step 2: Put backgrounds into common or board theme directories.**

Add:

~~~python
BACKGROUND_TARGETS = {
    "bg_home": "backgrounds/common",
    "bg_page": "backgrounds/common",
    "share_score_bg": "backgrounds/common",
    "bg_board_wood": "backgrounds/board/wood",
    "bg_board_pink": "backgrounds/board/pink",
    "bg_board_star": "backgrounds/board/star",
}
~~~

Change prepare_background(name, size) to prepare_background(name, size, target), and write to OUTPUT / target / f"{name}.png". Call it as prepare_background(background, size, BACKGROUND_TARGETS[background]).

- [ ] **Step 3: Update validate() to enumerate the new paths and preserve map keys.**

Required path families must include:

~~~python
OUTPUT / "cats" / "classic" / f"cat_{level:02}.png"
OUTPUT / "cats" / skin / f"cat_{level:02}.png"  # skin in ["sunny", "aurora"], levels 1..9
OUTPUT / "backgrounds" / "common" / name  # bg_home.png, bg_page.png, share_score_bg.png
OUTPUT / "backgrounds" / "board" / theme / f"bg_board_{theme}.png"
OUTPUT / "ui" / "common" / name  # tile images and all generated shared UI icons
OUTPUT / "effects" / "classic" / name  # four classic effect images
OUTPUT / "effects" / "aurora" / name  # four aurora effect images
OUTPUT / "effects" / "stars" / name  # four stars effect images
OUTPUT / "ui" / "button-themes" / theme / f"{state}.png"
~~~

Keep logical = path.stem and the button-theme key branch. Change the cat-skin key branch to identify paths under cats/sunny and cats/aurora, so keys remain cat_skin_sunny_cat_01 and cat_skin_aurora_cat_01. Update any transparent-sprite directory checks for classic, sunny, aurora, common, effects, and button themes. Keep logo.png as a committed runtime-only asset; it is not generated by the deleted source-art pipeline and is not added to the generator required-output list.

- [ ] **Step 4: Compile the generator without invoking missing source inputs.**

Run from the repository root:

~~~powershell
python -m py_compile tools/prepare_runtime_assets.py
~~~

Expected: exit code 0. Do not run the generator itself because assets/art-generation/ was intentionally removed.

## Task 3: Move Runtime Files and Metadata Together

**Files:**
- Move: all PNG/WAV/FNT/TTF files and adjacent .meta files under game/assets/resources/game/
- Remove: obsolete branding, cosmetics, and gameplay directory metadata after their contents move

- [ ] **Step 1: Create exact destination directories.**

Create:

~~~text
backgrounds/common
backgrounds/board/wood
backgrounds/board/pink
backgrounds/board/star
cats/classic
cats/sunny
cats/aurora
ui/common
effects/classic
effects/aurora
effects/stars
~~~

- [ ] **Step 2: Move each asset and its metadata pair with git mv.**

Use these mappings and preserve basenames:

~~~text
cats/cat_*.png and .meta                         -> cats/classic/
cosmetics/cat-skins/sunny/*                      -> cats/sunny/
cosmetics/cat-skins/aurora/*                     -> cats/aurora/
backgrounds/bg_home.png and .meta               -> backgrounds/common/
backgrounds/bg_page.png and .meta                -> backgrounds/common/
backgrounds/share_score_bg.png and .meta         -> backgrounds/common/
backgrounds/bg_board_wood.png and .meta          -> backgrounds/board/wood/
backgrounds/bg_board_pink.png and .meta          -> backgrounds/board/pink/
backgrounds/bg_board_star.png and .meta          -> backgrounds/board/star/
branding/logo.png and .meta                      -> ui/common/
gameplay/tile_empty.png and .meta                -> ui/common/
gameplay/tile_selected.png and .meta             -> ui/common/
gameplay/sparkle_small.png and .meta             -> effects/classic/
gameplay/merge_sparkle.png and .meta              -> effects/classic/
gameplay/merge_burst.png and .meta                -> effects/classic/
gameplay/max_halo.png and .meta                   -> effects/classic/
gameplay/effects/aurora_*.png and .meta          -> effects/aurora/
gameplay/effects/stars_*.png and .meta            -> effects/stars/
ui/*.png and .meta                                -> ui/common/
~~~

Do not move fonts, audio, or ui/button-themes. Move directory metadata when it belongs to a moved directory; allow Cocos to create metadata for new category folders. Remove only stale .DS_Store files and directory metadata left by branding, cosmetics, and gameplay after their contents are verified.

- [ ] **Step 3: Verify the move before changing references.**

Run:

~~~powershell
$root = (Resolve-Path 'game/assets/resources/game').Path
$images = Get-ChildItem -LiteralPath $root -File -Recurse -Filter *.png
$images.Count
$images | ForEach-Object { $_.FullName.Substring($root.Length + 1) }
~~~

Expected: 81 PNG files, all under backgrounds, cats, ui, effects, or fonts/score.png; no PNG starts with branding/, cosmetics/, or gameplay/. Every PNG has a same-path .meta file.

## Task 4: Update Runtime and Build References

**Files:**
- Modify: game/assets/scripts/infrastructure/gameConfig.ts
- Modify: game/assets/scripts/economy/catalog.ts
- Modify: game/assets/resources/game/asset-map.json
- Modify: tools/customize_wechat_loading.mjs
- Modify: game/package.json
- Modify: game/README.md

- [ ] **Step 1: Update GAME_CONFIG paths.**

Use these logical paths:

~~~ts
const classicCatPath = (level: number) =>
  `game/cats/classic/cat_${String(level).padStart(2, '0')}/texture`;

// Define this helper immediately before GAME_CONFIG; each GAME_CONFIG.cats asset uses classicCatPath(level).
logo: 'game/ui/common/logo/texture',
homeBackground: 'game/backgrounds/common/bg_home/texture',
pageBackground: 'game/backgrounds/common/bg_page/texture',
boardBackground: 'game/backgrounds/board/wood/bg_board_wood/texture',
shareScoreBackground: 'game/backgrounds/common/share_score_bg/texture',
tileBase: 'game/ui/common/tile_empty/texture',
tileSelected: 'game/ui/common/tile_selected/texture',
sparkleSmall: 'game/effects/classic/sparkle_small/texture',
mergeSparkle: 'game/effects/classic/merge_sparkle/texture',
mergeBurst: 'game/effects/classic/merge_burst/texture',
maxHalo: 'game/effects/classic/max_halo/texture',
// Remaining icon values use game/ui/common/<basename>/texture.
~~~

Keep public property names and cat level data unchanged.

- [ ] **Step 2: Update catalog path builders and themed item paths.**

Use:

~~~ts
const defaultCatAssets: readonly string[] = Array.from({ length: 12 }, (_, index) =>
  `game/cats/classic/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);

const skinAssets = (skin: string): readonly string[] = Array.from({ length: 9 }, (_, index) =>
  `game/cats/${skin}/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);
~~~

Use these prefixes for shop assets:

~~~text
board.*        -> game/backgrounds/board/<theme>/bg_board_<theme>/texture
effect.classic  -> game/effects/classic/<asset>/texture
effect.aurora   -> game/effects/aurora/<asset>/texture
effect.stars    -> game/effects/stars/<asset>/texture
button-theme.*  -> unchanged under game/ui/button-themes/<theme>/...
~~~

- [ ] **Step 3: Update asset-map.json and the loading logo source.**

Keep every existing key but update values. These entries must become:

~~~json
{
  "cat_01": "game/cats/classic/cat_01/texture",
  "bg_home": "game/backgrounds/common/bg_home/texture",
  "bg_board_wood": "game/backgrounds/board/wood/bg_board_wood/texture",
  "tile_empty": "game/ui/common/tile_empty/texture",
  "merge_burst": "game/effects/classic/merge_burst/texture",
  "cat_skin_sunny_cat_01": "game/cats/sunny/cat_01/texture",
  "aurora_burst": "game/effects/aurora/aurora_burst/texture"
}
~~~

In tools/customize_wechat_loading.mjs set:

~~~js
const logoSource = join(root, 'game', 'assets', 'resources', 'game', 'ui', 'common', 'logo.png');
~~~

- [ ] **Step 4: Make normal verification independent of deleted source art.**

Change game/package.json:

~~~json
"verify": "npm run typecheck:core && npm test"
~~~

Keep prepare:assets as a separate optional command for a checkout that has assets/art-generation/. Update game/README.md command examples and preparation text to describe committed runtime assets and remove the claim that deleted source-art files are available.

## Task 5: Run Focused, Full, and Static Verification

**Files:**
- Verify: game/tests/runtime-assets.test.ts
- Verify: game/tests/catalog.test.ts
- Verify: game/assets/scripts/infrastructure/gameConfig.ts
- Verify: game/assets/scripts/economy/catalog.ts
- Verify: tools/prepare_runtime_assets.py
- Verify: tools/customize_wechat_loading.mjs

- [ ] **Step 1: Run focused tests.**

From game/:

~~~powershell
npm test -- runtime-assets.test.ts catalog.test.ts
~~~

Expected: focused tests pass, including 81 PNG files, matching metadata, all three cat themes, and new catalog preview paths.

- [ ] **Step 2: Run typecheck and the full Vitest suite.**

From game/:

~~~powershell
npm run typecheck:core
npm test
~~~

Expected: both commands exit 0 with no failed tests.

- [ ] **Step 3: Run the project verifier.**

From game/:

~~~powershell
npm run verify
~~~

Expected: typecheck and the full test suite pass. Do not invoke npm run prepare:assets unless assets/art-generation/ has been restored separately.

- [ ] **Step 4: Search for stale runtime paths and verify metadata pairs.**

From the repository root:

~~~powershell
rg -n --hidden -g '!node_modules' -g '!docs/superpowers/**' -e 'game/(branding|cosmetics|gameplay)' -e 'game/cats/cat_' -e 'game/backgrounds/bg_' -e 'game/ui/(close|back|home|check|share|sound_on|sound_off|settings|info|locked|classic_mode|collection|undo|remove_lowest|coin|daily|weekly|level_locked|level_current|level_complete|reward_video|tile_empty|tile_selected)/' game tools
~~~

Expected: no output for runtime, tooling, or test files. Historical design documents are excluded.

Run:

~~~powershell
$root = (Resolve-Path 'game/assets/resources/game').Path
$missing = Get-ChildItem -LiteralPath $root -File -Recurse -Filter *.png |
  Where-Object { -not (Test-Path -LiteralPath ($_.FullName + '.meta')) }
if ($missing) { $missing | Select-Object -ExpandProperty FullName; exit 1 }
Write-Output 'All PNG assets have matching metadata.'
~~~

Expected: All PNG assets have matching metadata.

- [ ] **Step 5: Review the final diff and preserve unrelated deletions.**

Run:

~~~powershell
git diff --check
git status --short
git diff --stat -- game tools
~~~

Expected: only approved resource organization, path updates, tests, tooling, and README changes are in the task diff. Previously requested root assets/ and .playwright-cli/ deletions remain untouched and are not reverted.
