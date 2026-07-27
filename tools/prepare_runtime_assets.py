#!/usr/bin/env python3
"""Prepare the generated Cat 2048 art for the Cocos resources bundle."""

from __future__ import annotations

import json
import math
import shutil
import struct
import wave
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "art-generation" / "images"
OUTPUT = ROOT / "game" / "assets" / "resources" / "game"
ALPHA_THRESHOLD = 8


def trim_and_square(image: Image.Image, size: int, margin: float = 0.05) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()
    if not bbox:
        raise ValueError("Sprite cell has no visible pixels")
    rgba = rgba.crop(bbox)
    side = max(rgba.size)
    padded = max(1, round(side * (1 + margin * 2)))
    canvas = Image.new("RGBA", (padded, padded), (0, 0, 0, 0))
    canvas.alpha_composite(rgba, ((padded - rgba.width) // 2, (padded - rgba.height) // 2))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def slice_grid(source_name: str, cols: int, rows: int, names: list[str], target: str, size: int) -> None:
    if len(names) != cols * rows:
        raise ValueError(f"{source_name}: expected {cols * rows} output names")
    image = Image.open(SOURCE / source_name).convert("RGBA")
    cell_w = image.width / cols
    cell_h = image.height / rows
    out_dir = OUTPUT / target
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(names):
        row, col = divmod(index, cols)
        left, top = round(col * cell_w), round(row * cell_h)
        right, bottom = round((col + 1) * cell_w), round((row + 1) * cell_h)
        result = trim_and_square(image.crop((left, top, right, bottom)), size)
        result.save(out_dir / f"{name}.png", optimize=True)


def copy_background(name: str) -> None:
    destination = OUTPUT / "backgrounds" / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / f"{name}.png", destination.with_suffix(".png"))


def generate_tone(name: str, frequencies: list[float], duration: float, volume: float = 0.22) -> None:
    sample_rate = 22050
    frames = bytearray()
    total = int(sample_rate * duration)
    for index in range(total):
        progress = index / max(1, total - 1)
        envelope = min(1.0, progress * 12) * (1 - progress) ** 2
        value = sum(math.sin(2 * math.pi * frequency * index / sample_rate) for frequency in frequencies)
        sample = int(max(-1, min(1, value / len(frequencies) * envelope * volume)) * 32767)
        frames.extend(struct.pack("<h", sample))
    destination = OUTPUT / "audio" / f"{name}.wav"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(frames)


def validate() -> dict[str, str]:
    required = [
        *(OUTPUT / "cats" / f"cat_{level:02}.png" for level in range(1, 10)),
        OUTPUT / "backgrounds" / "bg_home.png",
        OUTPUT / "backgrounds" / "bg_page.png",
        OUTPUT / "backgrounds" / "bg_board_wood.png",
        OUTPUT / "gameplay" / "tile_empty.png",
        OUTPUT / "gameplay" / "tile_selected.png",
        OUTPUT / "gameplay" / "sparkle_small.png",
        OUTPUT / "gameplay" / "merge_sparkle.png",
        OUTPUT / "gameplay" / "merge_burst.png",
        OUTPUT / "gameplay" / "max_halo.png",
        OUTPUT / "ui" / "close.png",
        OUTPUT / "ui" / "back.png",
        OUTPUT / "ui" / "home.png",
        OUTPUT / "ui" / "check.png",
        OUTPUT / "ui" / "share.png",
        OUTPUT / "ui" / "sound_on.png",
        OUTPUT / "ui" / "sound_off.png",
        OUTPUT / "ui" / "settings.png",
        OUTPUT / "ui" / "info.png",
        OUTPUT / "audio" / "move.wav",
        OUTPUT / "audio" / "merge.wav",
        OUTPUT / "audio" / "game_over.wav",
    ]
    mapping: dict[str, str] = {}
    for path in required:
        if not path.exists():
            raise FileNotFoundError(path)
        if path.suffix == ".png":
            with Image.open(path) as image:
                if image.width <= 0 or image.height <= 0:
                    raise ValueError(f"Invalid image dimensions: {path}")
                if path.parent.name in {"cats", "gameplay", "ui"} and image.mode != "RGBA":
                    raise ValueError(f"Transparent runtime sprite is not RGBA: {path}")
        logical = path.stem
        base = path.relative_to(OUTPUT.parent).with_suffix("").as_posix()
        mapping[logical] = base + ("/texture" if path.suffix == ".png" else "")
    return mapping


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    slice_grid("sheet_cats.png", 3, 3, [f"cat_{i:02}" for i in range(1, 10)], "cats", 256)
    slice_grid("sheet_gameplay.png", 3, 2,
               ["tile_empty", "tile_selected", "sparkle_small", "merge_sparkle", "merge_burst", "max_halo"],
               "gameplay", 256)
    slice_grid("sheet_utility.png", 4, 4,
               ["close", "back", "home", "locked", "check", "share", "reward_video", "sound_on",
                "sound_off", "settings", "info", "level_locked", "level_current", "level_complete",
                "daily", "weekly"], "ui", 160)
    for background in ["bg_home", "bg_page", "bg_board_wood"]:
        copy_background(background)
    generate_tone("move", [330, 440], 0.08)
    generate_tone("merge", [523.25, 659.25, 783.99], 0.18)
    generate_tone("game_over", [293.66, 246.94, 196.00], 0.42, 0.18)
    mapping = validate()
    (OUTPUT / "asset-map.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared and validated {len(mapping)} required runtime assets in {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
