from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image

ALPHA_THRESHOLD = 8
GRID_COLUMNS = 4
GRID_ROWS = 3
SOURCE_SIZE = (2048, 2048)
EDGE_MARGIN_RATIO = 0.12
OUTPUT_SIZE = 256
TRIM_MARGIN_RATIO = 0.06


class SliceValidationError(ValueError):
    """Raised when a generated sprite sheet cannot be safely sliced."""


def cell_box(index: int, width: int, height: int) -> tuple[int, int, int, int]:
    if index < 0 or index >= GRID_COLUMNS * GRID_ROWS:
        raise ValueError(f"Invalid cat cell index: {index}")
    row, column = divmod(index, GRID_COLUMNS)
    left = round(column * width / GRID_COLUMNS)
    top = round(row * height / GRID_ROWS)
    right = round((column + 1) * width / GRID_COLUMNS)
    bottom = round((row + 1) * height / GRID_ROWS)
    return left, top, right, bottom


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    thresholded = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return thresholded.getbbox()


def validate_cell(index: int, cell: Image.Image) -> tuple[int, int, int, int]:
    bbox = alpha_bbox(cell)
    if bbox is None:
        raise SliceValidationError(f"cell {index + 1} is empty")
    left, top, right, bottom = bbox
    edge_x = math.ceil(cell.width * EDGE_MARGIN_RATIO)
    edge_y = math.ceil(cell.height * EDGE_MARGIN_RATIO)
    if left < edge_x:
        raise SliceValidationError(f"cell {index + 1} touches left safety margin")
    if top < edge_y:
        raise SliceValidationError(f"cell {index + 1} touches top safety margin")
    if right > cell.width - edge_x:
        raise SliceValidationError(f"cell {index + 1} touches right safety margin")
    if bottom > cell.height - edge_y:
        raise SliceValidationError(f"cell {index + 1} touches bottom safety margin")
    return bbox


def trim_to_square(cell: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    trimmed = cell.crop(bbox)
    side = max(trimmed.width, trimmed.height)
    margin = max(2, round(side * TRIM_MARGIN_RATIO))
    canvas_side = side + margin * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.alpha_composite(trimmed, ((canvas_side - trimmed.width) // 2, (canvas_side - trimmed.height) // 2))
    return canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def sha256(image_path: Path) -> str:
    return hashlib.sha256(image_path.read_bytes()).hexdigest()


def slice_sheet(source: Path, output_dir: Path, skin: str) -> dict[str, Any]:
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
        if image.size != SOURCE_SIZE:
            raise SliceValidationError(f"{source}: expected {SOURCE_SIZE}, got {image.size}")
        pending: list[tuple[int, Path, Image.Image, tuple[int, int, int, int], tuple[int, int, int, int]]] = []
        for index in range(GRID_COLUMNS * GRID_ROWS):
            box = cell_box(index, image.width, image.height)
            cell = image.crop(box)
            bbox = validate_cell(index, cell)
            result = trim_to_square(cell, bbox)
            output = output_dir / f"cat_{index + 1:02}.png"
            pending.append((index, output, result, box, bbox))

    report_cells: list[dict[str, Any]] = []
    for index, output, result, box, bbox in pending:
        report_cells.append({
            "level": index + 1,
            "box": list(box),
            "alpha_bbox": list(bbox),
            "output": output.name,
            "size": [OUTPUT_SIZE, OUTPUT_SIZE],
        })

    output_dir.mkdir(parents=True, exist_ok=True)
    for (_, output, result, _, _) in pending:
        result.save(output, format="PNG", optimize=True)
    for cell in report_cells:
        cell["sha256"] = sha256(output_dir / cell["output"])
    report = {
        "skin": skin,
        "source": str(source),
        "source_size": list(SOURCE_SIZE),
        "grid": [GRID_COLUMNS, GRID_ROWS],
        "output_size": [OUTPUT_SIZE, OUTPUT_SIZE],
        "cells": report_cells,
    }
    (output_dir / f"{skin}-slice-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and slice a 4x3 cat sprite sheet.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--skin", required=True, choices=["classic", "sunny", "aurora"])
    args = parser.parse_args()
    report = slice_sheet(args.source, args.out_dir, args.skin)
    print(f"Sliced {len(report['cells'])} cat sprites for {args.skin} into {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
