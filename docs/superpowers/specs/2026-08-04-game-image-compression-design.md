# Game Image Compression Design

**Date:** 2026-08-04

**Goal:** Add a repeatable root-level Python utility that reduces PNG resource size without changing the game's image format, dimensions, pixel values, or Cocos asset paths.

## Confirmed Approach

Use Pillow's lossless PNG encoder with `optimize=True` and `compress_level=9`. The utility scans `game/assets/resources/game/**/*.png` by default and keeps the existing PNG extension and adjacent `.meta` files unchanged. It never resizes, quantizes, converts to WebP/JPEG, or changes asset names.

The default mode is a dry run. It creates temporary same-directory candidates only to measure their size, reports per-file savings and totals, then removes the candidates. `--apply` enables replacement, and a candidate is installed only when it is strictly smaller than the original. Replacement uses a same-directory temporary file followed by `os.replace()` so an interrupted write cannot leave a partially written source asset.

## Interface

```text
python compress_game_images.py
python compress_game_images.py --apply
python compress_game_images.py --root path/to/png-root --apply
```

`--root` exists to make the utility reusable and testable; the production default is the game's runtime resource directory relative to the script location. A missing root or unavailable Pillow dependency exits with a clear error. Non-PNG files and `.meta` files are ignored.

## Preservation and Reporting

Each image is loaded and saved as PNG with the original mode and dimensions. The implementation preserves PNG transparency and common color/profile metadata when present. Tests compare decoded pixels, mode, size, and alpha behavior before and after compression. The summary reports scanned files, files with a smaller candidate, files actually replaced, original bytes, candidate bytes, and total savings.

## Verification

Python `unittest` tests use temporary directories and generated PNG fixtures to verify dry-run immutability, apply-only replacement, skipping non-smaller candidates, atomic replacement output, and preservation of RGBA pixels and dimensions. A repository dry run will then report the real resource count and estimated savings without changing the current resource tree.

No game runtime TypeScript, Cocos metadata, or resource paths need modification because the utility preserves names, formats, and locations.
