# 开发脚本

本目录存放项目的资源处理与构建脚本（原 `tools/`）。

## Python 环境

推荐使用虚拟环境，避免污染系统 Python：

```bash
# 创建并激活虚拟环境
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

> 也可使用 [Poetry](https://python-poetry.org/)：`poetry install`（需自行创建 `pyproject.toml`）。

## 脚本说明

### 资源处理（生成 / 校验运行时资源）

| 脚本 | 用途 | 运行方式 |
|---|---|---|
| `prepare_runtime_assets.py` | 从美术源文件生成猫咪、背景、UI、音效等运行时资源，并输出 `game/assets/resources/game/asset-map.json` | `python3 prepare_runtime_assets.py`（需美术源文件，见 `resources/`） |
| `compress_game_images.py` | 压缩 `game/assets/resources/game` 下的 PNG | `python3 compress_game_images.py` |
| `pack_sprite_sheet.py` | 按配置合并 PNG 雪碧图 | `python3 pack_sprite_sheet.py --config <json>` |
| `slice_cat_sprite_sheets.py` | 从猫咪雪碧图切分出单只猫咪 | `python3 slice_cat_sprite_sheets.py` |
| `apply_generated_cat_skins.py` | 从 `cat/cat1.png`、`cat/cat2.png` 连通域切出 12 只猫，写入 classic / sunny 运行时资源 | `python3 apply_generated_cat_skins.py` |
| `fingerprint_runtime_assets.py` | 生成运行时资源语义指纹（供测试断言） | `python3 fingerprint_runtime_assets.py` |

### 构建 / 微信小游戏

| 脚本 | 用途 | 运行方式 |
|---|---|---|
| `customize_wechat_loading.mjs` | 定制微信小游戏加载页 | `npm run customize:wechat-loading`（在 `game/` 下） |
| `verify_wechat_build.mjs` | 校验微信小游戏构建产物 | `npm run verify:wechat-build`（在 `game/` 下） |
| `migrate-stage1.sh` | 项目重整第 1 阶段迁移脚本（历史记录） | `./migrate-stage1.sh` |

### 测试

| 脚本 | 用途 | 运行方式 |
|---|---|---|
| `test_compress_game_images.py` | `compress_game_images` 单元测试 | `python3 -m unittest scripts.test_compress_game_images` |
| `test_slice_cat_sprite_sheets.py` | `slice_cat_sprite_sheets` 单元测试 | `python3 -m unittest scripts.test_slice_cat_sprite_sheets` |
| `customize_wechat_loading.test.mjs` | `customize_wechat_loading` 单元测试 | `node --test scripts/customize_wechat_loading.test.mjs` |

## 与游戏项目的关联

`game/package.json` 中的 `prepare:assets` / `customize:wechat-loading` / `verify:wechat-build`
命令直接引用本目录脚本；`game/tests/runtime-assets.test.ts` 调用 `fingerprint_runtime_assets.py`
做资源指纹校验。移动脚本位置时需同步更新这些引用。
