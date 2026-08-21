#!/usr/bin/env python3
"""Prepare the generated Cat 2048 art for the Cocos resources bundle."""

from __future__ import annotations

import json
import math
import struct
import wave
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image
from PIL import ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resources" / "art-generation" / "images"
RAW_SOURCE = SOURCE / "_source"
EXTRA_CATS_SOURCE = ROOT / "resources" / "art-generation" / "generated" / "cats-10-12"
INDIVIDUAL_CATS_SOURCE = ROOT / "resources" / "cat2048" / "skins-v2" / "individual"
OUTPUT = ROOT / "packages" / "game" / "assets" / "resources" / "game"
FONT_SOURCE = ROOT / "resources" / "art-generation" / "fonts" / "ZCOOLKuaiLe-Regular.ttf"
FONT_OUTPUT = OUTPUT / "fonts"
DISPLAY_FONT = FONT_OUTPUT / "display.ttf"
NUMBER_FONT_CHARACTERS = "0123456789Lv.+×"
DISPLAY_FONT_ALLOWLIST = (
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz "
    ".,+-:;!?/×★·↶›，。！？、：；（）《》【】“”‘’…—"
)
ALPHA_THRESHOLD = 8
CAT_LEVELS = range(1, 13)
EXPECTED_IMAGE_SIZES = {
    **{f"cat_{level:02}.png": (256, 256) for level in CAT_LEVELS},
    "bg_page.png": (750, 1334),
    "bg_board_wood.png": (1024, 1024),
    "bg_board_pink.png": (1024, 1024),
    "bg_board_star.png": (1024, 1024),
    "share_score_bg.png": (1000, 800),
    **{name: (256, 256) for name in [
        "tile_empty.png", "tile_selected.png", "sparkle_small.png",
        "merge_sparkle.png", "merge_burst.png", "max_halo.png",
    ]},
    **{name: (160, 160) for name in [
        "close.png", "back.png", "home.png", "check.png", "share.png",
        "sound_on.png", "sound_off.png", "settings.png", "info.png", "locked.png",
        "classic_mode.png", "collection.png", "undo.png", "remove_lowest.png",
        "coin.png",
    ]},
    **{name: (256, 256) for name in [
        "aurora_sparkle.png", "aurora_burst.png",
        "stars_sparkle.png", "stars_burst.png",
    ]},
}

BACKGROUND_TARGETS = {
    "bg_page": "backgrounds/common",
    "share_score_bg": "backgrounds/common",
    "bg_board_wood": "backgrounds/board/wood",
    "bg_board_pink": "backgrounds/board/pink",
    "bg_board_star": "backgrounds/board/star",
}


def project_font_characters() -> str:
    """Collect characters which can be rendered with the custom display font."""
    source_paths = [
        *sorted((ROOT / "packages" / "game" / "assets" / "scripts").rglob("*.ts")),
        ROOT / "packages" / "game" / "assets" / "main.scene",
    ]
    characters = set(DISPLAY_FONT_ALLOWLIST)
    for path in source_paths:
        text = path.read_text(encoding="utf-8", errors="ignore")
        characters.update(character for character in text if ord(character) > 127)
    return "".join(sorted(characters))


def generate_display_font() -> None:
    if not FONT_SOURCE.exists():
        raise FileNotFoundError(f"Missing source display font: {FONT_SOURCE}")
    FONT_OUTPUT.mkdir(parents=True, exist_ok=True)
    options = subset.Options()
    options.layout_features = ["*"]
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    font = TTFont(FONT_SOURCE)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=project_font_characters())
    subsetter.subset(font)
    font.save(DISPLAY_FONT)


