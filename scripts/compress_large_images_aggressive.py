#!/usr/bin/env python3
"""
使用更激进的压缩策略：
1. 降低颜色深度
2. 调整尺寸（如果过大）
3. 有损压缩
"""
import os
import sys
from pathlib import Path
from PIL import Image

TARGET_FILES = [
    "packages/game/assets/resources/game/ui/home/home_cat_room.png",
    "packages/game/assets/resources/game/ui/home/home_play_paw.png",
    "packages/game/assets/resources/game/backgrounds/board/pink/bg_board_pink.png",
    "packages/game/assets/resources/game/ui/collection/collection_background.png",
    "packages/game/assets/resources/game/ui/home/home_background.png",
    "packages/game/assets/resources/game/backgrounds/board/star/bg_board_star.png",
    "packages/game/assets/resources/game/backgrounds/board/wood/bg_board_wood.png",
    "packages/game/assets/resources/game/backgrounds/common/share_score_bg.png",
]

MAX_WIDTH = 750  # 移动端最大宽度

def get_file_size_kb(filepath):
    return os.path.getsize(filepath) / 1024

def compress_image(filepath):
    """激进压缩图片"""
    try:
        img = Image.open(filepath)
        original_size = get_file_size_kb(filepath)

        # 1. 调整尺寸（如果宽度超过 750px）
        if img.width > MAX_WIDTH:
            ratio = MAX_WIDTH / img.width
            new_height = int(img.height * ratio)
            img = img.resize((MAX_WIDTH, new_height), Image.Resampling.LANCZOS)
            print(f"  调整尺寸: {img.width}x{img.height}")

        # 2. 颜色量化（保留透明度）
        if img.mode == 'RGBA':
            # 分离 alpha 通道
            alpha = img.split()[3]

            # RGB 量化
            rgb_img = img.convert('RGB')
            rgb_img = rgb_img.convert('P', palette=Image.Palette.ADAPTIVE, colors=128)
            rgb_img = rgb_img.convert('RGB')

            # 重新添加 alpha
            rgb_img.putalpha(alpha)
            img = rgb_img
        elif img.mode == 'RGB':
            img = img.convert('P', palette=Image.Palette.ADAPTIVE, colors=128)
            img = img.convert('RGB')

        # 3. 保存时使用最大压缩
        img.save(filepath, 'PNG', optimize=True, compress_level=9)

        new_size = get_file_size_kb(filepath)
        reduction = ((original_size - new_size) / original_size) * 100

        print(f"✓ {Path(filepath).name}")
        print(f"  {original_size:.1f}KB → {new_size:.1f}KB (-{reduction:.1f}%)")

        return original_size, new_size

    except Exception as e:
        print(f"✗ {filepath}: {e}", file=sys.stderr)
        return 0, 0

def main():
    print("开始激进压缩大尺寸图片...")
    print("=" * 60)

    total_original = 0
    total_compressed = 0

    for filepath in TARGET_FILES:
        if not os.path.exists(filepath):
            print(f"⚠ 文件不存在: {filepath}")
            continue

        original, compressed = compress_image(filepath)
        total_original += original
        total_compressed += compressed
        print()

    print("=" * 60)
    print(f"总计: {total_original:.1f}KB → {total_compressed:.1f}KB")

    if total_original > 0:
        total_reduction = ((total_original - total_compressed) / total_original) * 100
        saved_mb = (total_original - total_compressed) / 1024
        print(f"节省: {saved_mb:.2f}MB ({total_reduction:.1f}%)")

    print("\n✓ 压缩完成！")

if __name__ == '__main__':
    main()
