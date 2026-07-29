from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
FONT_PATH = ROOT / 'game' / 'assets' / 'resources' / 'game' / 'fonts' / 'display.ttf'


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('Usage: generate_wechat_loading_title.py <output.png>')
    if not FONT_PATH.is_file():
        raise SystemExit(f'Missing loading-screen font: {FONT_PATH}')

    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new('RGBA', (452, 108), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT_PATH), 64)
    position = (226, 50)
    draw.text((position[0] + 3, position[1] + 5), '猫咪 2048', font=font, anchor='mm', fill=(235, 105, 77, 255), stroke_width=2, stroke_fill=(235, 105, 77, 255))
    draw.text(position, '猫咪 2048', font=font, anchor='mm', fill=(57, 45, 38, 255), stroke_width=2, stroke_fill=(57, 45, 38, 255))
    image.save(output, 'PNG', optimize=True)


if __name__ == '__main__':
    main()