def generate_number_font() -> None:
    """Generate a compact BMFont atlas for score and level labels."""
    font_size = 72
    padding = 5
    columns = 8
    font = ImageFont.truetype(str(FONT_SOURCE), font_size)
    metrics: list[tuple[str, tuple[int, int, int, int], int]] = []
    cell_width = 0
    cell_height = 0
    for character in NUMBER_FONT_CHARACTERS:
        bbox = font.getbbox(character, stroke_width=1)
        advance = max(1, round(font.getlength(character)))
        metrics.append((character, bbox, advance))
        cell_width = max(cell_width, bbox[2] - bbox[0] + padding * 2)
        cell_height = max(cell_height, bbox[3] - bbox[1] + padding * 2)
    rows = math.ceil(len(metrics) / columns)
    atlas = Image.new("RGBA", (cell_width * columns, cell_height * rows), (255, 255, 255, 0))
    draw = ImageDraw.Draw(atlas)
    glyph_lines: list[str] = []
    for index, (character, bbox, advance) in enumerate(metrics):
        column = index % columns
        row = index // columns
        cell_x = column * cell_width
        cell_y = row * cell_height
        glyph_width = bbox[2] - bbox[0]
        glyph_height = bbox[3] - bbox[1]
        x = cell_x + padding
        y = cell_y + padding
        draw.text(
            (x - bbox[0], y - bbox[1]),
            character,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=1,
            stroke_fill=(255, 255, 255, 255),
        )
        glyph_lines.append(
            f"char id={ord(character)} x={x} y={y} width={glyph_width} height={glyph_height} "
            f"xoffset={bbox[0]} yoffset={bbox[1]} xadvance={advance} page=0 chnl=15"
        )
    atlas_path = FONT_OUTPUT / "score.png"
    atlas.save(atlas_path, format="PNG", optimize=True)
    descriptor = "\n".join([
        f'info face="ZCOOL KuaiLe Score" size={font_size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1',
        f"common lineHeight={font_size + 10} base={font_size} scaleW={atlas.width} scaleH={atlas.height} pages=1 packed=0",
        'page id=0 file="score.png"',
        f"chars count={len(glyph_lines)}",
        *glyph_lines,
        "kernings count=0",
        "",
    ])
    (FONT_OUTPUT / "score.fnt").write_text(descriptor, encoding="utf-8")


def prepare_fonts() -> None:
    generate_display_font()
    generate_number_font()
    if DISPLAY_FONT.stat().st_size >= 96 * 1024:
        raise ValueError(f"Display font subset is unexpectedly large: {DISPLAY_FONT.stat().st_size} bytes")
    if (FONT_OUTPUT / "score.png").stat().st_size >= 64 * 1024:
        raise ValueError("Number font atlas is unexpectedly large")


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
    with Image.open(SOURCE / source_name) as opened:
        image = opened.convert("RGBA")
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


def copy_generated_cats() -> None:
    """Copy the approved 36 individual cat renders into all three skin themes."""
    for skin in ["classic", "sunny", "aurora"]:
        out_dir = OUTPUT / "cats" / skin
        out_dir.mkdir(parents=True, exist_ok=True)
        for level in CAT_LEVELS:
            source = INDIVIDUAL_CATS_SOURCE / f"cat_{skin}_{level:02}.png"
            if not source.exists():
                raise FileNotFoundError(f"Missing generated cat asset: {source}")
            with Image.open(source) as opened:
                image = opened.convert("RGBA")
                if image.size != (256, 256):
                    raise ValueError(f"Invalid generated cat dimensions for {source}: {image.size}")
                image.save(out_dir / f"cat_{level:02}.png", format="PNG", optimize=True)


def slice_grid_cells(source_name: str, cols: int, rows: int, cells: dict[int, str],
                     target: str, size: int) -> None:
    with Image.open(SOURCE / source_name) as opened:
        image = opened.convert("RGBA")
        cell_w = image.width / cols
        cell_h = image.height / rows
        out_dir = OUTPUT / target
        out_dir.mkdir(parents=True, exist_ok=True)
        for index, name in cells.items():
            if index < 0 or index >= cols * rows:
                raise ValueError(f"{source_name}: invalid cell index {index}")
            row, col = divmod(index, cols)
            left, top = round(col * cell_w), round(row * cell_h)
            right, bottom = round((col + 1) * cell_w), round((row + 1) * cell_h)
            result = trim_and_square(image.crop((left, top, right, bottom)), size)
            result.save(out_dir / f"{name}.png", optimize=True)


