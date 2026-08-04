# Cat Skin Sprite Sheet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate three coherent 4x3 cat skin sprite sheets, validate and slice them into 36 clean 256x256 runtime sprites, and expose LV1-LV12 for all skin families.

**Architecture:** The project art generator writes one source PNG per skin under `assets/cat2048/skins-v2/sprite-sheets`. A dedicated slicer partitions each 2048x2048 sheet into rounded fractional 4x3 cells, rejects empty or edge-touching alpha, trims and centers each sprite, then writes runtime PNGs and a JSON report. Runtime catalog and tests consume the existing `game/cats/<skin>/cat_##/texture` contract.

**Tech Stack:** Python 3, Pillow, project OpenAI-compatible image generation script, Cocos Creator resource paths, TypeScript/Vitest.

---

### Task 1: Lock the generation manifest

**Files:**
- Modify: `assets/cat2048/skins-v2/sprite-manifest.json`
- Modify: `assets/cat2048/skins-v2/manifest.json`

- [ ] Replace all prompts with the approved clean Q版手游萌系 direction: 12 independently designed recognizable cats per sheet, a shared seated icon composition, no text, no background, no grid, no duplicate cats, no detached particles, no human-like body, no mask face, no heavy watercolor noise, and at least 12% transparent gutter inside every cell.
- [ ] Spell out the exact LV1-LV12 breed, coat, and fantasy progression inside each of the three sheet prompts; do not leave any level to an unbounded model improvisation.
- [ ] Keep exactly three assets (`cat_classic_sheet`, `cat_sunny_sheet`, `cat_aurora_sheet`) at `2048x2048`, with stable filenames and `transparent: true`.
- [ ] Run `python skills/generate-kitchen-game-art/scripts/generate_assets.py --manifest assets/cat2048/skins-v2/sprite-manifest.json --output-dir assets/cat2048/skins-v2/sprite-sheets --check-manifest` and confirm it reports three valid assets.

### Task 2: Build the strict sprite-sheet slicer

**Files:**
- Create: `tools/slice_cat_sprite_sheets.py`
- Create: `tools/test_slice_cat_sprite_sheets.py`

- [ ] Write tests for exact 4x3 row-major naming, rounded fractional cell boundaries, empty-cell rejection, alpha-edge rejection, square output dimensions, RGBA preservation, and JSON report fields.
- [ ] Implement `slice_sheet(source, output_dir, skin, size=256)` using Pillow. Require RGBA input with `(2048, 2048)` dimensions; derive `left/top/right/bottom` from `round(index * dimension / divisions)`.
- [ ] Threshold alpha at 8, compute bounds per cell, reject empty cells, and reject any bound within 12% of a cell edge. Alpha-trim valid cells, place them in a square canvas with 6% margin, resize with Lanczos, and save `cat_##.png` with `optimize=True`.
- [ ] Write `<skin>-slice-report.json` with source size, cell coordinates, alpha bounds, output size, and SHA-256 for every output. Never write partial outputs when validation fails.
- [ ] Run `python -m unittest tools/test_slice_cat_sprite_sheets.py -v` and expect all tests to pass.

### Task 3: Generate and inspect the three source sheets

**Files:**
- Replace: `assets/cat2048/skins-v2/sprite-sheets/cat_classic_sheet.png`
- Replace: `assets/cat2048/skins-v2/sprite-sheets/cat_sunny_sheet.png`
- Replace: `assets/cat2048/skins-v2/sprite-sheets/cat_aurora_sheet.png`

- [ ] Run the project generator with `--only cat_classic_sheet --force` and inspect the full sheet and 80px contact preview; regenerate the same ID if it contains duplicated cells, cropped anatomy, detached speckles, or style drift.
- [ ] Generate `cat_sunny_sheet` and `cat_aurora_sheet` with `--force`, inspect each full sheet and reject any malformed sheet before slicing.
- [ ] Keep raw responses only under the skill-managed `responses/` directory; never expose or commit credentials or signed URLs.

### Task 4: Slice runtime sprites and build a contact sheet

**Files:**
- Modify: `tools/prepare_runtime_assets.py`
- Create: `tools/build_cat_contact_sheet.py`
- Create: `assets/cat2048/skins-v2/sprite-sheets/slice-report.json`

- [ ] Call the strict slicer for all three sheets before the existing runtime asset validation. Remove the old 3x3 sunny/aurora slicing and individually generated classic LV10-LV12 copy path.
- [ ] Update validation to require 12 outputs for `classic`, `sunny`, and `aurora`, all 256x256 RGBA.
- [ ] Build a 12-column contact sheet with labels outside the runtime sprites for human review only; verify there is no cross-cell bleed and that each family reads as one cat evolving through three stages.
- [ ] Run `python tools/prepare_runtime_assets.py` and confirm all 36 cat outputs plus existing assets validate.

### Task 5: Update catalog and tests

**Files:**
- Modify: `game/assets/scripts/economy/catalog.ts`
- Modify: `game/tests/runtime-assets.test.ts`
- Modify: `game/tests/catalog.test.ts` if level-count assertions require it

- [ ] Change `skinAssets` to generate 12 paths for both shop skins while preserving cosmetic IDs, prices, and save compatibility.
- [ ] Update runtime asset expectations to include 12 sunny and 12 aurora files and 36 cat PNGs total.
- [ ] Run `npm run typecheck:core` and `npm test` from `game/`; expect both to pass.

### Task 6: Final visual and package verification

- [ ] Inspect all three source sheets, the contact sheet, and representative LV1/LV6/LV9/LV12 outputs with alpha shown against both light and dark checkerboards.
- [ ] Run `node tools/verify_wechat_build.mjs` from `game/` and confirm every asset-map entry resolves to an existing runtime texture.
- [ ] Run `git diff --check` and record the exact generated asset paths and test commands in the handoff.
