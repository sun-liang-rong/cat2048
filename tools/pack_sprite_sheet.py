#!/usr/bin/env python3
"""Pack equally sized RGBA images into one horizontal sprite sheet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def parse_source(value: str) -> tuple[str, Path]:
    name, separator, raw_path = value.partition("=")
    if not separator or not name.strip() or not raw_path.strip():
        raise argparse.ArgumentTypeError("sources must use NAME=PATH")
    return name.strip(), Path(raw_path.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", action="append", type=parse_source, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()

    entries: list[tuple[str, Image.Image]] = []
    cell_size: tuple[int, int] | None = None
    for name, path in args.source:
        with Image.open(path) as opened:
            image = opened.convert("RGBA")
        if cell_size is None:
            cell_size = image.size
        elif image.size != cell_size:
            raise SystemExit(f"All sources must have the same size: {path} is {image.size}, expected {cell_size}")
        entries.append((name, image))

    assert cell_size is not None
    cell_width, cell_height = cell_size
    sheet = Image.new("RGBA", (cell_width * len(entries), cell_height), (0, 0, 0, 0))
    icons = []
    for index, (name, image) in enumerate(entries):
        x = index * cell_width
        sheet.alpha_composite(image, (x, 0))
        icons.append({
            "name": name,
            "x": x,
            "y": 0,
            "width": cell_width,
            "height": cell_height,
        })

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.config.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, format="PNG", optimize=True)
    args.config.write_text(json.dumps({
        "width": sheet.width,
        "height": sheet.height,
        "icons": icons,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK {args.output} ({sheet.width}x{sheet.height}, {len(entries)} sprites)")
    print(f"OK {args.config}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