def prepare_background(name: str, size: tuple[int, int], target: str) -> None:
    """Build a runtime background directly from the generated source image."""
    with Image.open(RAW_SOURCE / f"{name}.png") as opened:
        image = opened.convert("RGBA")
        width, height = size
        scale = max(width / image.width, height / image.height)
        resized = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
        left = max(0, (resized.width - width) // 2)
        top = max(0, (resized.height - height) // 2)
        result = resized.crop((left, top, left + width, top + height))
    destination = OUTPUT / target / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination.with_suffix(".png"), format="PNG", optimize=True)


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
        *(OUTPUT / "cats" / "classic" / f"cat_{level:02}.png" for level in CAT_LEVELS),
        *(OUTPUT / "cats" / skin / f"cat_{level:02}.png"
          for skin in ["sunny", "aurora"] for level in CAT_LEVELS),
        *(OUTPUT / "backgrounds" / "common" / name
          for name in ["bg_page.png", "share_score_bg.png"]),
        *(OUTPUT / "backgrounds" / "board" / theme / f"bg_board_{theme}.png"
          for theme in ["wood", "pink", "star"]),
        *(OUTPUT / "ui" / "common" / name for name in [
            "tile_empty.png", "tile_selected.png", "close.png", "back.png", "home.png",
            "locked.png", "check.png", "share.png", "reward_video.png", "sound_on.png",
            "sound_off.png", "settings.png", "info.png", "level_locked.png",
            "level_current.png", "level_complete.png", "daily.png", "weekly.png",
            "classic_mode.png", "collection.png", "undo.png", "remove_lowest.png", "coin.png",
        ]),
        *(OUTPUT / "effects" / "classic" / name for name in [
            "sparkle_small.png", "merge_sparkle.png", "merge_burst.png", "max_halo.png",
        ]),
        *(OUTPUT / "effects" / theme / name for theme, name in [
            ("aurora", "aurora_sparkle.png"), ("aurora", "aurora_burst.png"),
            ("stars", "stars_sparkle.png"), ("stars", "stars_burst.png"),
        ]),
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
                expected_size = EXPECTED_IMAGE_SIZES[path.name]
                if image.size != expected_size:
                    raise ValueError(f"Invalid image dimensions for {path}: {image.size}, expected {expected_size}")
            if (path.parent.name in {"classic", "sunny", "aurora", "stars", "common"}) and image.mode != "RGBA":
                    raise ValueError(f"Transparent runtime sprite is not RGBA: {path}")
        logical = path.stem
        if path.parent.name in {"sunny", "aurora"}:
            logical = f"cat_skin_{path.parent.name}_{logical}"
        base = path.relative_to(OUTPUT.parent).with_suffix("").as_posix()
        mapping[logical] = base + ("/texture" if path.suffix == ".png" else "")
    return mapping


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    prepare_fonts()
    copy_generated_cats()
    slice_grid_cells("sheet_gameplay.png", 3, 2,
                     {0: "tile_empty", 1: "tile_selected"}, "ui/common", 256)
    slice_grid_cells("sheet_gameplay.png", 3, 2,
                     {2: "sparkle_small", 3: "merge_sparkle", 4: "merge_burst", 5: "max_halo"},
                     "effects/classic", 256)
    slice_grid("sheet_utility.png", 4, 4,
               ["close", "back", "home", "locked", "check", "share", "reward_video", "sound_on",
                 "sound_off", "settings", "info", "level_locked", "level_current", "level_complete",
                 "daily", "weekly"], "ui/common", 160)
    slice_grid_cells("sheet_navigation.png", 3, 2,
                     {0: "classic_mode", 2: "collection"}, "ui/common", 160)
    slice_grid_cells("sheet_economy.png", 4, 2,
                     {0: "undo", 3: "remove_lowest", 4: "coin"}, "ui/common", 160)
    slice_grid_cells("effect_aurora.png", 2, 2,
                     {0: "aurora_sparkle", 1: "aurora_burst"},
                     "effects/aurora", 256)
    slice_grid_cells("effect_stars.png", 2, 2,
                     {0: "stars_sparkle", 1: "stars_burst"},
                     "effects/stars", 256)
    for background, size in {
        "bg_page": (750, 1334),
        "bg_board_wood": (1024, 1024),
        "bg_board_pink": (1024, 1024),
        "bg_board_star": (1024, 1024),
        "share_score_bg": (1000, 800),
    }.items():
        prepare_background(background, size, BACKGROUND_TARGETS[background])
    generate_tone("move", [330, 440], 0.08)
    generate_tone("merge", [523.25, 659.25, 783.99], 0.18)
    generate_tone("game_over", [293.66, 246.94, 196.00], 0.42, 0.18)
    mapping = validate()
    (OUTPUT / "asset-map.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared fonts and validated {len(mapping)} required runtime assets in {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
