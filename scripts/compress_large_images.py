#!/usr/bin/env python3
"""
压缩大尺寸 PNG 图片
目标：quality 65-80，减少 50-70% 体积
"""
import os
import sys
from pathlib import Path
from PIL import Image

# 需要压缩的文件列表
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

def get_file_size_kb(filepath):
    """获取文件大小（KB）"""
    return os.path.getsize(filepath) / 1024

def compress_png(filepath, quality=80):
    """压缩 PNG 图片"""
    try:
        # 打开图片
        img = Image.open(filepath)
        original_size = get_file_size_kb(filepath)

        # 如果是 RGBA 模式，先转换优化
        if img.mode == 'RGBA':
            # 量化颜色数量以减小文件大小
            # 使用 adaptive 方法保持质量
            img = img.quantize(colors=256, method=2)
            # 转回 RGBA 以保持透明度
            img = img.convert('RGBA')

        # 保存优化后的图片
        img.save(
            filepath,
            'PNG',
            optimize=True,
            compress_level=9
        )

        new_size = get_file_size_kb(filepath)
        reduction = ((original_size - new_size) / original_size) * 100

        print(f"✓ {Path(filepath).name}")
        print(f"  {original_size:.1f}KB → {new_size:.1f}KB (-{reduction:.1f}%)")

        return original_size, new_size

    except Exception as e:
        print(f"✗ {filepath}: {e}", file=sys.stderr)
        return 0, 0

def main():
    print("开始压缩大尺寸图片...")
    print("=" * 60)

    total_original = 0
    total_compressed = 0

    for filepath in TARGET_FILES:
        if not os.path.exists(filepath):
            print(f"⚠ 文件不存在: {filepath}")
            continue

        original, compressed = compress_png(filepath)
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
