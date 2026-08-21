# 开发指南

## 环境准备

- Node.js 20+（推荐使用 nvm）
- Python 3.9+（资源处理脚本需要）
- Cocos Creator 3.8.8（打开 `packages/game/`）
- MySQL 8.0（开发后端时）

## 安装依赖

```bash
# 游戏项目
cd packages/game && npm install

# 后端服务
cd packages/server && npm install

# Python 资源脚本（可选，生成/验证资源时）
pip install -r scripts/requirements.txt
```

## 测试

```bash
# 游戏项目（类型检查 + Vitest 单测）
cd packages/game && npm run verify

# 后端
cd packages/server && npm test && npm run test:e2e

# 资源脚本测试
python3 -m unittest scripts.test_compress_game_images scripts.test_slice_cat_sprite_sheets
node --test scripts/customize_wechat_loading.test.mjs
```

## 配置管理

### 配置中心 `packages/game/assets/scripts/core/config/`

所有游戏配置与规则常量统一在此目录：

| 文件 | 内容 |
|---|---|
| `gameConfig.ts` | `GAME_CONFIG`：设计尺寸、棋盘参数、猫咪定义引用、网络地址、美术资源路径、字体 |
| `catDefinitions.ts` | `CAT_DEFINITIONS`：12 级猫咪的名称/描述/默认资源 |
| `constants.ts` | 基础数值常量（生成概率、复活移除数量等） |
| `gameRules.ts` | 规则函数（`scoreForLevel` 得分公式、`rollSpawnLevel` 生成等级、`REVIVE_REMOVE_COUNT`） |
| `index.ts` | 配置中心统一出口 |

引入配置统一从 `core/config`（或其 index）导入，不要在业务代码中硬编码游戏数值。

### 网络地址

排行榜服务地址在 `GAME_CONFIG.network.leaderboardBaseUrl`（`core/config/gameConfig.ts`），
接入新环境时只需修改此处。

### `env.json`（根目录）

用途：**美术生成工具** `skills/generate-kitchen-game-art` 的配置，包含 `model` / `baseUrl` / `key`。

> ⚠️ 安全提醒：其中 `key` 为 API 密钥且已提交到 git。若仓库对外可见，请立即更换密钥，
> 并考虑将 `env.json` 加入 `.gitignore`（该工具在缺少配置时会提示如何设置）。

### 服务端配置

后端使用 `.env`（参考 `packages/server/.env.example`），包含数据库连接、微信登录密钥、JWT 密钥等。

## 代码规范

### 分层架构（依赖规则）

```
ui (UI层: screens/components/panels/styles/utils)
    ↓ 可导入
features (业务功能: economy/tasks/leaderboard/storage)
    ↓ 可导入
core (游戏引擎: Board/Game2048/config)
```

- `core/` 禁止导入 `features/`、`ui/`、`infrastructure/`
- `features/` 禁止导入 `ui/`
- `infrastructure/` 只放自包含的平台能力（Haptic、微信分享）
- 现有代码已符合该规则（tsc 无跨层错误）

### 其他规范

- TypeScript 严格模式（`strict: true`）
- 业务代码禁止硬编码游戏数值，从 `core/config` 导入
- 提交规范：Conventional Commits（`feat/fix/docs/refactor/test/chore: 描述`）
- 提交前运行 `cd packages/game && npm run verify`
