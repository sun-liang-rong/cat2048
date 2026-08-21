#!/usr/bin/env python3
"""将 iconfont 字体（.ttf）字形渲染为透明 PNG 或雪碧图。

用法:
  # 渲染指定字符为独立 PNG（每个字符一个文件，128x128）
  python3 iconfont_to_images.py --font iconfont.ttf --out ui/common/icons \
      --size 128 --chars "‹×⚙"

  # 渲染字体中全部字符
  python3 iconfont_to_images.py --font iconfont.ttf --out ui/common/icons --size 128

  # 合并为雪碧图并输出裁剪配置（与 stats_sprite_sheet 裁剪配置同格式）
  python3 iconfont_to_images.py --font iconfont.ttf --out . --size 128 --sprite iconfont_sheet

依赖: pip install Pillow
"""
from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PADDING_RATIO = 0.08  # 字形四周留白比例
RENDER_SCALE = 4      # 先大字号渲染再缩放，提升边缘质量


def render_glyph(font: ImageFont.FreeTypeFont, char: str, size: int) -> Image.Image:
    """渲染单个字形为居中、裁剪边距后的透明图（尺寸为 size*size）。"""
    render_size = size * RENDER_SCALE
    canvas = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.text((render_size / 2, render_size / 2), char, font=font,
              fill=(255, 255, 255, 255), anchor="mm")
    bbox = canvas.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glyph = canvas.crop(bbox)
    padded = size * (1 - PADDING_RATIO * 2)
    scale = min(padded / glyph.width, padded / glyph.height)
    resized = glyph.resize(
        (max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))),
        Image.Resampling.LANCZOS,
    )
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return out


def collect_characters(font: ImageFont.FreeTypeFont) -> str:
    """收集字体实际包含的字形字符（排除 .notdef 与空白）。"""
    chars: list[str] = []
    for code in range(0x20, 0xFFFF):
        char = chr(code)
        if font.getmask(char).getbbox():
            try:
                name = unicodedata.category(char)
            except ValueError:
                continue
            if not name.startswith(("C", "Z")):  # 跳过控制符/分隔符
                chars.append(char)
    return "".join(chars)


def main() -> int:
    parser = argparse.ArgumentParser(description="iconfont 字形转 PNG/雪碧图")
    parser.add_argument("--font", required=True, help="iconfont .ttf 路径")
    parser.add_argument("--out", required=True, help="输出目录")
    parser.add_argument("--size", type=int, default=128, help="输出尺寸（像素）")
    parser.add_argument("--chars", default="", help="要渲染的字符（默认：字体中全部字形）")
    parser.add_argument("--color", default="#333333", help="字形颜色（默认深灰）")
    parser.add_argument("--sprite", default="", help="合并雪碧图文件名（不带扩展名）")
    args = parser.parse_args()

    font_path = Path(args.font)
    if not font_path.exists():
        raise FileNotFoundError(f"字体不存在: {font_path}")
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(str(font_path), args.size * RENDER_SCALE)

    chars = args.chars or collect_characters(font)
    if not chars:
        raise ValueError("未找到任何字形字符")
    print(f"渲染 {len(chars)} 个字符 -> {out_dir}")

    color = tuple(int(args.color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    images: list[tuple[str, Image.Image]] = []
    for char in chars:
        name = f"icon_{ord(char):04x}"  # 用 Unicode 码点命名，避免特殊字符作文件名
        img = render_glyph(font, char, args.size)
        tinted = Image.new("RGBA", img.size, color)
        tinted.putalpha(img.getchannel("A"))
        images.append((name, tinted))
        if not args.sprite:
            tinted.save(out_dir / f"{name}.png", optimize=True)

    if args.sprite:
        sheet_name = args.sprite
        count = len(images)
        cols = max(1, int(count ** 0.5))
        rows = (count + cols - 1) // cols
        sheet = Image.new("RGBA", (cols * args.size, rows * args.size), (0, 0, 0, 0))
        icons: list[dict] = []
        for index, (name, img) in enumerate(images):
            col, row = divmod(index, cols)
            x, y = col * args.size, row * args.size
            sheet.alpha_composite(img, (x, y))
            icons.append({"name": name, "x": x, "y": y,
                          "width": args.size, "height": args.size})
        sheet_path = out_dir / f"{sheet_name}.png"
        sheet.save(sheet_path, optimize=True)
        (out_dir / f"{sheet_name}.json").write_text(
            json.dumps({"width": sheet.width, "height": sheet.height, "icons": icons},
                       ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"雪碧图: {sheet_path} ({sheet.width}x{sheet.height}, {len(icons)} 图标)")
        print(f"配置:   {out_dir / (sheet_name + '.json')}")
    else:
        print(f"已生成 {len(images)} 个 PNG 到 {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
