# Cat Skin Sprite Sheet Redesign

**Date:** 2026-08-04

**Goal:** Replace all three cat skin families with a coherent LV1-LV12 evolution line, authoring only three source sprite sheets and producing the 36 runtime PNGs through deterministic slicing.

## Scope

- Redesign the `classic`, `sunny`, and `aurora` skin families.
- Produce exactly one source sprite sheet per family: 4 columns x 3 rows, ordered left-to-right and top-to-bottom as LV1 through LV12.
- Slice each sheet into twelve 256x256 RGBA runtime images at `game/assets/resources/game/cats/<skin>/cat_<level>.png`.
- Update manifests, runtime asset preparation, catalog paths, and validation so all three families expose 12 levels.
- Preserve the existing cosmetic IDs and equipped-save format.

## Art Direction

All three families share a stable seated cat silhouette, frontal three-quarter camera, eye line, ear placement, tail direction, upper-left lighting, and transparent padding. The family identity comes from the palette and markings; progression comes from increasingly mature fur detail, a small number of readable accessories, and restrained energy effects at LV9-LV12.

- `classic`: warm orange-and-cream tabby, progressing from simple stripes to honey-gold collar, mantle, crown, and a compact solar emblem.
- `sunny`: cream-gold garden cat, progressing from soft leaf markings to peach blossom accents, a leaf mantle, flower crown, and a compact sun halo.
- `aurora`: midnight indigo cosmic cat, progressing from cyan star flecks to constellation markings, aurora tail ribbons, orbit rings, and a restrained star crown.

Each level must remain readable at approximately 80px. No text, labels, borders, ground plane, cast shadow, cropped anatomy, extra animals, or accessories that cover the mouth are allowed.

## Source Sheet Contract

Each source sheet is a 2048x2048 RGBA PNG with a 4x3 grid covering the full canvas. The logical cell boundaries are calculated from the full width and height using rounded fractional coordinates (four columns of 512px and three rows of approximately 683px). The runtime output is a 256x256 image created by alpha-trimming and high-quality downsampling after validation. The cell layout is:

```text
LV1  LV2  LV3  LV4
LV5  LV6  LV7  LV8
LV9  LV10 LV11 LV12
```

Every sprite must have at least 12% transparent padding on all four sides of its cell. Decorative aura pixels count as part of the sprite bounds and must remain inside that padding. The sheet must not include visible grid lines or a background color. Each trimmed sprite is then centered in a square canvas without stretching, so the different row heights never distort the cat.

## Slicing and Validation

The slicing tool will:

1. Open the source as RGBA and assert an exact 2048x2048 canvas.
2. Crop fixed, non-overlapping cells using integer coordinates derived from the 4x3 fractional grid.
3. Inspect alpha bounds for each crop. Fail if any non-transparent pixel is within 12% of a cell edge or if any cell is empty.
4. Alpha-trim each crop, center it in the smallest square with a fixed 6% transparent margin, and downsample to 256x256 with Lanczos resampling while preserving RGBA mode.
5. Re-check the downsampled alpha bounds and verify that no pixel crosses the output bounds.
6. Write `cat_01.png` through `cat_12.png` and a machine-readable slice report containing source dimensions, cell coordinates, alpha bounds, and output paths.

The command must fail before writing runtime files when any cell violates the contract. A visual contact sheet of the 36 outputs will be generated for manual review so edge artifacts, accidental transparency holes, and style drift can be caught before the assets are imported.

## Runtime and Catalog Changes

- `tools/prepare_runtime_assets.py` will slice all three 4x3 sheets and validate 12 outputs for every skin.
- `assets/cat2048/skins-v2/manifest.json` and `sprite-manifest.json` will describe the three 12-level sheets rather than individual level requests.
- `game/assets/scripts/economy/catalog.ts` will generate 12 `levelAssets` for `sunny` and `aurora` as it already does for `classic`.
- `game/assets/resources/game/asset-map.json` will contain `cat_skin_sunny_cat_01` through `_12` and `cat_skin_aurora_cat_01` through `_12`.
- Existing IDs, prices, and save-data compatibility remain unchanged.

## Verification

The implementation is complete only when:

- The asset preparation script produces 36 256x256 RGBA files and a slice report without warnings.
- Every output has matching `.png.meta` data after Cocos import.
- Runtime asset tests pass with 12 levels for all three themes.
- TypeScript tests and the full game test suite pass.
- A visual contact sheet shows consistent silhouette, clear LV1-LV12 progression, no clipped anatomy, and no cell bleed.
