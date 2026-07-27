# 猫咪 2048（Cocos Creator 3.8.8）

这是首个可玩垂直切片，包含主页、经典 4×4 猫咪 2048、分数与最高分、滑动和键盘操作、
移动/合并/出生反馈、重新开始与返回确认、游戏结束弹窗、音效开关以及本地持久化。

## 开发

环境要求：Node.js 20+、Python 3.9+（安装 Pillow）和 Cocos Creator 3.8.8。
仓库根目录的 `.nvmrc` 可用于切换到推荐的 Node 版本。

1. 使用 Cocos Dashboard 导入本目录 `game/`，编辑器版本选择 3.8.8。
2. 首次打开后等待 Cocos 导入素材并生成 `temp/`。
3. 打开 `assets/main.scene`，将其设为启动场景，然后使用浏览器预览。
4. 微信小游戏构建时选择竖屏；本切片不依赖任何微信 API。

## 命令

```bash
npm install
npm run prepare:assets
npm run typecheck:core
npm test
npm run verify
```

资源准备脚本从仓库根目录的美术源文件裁切并校验运行时资源，输出到
`assets/resources/game/`。背景直接由 `_source` 中的生成原图缩放裁切，无需在其上级目录保留重复副本。
不要将 `_source`、接口响应记录或未使用的大图复制进 Cocos 工程。

## 操作

- 手机或浏览器：在棋盘内向上、下、左、右滑动。
- 桌面调试：方向键或 WASD。
- 每次有效移动后随机生成一只猫；90% 为 Lv1，10% 为 Lv2。
- 同等级猫咪合并升级，Lv9 为最终等级。
