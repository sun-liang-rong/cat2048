# Game Image Compression Design

**Date:** 2026-08-04

**Goal:** Add a repeatable root-level Python utility that reduces PNG resource size through controlled lossy color quantization without changing the game's image format, dimensions, or Cocos asset paths.

## Confirmed Approach

Use Pillow's PNG encoder with `optimize=True`, `compress_level=9`, and Fast Octree color quantization. The default quality is `70`, which retains about 179 palette colors per image; quality `100` is available as a lossless escape hatch. The utility keeps PNG format, image dimensions, asset names, and adjacent `.meta` files unchanged. It never converts to WebP/JPEG.

By default, only images larger than 50 KiB are eligible for compression. Images larger than 500 KiB are reported as large resources; images between those thresholds are reported as small resources. Both groups use the selected quality value.

The default mode is a dry run. It creates temporary same-directory candidates only to measure their size, reports per-file savings and totals, then removes the candidates. `--apply` enables replacement, and a candidate is installed only when it is strictly smaller than the original. Replacement uses a same-directory temporary file followed by `os.replace()` so an interrupted write cannot leave a partially written source asset.

## Interface

```text
python compress_game_images.py
python compress_game_images.py --apply
python compress_game_images.py --root path/to/png-root --apply
```

`--root` exists to make the utility reusable and testable; the production default is the game's runtime resource directory relative to the script location. `--quality` defaults to `70`, `--min-size-kb` defaults to `50`, and `--large-size-kb` defaults to `500`. A missing root or unavailable Pillow dependency exits with a clear error. Non-PNG files and `.meta` files are ignored.

## Preservation and Reporting

Each image is loaded and saved as PNG with the original dimensions. Quality below `100` intentionally changes color pixels through palette quantization, while preserving transparency edges and common color/profile metadata when present. Tests compare dimensions and alpha behavior after quality 70 compression, and compare pixels in the quality 100 mode. The summary reports scanned files, selected threshold groups, files with a smaller candidate, files actually replaced, original bytes, candidate bytes, and total savings.

## Verification

Python `unittest` tests use temporary directories and generated PNG fixtures to verify dry-run immutability, quality 70 quantization, threshold selection, apply-only replacement, permission fallback, and preservation of PNG dimensions and alpha behavior. A repository dry run reports the real resource count and estimated savings without changing the resource tree.

No game runtime TypeScript, Cocos metadata, or resource paths need modification because the utility preserves names, formats, and locations.
