#!/usr/bin/env python3
"""Slice a generated button sprite sheet into individual transparent PNGs.

Buttons are located by projecting the alpha channel onto each axis and
splitting on fully transparent gutters, so the sheet does not need to be
aligned to an exact grid. Each cell is alpha-trimmed, padded to a square,
and resized to the requested output size.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow is required: install the 'Pillow' package in the active Python runtime.") from exc

ALPHA_THRESHOLD = 8
MIN_GAP = 16


def content_runs(flags: list[bool]) -> list[tuple[int, int]]:
    """Runs of True indexes, merging runs separated by gaps smaller than MIN_GAP."""
    runs: list[tuple[int, int]] = []
    start = None
    for index, has_content in enumerate(flags):
        if has_content and start is None:
            start = index
        elif not has_content and start is not None:
            runs.append((start, index))
            start = None
    if start is not None:
        runs.append((start, len(flags)))
    merged: list[tuple[int, int]] = []
    for run in runs:
        if merged and run[0] - merged[-1][1] < MIN_GAP:
            merged[-1] = (merged[-1][0], run[1])
        else:
            merged.append(run)
    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--names", required=True,
                        help="Comma-separated output names in row-major order, without extension")
    parser.add_argument("--size", type=int, default=256, help="Square output size in px")
    parser.add_argument("--margin", type=float, default=0.06,
                        help="Transparent margin around the trimmed button, as a fraction")
    args = parser.parse_args()

    names = [name.strip() for name in args.names.split(",") if name.strip()]
    image = Image.open(args.source).convert("RGBA")
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = image.size

    column_has = [any(pixels[x, y] > ALPHA_THRESHOLD for y in range(height)) for x in range(width)]
    row_has = [any(pixels[x, y] > ALPHA_THRESHOLD for x in range(width)) for y in range(height)]
    columns = content_runs(column_has)
    rows = content_runs(row_has)

    cells = [(top, bottom, left, right) for top, bottom in rows for left, right in columns]
    if len(cells) != len(names):
        print(f"Expected {len(names)} buttons but found {len(rows)} rows x {len(columns)} columns "
              f"= {len(cells)} cells. Adjust the sheet or MIN_GAP.", file=sys.stderr)
        return 1

    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name, (top, bottom, left, right) in zip(names, cells):
        cell = image.crop((left, top, right, bottom))
        bbox = cell.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()
        if bbox:
            cell = cell.crop(bbox)
        side = round(max(cell.width, cell.height) * (1 + args.margin * 2))
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.alpha_composite(cell, ((side - cell.width) // 2, (side - cell.height) // 2))
        canvas = canvas.resize((args.size, args.size), Image.Resampling.LANCZOS)
        output = args.out_dir / f"{name}.png"
        canvas.save(output, format="PNG", optimize=True)
        print(f"OK {output} (cell {right - left}x{bottom - top})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
