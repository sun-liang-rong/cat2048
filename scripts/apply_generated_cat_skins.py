#!/usr/bin/env python3
"""Slice the generated 4x3 cat sheets and write runtime 256x256 sprites.

The source sheets in ``cat/`` are 1536x1024 RGBA illustrations. Cats are
extracted by connected components (not a rigid grid crop) so overlapping
auras and tall hats do not clip neighbouring sprites.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "cat"
RUNTIME_CATS = ROOT / "packages" / "game" / "assets" / "resources" / "game" / "cats"
RESOURCE_IMAGES = ROOT / "resources" / "shop-cat-skins" / "images"

GRID_COLUMNS = 4
GRID_ROWS = 3
OUTPUT_SIZE = 256
ALPHA_THRESHOLD = 32
MIN_COMPONENT_PIXELS = 8000
SPAN_RATIO = 0.12
DILATE_RADIUS = 2
TRIM_MARGIN_RATIO = 0.07

SKIN_SOURCES = (
    {
        "skin": "classic",
        "source": SOURCE_DIR / "cat1.png",
        "resource_name": "cat_classic_sheet.png",
    },
    {
        "skin": "sunny",
        "source": SOURCE_DIR / "cat2.png",
        "resource_name": "cat_sunny_sheet.png",
    },
)


class SliceError(ValueError):
    """Raised when a generated sheet cannot be split into 12 cats."""


def connected_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    height, width = mask.shape
    parent = np.arange(height * width, dtype=np.int32)

    def find(index: int) -> int:
        root = index
        while parent[root] != root:
            root = parent[root]
        while parent[index] != index:
            nxt = parent[index]
            parent[index] = root
            index = nxt
        return root

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for y in range(height):
        row = y * width
        for x in range(width):
            if not mask[y, x]:
                continue
            index = row + x
            if x and mask[y, x - 1]:
                union(index, index - 1)
            if y and mask[y - 1, x]:
                union(index, index - width)

    labels = np.zeros(height * width, dtype=np.int32)
    mapping: dict[int, int] = {}
    next_id = 1
    for index in np.flatnonzero(mask.ravel()):
        root = find(int(index))
        if root not in mapping:
            mapping[root] = next_id
            next_id += 1
        labels[index] = mapping[root]
    return labels.reshape(height, width), next_id - 1


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask
    height, width = mask.shape
    out = mask.copy()
    ys, xs = np.where(mask)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx == 0 and dy == 0:
                continue
            ny = ys + dy
            nx = xs + dx
            valid = (ny >= 0) & (ny < height) & (nx >= 0) & (nx < width)
            out[ny[valid], nx[valid]] = True
    return out


def largest_component(mask: np.ndarray) -> np.ndarray:
    labels, count = connected_components(mask)
    if count == 0:
        return mask
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    keep = int(sizes.argmax())
    return labels == keep


def projection_valley(mask: np.ndarray, axis: int, lo: int, hi: int) -> int:
    projection = mask.sum(axis=1 if axis == 0 else 0)
    lo = max(0, min(lo, len(projection) - 2))
    hi = max(lo + 1, min(hi, len(projection) - 1))
    window = projection[lo:hi]
    return lo + int(np.argmin(window))


def cell_index(x: np.ndarray, y: np.ndarray, width: int, height: int) -> np.ndarray:
    columns = np.clip((x * GRID_COLUMNS / width).astype(int), 0, GRID_COLUMNS - 1)
    rows = np.clip((y * GRID_ROWS / height).astype(int), 0, GRID_ROWS - 1)
    return rows * GRID_COLUMNS + columns


def mean_color(rgba: np.ndarray, mask: np.ndarray) -> np.ndarray:
    pixels = rgba[:, :, :3][mask]
    if pixels.size == 0:
        return np.zeros(3, dtype=np.float64)
    return pixels.astype(np.float64).mean(axis=0)


def refine_split_by_color(
    rgba: np.ndarray,
    first: np.ndarray,
    second: np.ndarray,
    axis: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Reassign junction pixels to the piece whose average color they match."""
    first_mean = mean_color(rgba, first)
    second_mean = mean_color(rgba, second)
    colors = rgba[:, :, :3].astype(np.float64)
    dist_first = ((colors - first_mean) ** 2).sum(axis=2)
    dist_second = ((colors - second_mean) ** 2).sum(axis=2)

    first_coords = np.where(first)
    second_coords = np.where(second)
    if first_coords[0].size == 0 or second_coords[0].size == 0:
        return first, second

    axis_first = first_coords[axis]
    axis_second = second_coords[axis]
    band_lo = int(min(axis_first.max(), axis_second.min()) - 28)
    band_hi = int(max(axis_first.max(), axis_second.min()) + 28)
    band = np.zeros(first.shape, dtype=bool)
    if axis == 0:
        band[max(0, band_lo):band_hi, :] = True
    else:
        band[:, max(0, band_lo):band_hi] = True

    junction = (first | second) & band
    closer_second = junction & (dist_second + 80 < dist_first)
    closer_first = junction & (dist_first + 80 < dist_second)
    first = first.copy()
    second = second.copy()
    first[closer_second] = False
    second[closer_second] = True
    second[closer_first] = False
    first[closer_first] = True
    return largest_component(first), largest_component(second)


