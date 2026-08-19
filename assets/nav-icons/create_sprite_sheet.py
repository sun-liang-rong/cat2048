#!/usr/bin/env python3
"""
将导航栏图标合并为雪碧图
"""
from PIL import Image
import json
import os

# 配置
ICON_SIZE = 144  # 每个图标的尺寸
ICONS = [
    'nav_icon_collection.png',
    'nav_icon_shop.png', 
    'nav_icon_tasks.png',
    'nav_icon_settings.png'
]
INPUT_DIR = 'assets/nav-icons/images'
OUTPUT_SPRITE = 'game/assets/resources/game/ui/home-v2/nav_sprite_sheet.png'
OUTPUT_CONFIG = 'game/assets/resources/game/ui/home-v2/nav_sprite_sheet.json'

def create_sprite_sheet():
    """创建雪碧图"""
    # 创建输出目录
    os.makedirs(os.path.dirname(OUTPUT_SPRITE), exist_ok=True)
    
    # 创建雪碧图画布 (4个图标横排)
    sprite_width = ICON_SIZE * len(ICONS)
    sprite_height = ICON_SIZE
    sprite = Image.new('RGBA', (sprite_width, sprite_height), (0, 0, 0, 0))
    
    # 配置数据
    config = {
        'width': sprite_width,
        'height': sprite_height,
        'icons': []
    }
    
    # 逐个粘贴图标
    for i, icon_file in enumerate(ICONS):
        icon_path = os.path.join(INPUT_DIR, icon_file)
        if not os.path.exists(icon_path):
            print(f"WARNING: {icon_path} not found, skipping")
            continue
            
        icon = Image.open(icon_path)
        
        # 调整尺寸
        if icon.size != (ICON_SIZE, ICON_SIZE):
            icon = icon.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)
        
        # 粘贴到雪碧图
        x_offset = i * ICON_SIZE
        sprite.paste(icon, (x_offset, 0), icon)
        
        # 记录配置
        icon_name = os.path.splitext(icon_file)[0].replace('nav_icon_', '')
        config['icons'].append({
            'name': icon_name,
            'x': x_offset,
            'y': 0,
            'width': ICON_SIZE,
            'height': ICON_SIZE
        })
        
        print(f"[OK] Added {icon_name} at x={x_offset}")
    
    # 保存雪碧图
    sprite.save(OUTPUT_SPRITE, 'PNG', optimize=True)
    print(f"\n[OK] Sprite sheet saved: {OUTPUT_SPRITE}")
    print(f"  Size: {sprite_width}x{sprite_height}px")
    
    # 保存配置文件
    with open(OUTPUT_CONFIG, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f"[OK] Config saved: {OUTPUT_CONFIG}")

if __name__ == '__main__':
    create_sprite_sheet()
