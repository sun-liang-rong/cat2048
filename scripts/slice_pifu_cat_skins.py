#!/usr/bin/env python3
"""Slice the 4x3 transparent cat sheets in ``pifu/`` into runtime sprites."""

from __future__ import annotations

import argparse
import json
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

from apply_generated_cat_skins import (
    DILATE_RADIUS,
    TRIM_MARGIN_RATIO,
    dilate,
    extract_cell_masks,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "packages" / "game" / "assets" / "resources" / "game" / "cats"
GRID_COLUMNS = 4
GRID_ROWS = 3
OUTPUT_SIZE = 256

SKINS = (
    ("costume", "ChatGPT Image 2026年8月26日 16_55_29.png"),
    ("ocean", "ChatGPT Image 2026年8月26日 17_19_05.png"),
    ("dream", "ChatGPT Image 2026年8月26日 17_25_11.png"),
    ("jiguang", "jiguang.png"),
)


def write_image_meta(path: Path) -> None:
    asset_key = path.relative_to(ROOT).as_posix()
    asset_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"cat2048:{asset_key}"))
    texture_id = uuid.uuid5(uuid.NAMESPACE_URL, f"cat2048:{asset_key}:texture").hex[:6]
    meta = {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": asset_uuid,
        "files": [".json", ".png"],
        "subMetas": {
            texture_id: {
                "importer": "texture",
                "uuid": f"{asset_uuid}@{texture_id}",
                "displayName": path.stem,
                "id": texture_id,
                "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge",
                    "wrapModeT": "clamp-to-edge",
                    "minfilter": "linear",
                    "magfilter": "linear",
                    "mipfilter": "none",
                    "anisotropy": 0,
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": asset_uuid,
                    "visible": False,
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
        },
        "userData": {
            "type": "texture",
            "fixAlphaTransparencyArtifacts": True,
            "hasAlpha": True,
            "redirect": f"{asset_uuid}@{texture_id}",
        },
    }
    path.with_name(f"{path.name}.meta").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_directory_meta(path: Path) -> None:
    asset_key = path.relative_to(ROOT).as_posix()
    path.with_suffix(".meta").write_text(
        json.dumps({
            "ver": "1.2.0",
            "importer": "directory",
            "imported": True,
            "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, f"cat2048:{asset_key}")),
            "files": [],
            "subMetas": {},
            "userData": {},
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sprites_from_full_subjects(source: Path) -> tuple[list[Image.Image], list[dict[str, object]]]:
    """Extract complete subjects without trimming differently colored bottom pixels."""
    with Image.open(source) as opened:
        rgba = np.array(opened.convert("RGBA"))
    masks = extract_cell_masks(rgba)
    occupied = np.zeros(rgba.shape[:2], dtype=bool)
    for mask in masks:
        occupied |= mask

    sprites: list[Image.Image] = []
    segments: list[dict[str, object]] = []
    for index, mask in enumerate(masks):
        keep = dilate(mask, DILATE_RADIUS) & ~(occupied & ~mask)
        alpha = rgba[:, :, 3].copy()
        alpha[~keep] = 0
        ys, xs = np.where(alpha > 8)
        if ys.size == 0:
            raise ValueError(f"{source}: extracted sprite {index + 1} is empty")
        x0, x1 = max(0, int(xs.min()) - 2), min(rgba.shape[1], int(xs.max()) + 3)
        y0, y1 = max(0, int(ys.min()) - 2), min(rgba.shape[0], int(ys.max()) + 3)
        crop = np.concatenate([rgba[y0:y1, x0:x1, :3], alpha[y0:y1, x0:x1, None]], axis=2)
        trimmed = Image.fromarray(crop, "RGBA")
        side = max(trimmed.width, trimmed.height)
        margin = max(2, round(side * TRIM_MARGIN_RATIO))
        canvas = Image.new("RGBA", (side + margin * 2, side + margin * 2), (0, 0, 0, 0))
        canvas.alpha_composite(
            trimmed,
            ((canvas.width - trimmed.width) // 2, (canvas.height - trimmed.height) // 2),
        )
        sprites.append(canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS))
        segments.append({
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
            "pixels": int(mask.sum()),
        })
    return sprites, segments


def slice_skin(skin: str, source: Path, output_root: Path) -> dict[str, object]:
    output_dir = output_root / skin
    output_dir.mkdir(parents=True, exist_ok=True)
    write_directory_meta(output_dir)
    with Image.open(source) as opened:
        source_size = list(opened.size)
    sprites, segments = sprites_from_full_subjects(source)
    cells: list[dict[str, object]] = []
    for index, (sprite, segment) in enumerate(zip(sprites, segments)):
        output = output_dir / f"cat_{index + 1:02}.png"
        sprite.save(output, format="PNG", optimize=True)
        write_image_meta(output)
        cells.append({
            "level": index + 1,
            "source_bbox": segment["bbox"],
            "source_pixels": segment["pixels"],
            "output": str(output),
        })
    return {
        "skin": skin,
        "source": str(source),
        "source_size": source_size,
        "grid": [GRID_COLUMNS, GRID_ROWS],
        "output_size": [OUTPUT_SIZE, OUTPUT_SIZE],
        "cells": cells,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path,
                        default=ROOT / "resources" / "shop-cat-skins" / "pifu-new-slice-report.json")
    parser.add_argument(
        "--skin",
        action="append",
        choices=[skin for skin, _ in SKINS],
        help="Only slice the selected skin. May be passed more than once.",
    )
    args = parser.parse_args()
    selected = set(args.skin or (skin for skin, _ in SKINS))
    reports = []
    for skin, filename in SKINS:
        if skin not in selected:
            continue
        source = ROOT / "pifu" / filename
        if not source.exists():
            raise FileNotFoundError(source)
        reports.append(slice_skin(skin, source, args.output))
        print(f"Sliced 12 sprites for {skin} -> {args.output / skin}")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