def split_spanning_mask(
    rgba: np.ndarray,
    mask: np.ndarray,
    keys: list[int],
    width: int,
    height: int,
) -> dict[int, np.ndarray]:
    """Split a mask that covers multiple grid cells along the sparsest gap."""
    ys, xs = np.where(mask)
    rows = sorted({key // GRID_COLUMNS for key in keys})
    cols = sorted({key % GRID_COLUMNS for key in keys})
    pieces: dict[int, np.ndarray] = {}

    if len(rows) > 1 and len(cols) == 1:
        lo = int(ys.min() + (ys.max() - ys.min()) * 0.25)
        hi = int(ys.min() + (ys.max() - ys.min()) * 0.75)
        cut = projection_valley(mask, 0, lo, hi)
        ordered = sorted(keys, key=lambda key: key // GRID_COLUMNS)
        first = mask.copy()
        first[cut:, :] = False
        second = mask.copy()
        second[:cut, :] = False
        first, second = refine_split_by_color(
            rgba, largest_component(first), largest_component(second), 0,
        )
        pieces[ordered[0]] = first
        pieces[ordered[1]] = second
        return pieces

    if len(cols) > 1 and len(rows) == 1:
        lo = int(xs.min() + (xs.max() - xs.min()) * 0.25)
        hi = int(xs.min() + (xs.max() - xs.min()) * 0.75)
        cut = projection_valley(mask, 1, lo, hi)
        ordered = sorted(keys, key=lambda key: key % GRID_COLUMNS)
        first = mask.copy()
        first[:, cut:] = False
        second = mask.copy()
        second[:, :cut] = False
        first, second = refine_split_by_color(
            rgba, largest_component(first), largest_component(second), 1,
        )
        pieces[ordered[0]] = first
        pieces[ordered[1]] = second
        return pieces

    cell_w = width / GRID_COLUMNS
    cell_h = height / GRID_ROWS
    for key in keys:
        row, column = divmod(key, GRID_COLUMNS)
        piece = np.zeros_like(mask)
        left, top = round(column * cell_w), round(row * cell_h)
        right, bottom = round((column + 1) * cell_w), round((row + 1) * cell_h)
        piece[top:bottom, left:right] = mask[top:bottom, left:right]
        pieces[key] = largest_component(piece)
    return pieces


def extract_cell_masks(rgba: np.ndarray) -> list[np.ndarray]:
    height, width = rgba.shape[:2]
    labels, count = connected_components(rgba[:, :, 3] > ALPHA_THRESHOLD)
    sizes = np.bincount(labels.ravel())
    if sizes.size:
        sizes[0] = 0

    cell_masks: list[np.ndarray | None] = [None] * (GRID_COLUMNS * GRID_ROWS)
    cell_areas = [0] * (GRID_COLUMNS * GRID_ROWS)

    for label in range(1, count + 1):
        if sizes[label] < MIN_COMPONENT_PIXELS:
            continue
        mask = labels == label
        ys, xs = np.where(mask)
        keys, counts = np.unique(cell_index(xs, ys, width, height), return_counts=True)
        overlap = {int(key): int(area) for key, area in zip(keys, counts)}
        significant = [
            key for key, area in overlap.items()
            if area >= max(MIN_COMPONENT_PIXELS, sizes[label] * SPAN_RATIO)
        ]
        if not significant:
            significant = [max(overlap, key=overlap.get)]

        if len(significant) == 1:
            pieces = {significant[0]: mask}
        else:
            pieces = split_spanning_mask(rgba, mask, significant, width, height)

        for key, piece in pieces.items():
            area = int(piece.sum())
            if area > cell_areas[key]:
                cell_masks[key] = piece
                cell_areas[key] = area

    missing = [index + 1 for index, mask in enumerate(cell_masks) if mask is None]
    if missing:
        raise SliceError(f"missing cats in cells {missing}")
    return [mask for mask in cell_masks if mask is not None]


def shrink_outlier_edge(
    cell: Image.Image,
    bbox: tuple[int, int, int, int],
) -> tuple[int, int, int, int]:
    """Drop a thin differently-colored strip at the bottom (e.g. a hat tip bleed)."""
    left, top, right, bottom = bbox
    arr = np.array(cell)
    height = bottom - top
    strip_h = max(4, round(height * 0.06))
    body = arr[top:bottom - strip_h, left:right]
    body_px = body[body[:, :, 3] > 8][:, :3].astype(np.float64)
    if body_px.size == 0:
        return bbox
    body_mean = body_px.mean(axis=0)
    new_bottom = bottom
    for y in range(bottom - 1, bottom - strip_h - 1, -1):
        row = arr[y, left:right]
        visible = row[row[:, 3] > 8][:, :3].astype(np.float64)
        if visible.size == 0:
            new_bottom = y
            continue
        if np.linalg.norm(visible.mean(axis=0) - body_mean) > 42:
            new_bottom = y
            continue
        break
    return left, top, right, max(top + 8, new_bottom)


def sprite_from_mask(rgba: np.ndarray, mask: np.ndarray, occupied: np.ndarray) -> Image.Image:
    keep = dilate(mask, DILATE_RADIUS) & ~occupied
    alpha = rgba[:, :, 3].copy()
    alpha[~keep] = 0
    ys, xs = np.where(alpha > 8)
    if ys.size == 0:
        raise SliceError("extracted sprite is empty")
    pad = 2
    x0, x1 = max(0, int(xs.min()) - pad), min(rgba.shape[1], int(xs.max()) + 1 + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(rgba.shape[0], int(ys.max()) + 1 + pad)
    crop = np.concatenate([rgba[y0:y1, x0:x1, :3], alpha[y0:y1, x0:x1, None]], axis=2)
    cell = Image.fromarray(crop, "RGBA")
    bbox = cell.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise SliceError("extracted sprite has no visible pixels")
    bbox = shrink_outlier_edge(cell, bbox)
    trimmed = cell.crop(bbox)
    side = max(trimmed.width, trimmed.height)
    margin = max(2, round(side * TRIM_MARGIN_RATIO))
    canvas_side = side + margin * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.alpha_composite(
        trimmed,
        ((canvas_side - trimmed.width) // 2, (canvas_side - trimmed.height) // 2),
    )
    return canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def slice_sheet(source: Path) -> tuple[list[Image.Image], dict[str, Any]]:
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
        rgba = np.array(image)
    masks = extract_cell_masks(rgba)
    occupied = np.zeros(rgba.shape[:2], dtype=bool)
    for mask in masks:
        occupied |= mask

    sprites: list[Image.Image] = []
    cells: list[dict[str, Any]] = []
    for index, mask in enumerate(masks):
        others = occupied & ~mask
        sprite = sprite_from_mask(rgba, mask, others)
        if sprite.size != (OUTPUT_SIZE, OUTPUT_SIZE) or sprite.mode != "RGBA":
            raise SliceError(f"invalid sprite for level {index + 1}")
        if sprite.getpixel((0, 0))[3] != 0 or sprite.getpixel((OUTPUT_SIZE - 1, OUTPUT_SIZE - 1))[3] != 0:
            raise SliceError(f"level {index + 1} is not padded/transparent at corners")
        sprites.append(sprite)
        ys, xs = np.where(mask)
        cells.append({
            "level": index + 1,
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
            "pixels": int(mask.sum()),
        })
    report = {
        "source": str(source),
        "source_size": [rgba.shape[1], rgba.shape[0]],
        "grid": [GRID_COLUMNS, GRID_ROWS],
        "output_size": [OUTPUT_SIZE, OUTPUT_SIZE],
        "cells": cells,
    }
    return sprites, report


def write_sprites(sprites: list[Image.Image], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for index, sprite in enumerate(sprites):
        sprite.save(output_dir / f"cat_{index + 1:02}.png", format="PNG", optimize=True)


def copy_source_sheet(source: Path, resource_name: str) -> None:
    RESOURCE_IMAGES.mkdir(parents=True, exist_ok=True)
    (RESOURCE_IMAGES / "_source").mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, RESOURCE_IMAGES / resource_name)
    shutil.copy2(source, RESOURCE_IMAGES / "_source" / resource_name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Slice generated cat skins into runtime sprites.")
    parser.add_argument("--dry-run", action="store_true", help="Slice into a temp folder without replacing runtime files.")
    args = parser.parse_args()

    reports = []
    for spec in SKIN_SOURCES:
        source: Path = spec["source"]
        skin: str = spec["skin"]
        if not source.exists():
            raise FileNotFoundError(f"Missing generated sheet: {source}")
        sprites, report = slice_sheet(source)
        report["skin"] = skin
        output_dir = RUNTIME_CATS / skin
        if args.dry_run:
            output_dir = ROOT / "cat" / "sliced" / skin
        write_sprites(sprites, output_dir)
        if not args.dry_run:
            copy_source_sheet(source, spec["resource_name"])
        report["output_dir"] = str(output_dir)
        reports.append(report)
        print(f"Sliced 12 sprites for {skin} -> {output_dir}")

    report_path = (ROOT / "cat" / "sliced" / "slice-report.json") if args.dry_run else (
        ROOT / "resources" / "shop-cat-skins" / "slice-report.json"
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
