# 猫咪2048 项目重整优化方案

## 一、当前项目问题诊断

### 1.1 文件组织混乱
**问题表现**:
- 根目录堆积过多文档文件（7个MD文档散落在根目录）
- 文档命名不规范（`doc.md`、`P0_FIX_COMPLETED.md`、`P1_ERROR_FIX.md` 等临时性文档）
- Python工具脚本和测试文件混在 `tools/` 目录
- 美术资源 `assets/` 与游戏项目 `game/assets/` 分离，容易混淆
- 配置文件散落（`.env`, `env.json` 同时存在）

**影响**:
- 新成员无法快速找到关键文档
- 版本控制历史混乱
- 部署和CI配置困难

### 1.2 代码结构待优化
**问题表现**:
- `game/assets/scripts/` 虽有分层（core/presentation/infrastructure），但缺少明确的依赖规则
- `presentation/` 层文件过多（30+个TS文件），缺少二级分类
- 部分UI组件职责不清（如 `HomeView.ts` 392行，过于庞大）
- 测试文件放在 `game/tests/` 但不与源码邻近
- 缺少统一的常量和枚举管理

**影响**:
- 模块间依赖关系不清晰
- 代码复用困难
- 单元测试编写和维护成本高

### 1.3 配置管理不统一
**问题表现**:
- 游戏配置散落在多个文件（`gameConfig.ts`, `catalog.ts`, `dailyTasks.ts`）
- 服务端配置使用 `.env` 但前端配置硬编码在代码中
- 缺少环境区分（开发/测试/生产）
- `env.json` 用途不明确

**影响**:
- 配置修改需要改多处代码
- 不同环境部署困难
- 容易出现配置遗漏或错误

### 1.4 文档系统不完善
**问题表现**:
- PRD（`doc.md`）与实现文档（`PROJECT_OVERVIEW.md`）信息重复
- 优化记录文档（`P0_FIX_COMPLETED.md` 等）应该是临时文档，不应长期保留在根目录
- 缺少 API 文档、架构设计文档
- `README.md` 过于简单，不适合新人上手

**影响**:
- 团队协作效率低
- 知识传承困难
- 技术债务积累

### 1.5 依赖和构建管理
**问题表现**:
- 服务端 `node_modules` 体积达440MB
- 游戏项目包含大量Cocos编辑器生成文件（`library/`, `temp/`）
- 缺少统一的 monorepo 管理工具
- Python脚本缺少虚拟环境管理

**影响**:
- 仓库体积过大
- 安装和构建时间长
- 跨平台开发困难

---

## 二、重整优化方案

### 2.1 目录结构重组

#### 2.1.1 推荐的新目录结构
```
cat2048/
├── docs/                           # 📚 统一文档中心
│   ├── README.md                   # 项目总览（替换根README）
│   ├── PRD.md                      # 产品需求文档（重命名自doc.md）
│   ├── ARCHITECTURE.md             # 架构设计文档
│   ├── API.md                      # 后端API文档
│   ├── DEVELOPMENT.md              # 开发指南
│   ├── DEPLOYMENT.md               # 部署文档
│   ├── CHANGELOG.md                # 版本变更日志
│   └── archive/                    # 历史文档归档
│       ├── P0_FIX_COMPLETED.md
│       ├── P1_ERROR_FIX.md
│       └── home_redesign_notes.md
│
├── packages/                       # 📦 Monorepo 包管理
│   ├── game/                       # Cocos Creator游戏项目
│   │   ├── assets/
│   │   │   ├── scenes/             # 场景文件
│   │   │   │   └── main.scene
│   │   │   ├── scripts/
│   │   │   │   ├── core/           # 核心游戏逻辑
│   │   │   │   │   ├── game/      # 游戏主控制
│   │   │   │   │   │   ├── Game2048.ts
│   │   │   │   │   │   ├── Board.ts
│   │   │   │   │   │   └── types.ts
│   │   │   │   │   └── config/    # 配置常量
│   │   │   │   │       ├── constants.ts
│   │   │   │   │       ├── gameRules.ts
│   │   │   │   │       └── index.ts
│   │   │   │   │
│   │   │   │   ├── features/      # 功能模块（替代原infrastructure）
│   │   │   │   │   ├── economy/   # 经济系统
│   │   │   │   │   │   ├── economy.ts
│   │   │   │   │   │   ├── catalog.ts
│   │   │   │   │   │   └── economyApi.ts
│   │   │   │   │   ├── tasks/     # 任务系统
│   │   │   │   │   │   └── dailyTasks.ts
│   │   │   │   │   ├── collection/ # 图鉴系统
│   │   │   │   │   ├── leaderboard/ # 排行榜
│   │   │   │   │   └── storage/   # 本地存储
│   │   │   │   │       └── storage.ts
│   │   │   │   │
│   │   │   │   ├── ui/            # UI层（替代原presentation）
│   │   │   │   │   ├── screens/   # 页面级组件
│   │   │   │   │   │   ├── GameScreen.ts
│   │   │   │   │   │   ├── HomeView.ts (拆分)
│   │   │   │   │   │   ├── SettingsScreen.ts
│   │   │   │   │   │   └── CollectionScreen.ts
│   │   │   │   │   ├── components/ # 通用UI组件
│   │   │   │   │   │   ├── BoardView.ts
│   │   │   │   │   │   ├── ModalView.ts
│   │   │   │   │   │   ├── ItemBarView.ts
│   │   │   │   │   │   └── navigation/
│   │   │   │   │   │       └── ModernNavDock.ts
│   │   │   │   │   ├── panels/    # 弹窗面板
│   │   │   │   │   │   ├── ShopView.ts
│   │   │   │   │   │   ├── TaskPanelView.ts
│   │   │   │   │   │   ├── DailyRewardView.ts
│   │   │   │   │   │   └── LeaderboardView.ts
│   │   │   │   │   ├── styles/    # 样式定义
│   │   │   │   │   │   ├── homeStyles.ts
│   │   │   │   │   │   └── layout.ts
│   │   │   │   │   └── utils/     # UI工具
│   │   │   │   │       ├── tweenAsync.ts
│   │   │   │   │       └── uiFactory.ts
│   │   │   │   │
│   │   │   │   ├── services/      # 外部服务交互
│   │   │   │   │   ├── wechat/    # 微信API封装
│   │   │   │   │   │   ├── login.ts
│   │   │   │   │   │   ├── share.ts
│   │   │   │   │   │   └── ad.ts
│   │   │   │   │   └── http/      # HTTP客户端
│   │   │   │   │
│   │   │   │   └── shared/        # 共享工具
│   │   │   │       ├── types.ts   # 全局类型定义
│   │   │   │       ├── events.ts  # 事件总线
│   │   │   │       └── utils.ts   # 工具函数
│   │   │   │
│   │   │   └── resources/         # 游戏资源
│   │   │       └── game/
│   │   │           ├── cats/
│   │   │           ├── backgrounds/
│   │   │           ├── ui/
│   │   │           └── audio/
│   │   │
│   │   ├── tests/                 # 测试文件
│   │   │   ├── unit/              # 单元测试
│   │   │   │   ├── core/
│   │   │   │   └── features/
│   │   │   └── integration/       # 集成测试
│   │   │
│   │   ├── config/                # 环境配置
│   │   │   ├── development.json
│   │   │   ├── staging.json
│   │   │   └── production.json
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── README.md
│   │
│   ├── server/                    # NestJS后端服务
│   │   ├── src/
│   │   │   ├── modules/           # 功能模块
│   │   │   │   ├── auth/
│   │   │   │   ├── players/
│   │   │   │   ├── leaderboard/
│   │   │   │   └── admin/         # （新增）管理后台
│   │   │   ├── common/            # 共享代码
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── decorators/
│   │   │   ├── config/
│   │   │   └── prisma/
│   │   ├── test/
│   │   ├── prisma/
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── shared/                    # （新增）前后端共享代码
│       ├── types/                 # 共享类型定义
│       │   ├── api.types.ts
│       │   ├── game.types.ts
│       │   └── index.ts
│       ├── constants/             # 共享常量
│       └── package.json
│
├── scripts/                       # 🛠️ 开发脚本（替代tools）
│   ├── build/                     # 构建相关
│   │   ├── customize_wechat_loading.mjs
│   │   └── verify_wechat_build.mjs
│   ├── assets/                    # 资源处理
│   │   ├── prepare_runtime_assets.py
│   │   ├── compress_game_images.py
│   │   ├── pack_sprite_sheet.py
│   │   └── slice_cat_sprite_sheets.py
│   ├── tests/                     # 脚本测试
│   │   ├── test_compress_game_images.py
│   │   └── test_slice_cat_sprite_sheets.py
│   ├── requirements.txt           # Python依赖
│   └── README.md                  # 脚本使用说明
│
├── resources/                     # 🎨 美术源文件（替代assets）
│   ├── cats/                      # 猫咪原画
│   ├── ui/                        # UI设计稿
│   └── README.md                  # 资源规范说明
│
├── .github/                       # CI/CD配置
│   └── workflows/
│       ├── game-ci.yml
│       └── server-ci.yml
│
├── .vscode/                       # 编辑器配置
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
│
├── .gitignore
├── .nvmrc
├── package.json                   # Root workspace配置
├── pnpm-workspace.yaml           # （可选）PNPM workspace
├── turbo.json                    # （可选）Turborepo配置
└── README.md                      # 项目入口文档
```

#### 2.1.2 迁移操作清单

**第一阶段：文档整理（低风险）**
```bash
# 1. 创建docs目录并迁移文档
mkdir -p docs/archive
mv doc.md docs/PRD.md
mv PROJECT_OVERVIEW.md docs/ARCHITECTURE.md
mv P0_FIX_COMPLETED.md P1_ERROR_FIX.md P1_OPTIMIZATION_COMPLETED.md docs/archive/
mv home_redesign_notes.md HOME_UI_OPTIMIZATION_ANALYSIS.md docs/archive/

# 2. 整理脚本目录
mv tools scripts
mkdir -p scripts/{build,assets,tests}
# 按功能分类移动脚本文件

# 3. 重命名美术资源目录
mv assets resources
```

**第二阶段：代码结构重组（中风险）**
```bash
# 1. 创建新的目录结构
cd game/assets/scripts
mkdir -p core/{game,config}
mkdir -p features/{economy,tasks,collection,leaderboard,storage}
mkdir -p ui/{screens,components,panels,styles,utils}
mkdir -p services/{wechat,http}
mkdir -p shared

# 2. 逐步迁移文件（保持git历史）
git mv core/Game2048.ts core/game/
git mv infrastructure/economy.ts features/economy/
git mv presentation/HomeView.ts ui/screens/
# ... 继续其他文件

# 3. 更新导入路径
# 使用IDE的全局替换或编写迁移脚本
```

**第三阶段：配置管理优化（中风险）**
```bash
# 1. 创建配置目录
mkdir -p game/config
# 创建环境配置文件模板
# 修改代码使用配置文件而非硬编码
```

---

### 2.2 代码架构优化

#### 2.2.1 分层架构规范

**依赖规则**:
```
ui (presentation)
    ↓ 可调用
features (domain/business logic)
    ↓ 可调用
core (game engine)
    ↓ 可调用
shared (utilities)
```

**禁止反向依赖**: 
- `core/` 不能导入 `features/` 或 `ui/`
- `features/` 不能导入 `ui/`
- 使用事件总线或依赖注入解耦

#### 2.2.2 大文件拆分计划

**HomeView.ts (392行) 拆分方案**:
```typescript
// 拆分成:
ui/screens/HomeScreen.ts          // 主屏幕控制器（150行）
ui/components/home/HomeHeader.ts   // 头部区域（60行）
ui/components/home/GameModeTabs.ts // 模式选择（80行）
ui/components/home/QuickActions.ts // 快捷按钮（50行）
ui/styles/homeStyles.ts            // 样式定义（已存在）
```

**LeaderboardView.ts (461行) 拆分方案**:
```typescript
// 拆分成:
ui/panels/LeaderboardPanel.ts          // 主面板（150行）
ui/components/leaderboard/RankList.ts  // 排行榜列表（120行）
ui/components/leaderboard/RankItem.ts  // 单个排名项（80行）
features/leaderboard/leaderboardApi.ts // API调用逻辑（80行）
```

#### 2.2.3 配置统一管理

**创建配置中心**:
```typescript
// game/assets/scripts/core/config/index.ts
export * from './constants';
export * from './gameRules';
export * from './catDefinitions';

// game/assets/scripts/core/config/constants.ts
export const GAME_CONFIG = {
  BOARD_SIZE: 4,
  MAX_LEVEL: 12,
  INITIAL_UNDO_COUNT: 1,
  INITIAL_REMOVE_COUNT: 1,
} as const;

export const SPAWN_PROBABILITIES = {
  LEVEL_1: 0.9,
  LEVEL_2: 0.1,
} as const;

export const SCORE_FORMULA = (level: number) => Math.pow(2, level);

// game/assets/scripts/core/config/gameRules.ts
export const MOVEMENT_RULES = {
  MERGE_CONDITION: 'SAME_LEVEL_SAME_BREED',
  SPAWN_AFTER_MOVE: true,
  GAME_OVER_CONDITION: 'NO_VALID_MOVES',
} as const;
```

**环境配置管理**:
```typescript
// game/config/base.json
{
  "game": {
    "boardSize": 4,
    "maxLevel": 12
  },
  "api": {
    "timeout": 10000,
    "retryCount": 3
  }
}

// game/config/development.json
{
  "extends": "./base.json",
  "api": {
    "baseUrl": "http://localhost:3000",
    "enableMock": true
  },
  "debug": {
    "showFPS": true,
    "enableDevTools": true
  }
}

// game/config/production.json
{
  "extends": "./base.json",
  "api": {
    "baseUrl": "https://hongshu.sale/wx_server",
    "enableMock": false
  },
  "debug": {
    "showFPS": false,
    "enableDevTools": false
  }
}
```

---

### 2.3 依赖管理优化

#### 2.3.1 Monorepo 方案选择

**推荐使用 PNPM Workspaces**:

**优势**:
- 节省磁盘空间（硬链接共享依赖）
- 快速安装
- 严格的依赖隔离
- 与现有npm生态兼容

**配置示例**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'scripts'
```

```json
// package.json (root)
{
  "name": "cat2048-workspace",
  "private": true,
  "scripts": {
    "install:all": "pnpm install",
    "build:game": "pnpm --filter @cat2048/game build",
    "build:server": "pnpm --filter @cat2048/server build",
    "test:all": "pnpm -r test",
    "typecheck:all": "pnpm -r typecheck"
  },
  "devDependencies": {
    "pnpm": "^9.0.0",
    "turbo": "^2.0.0"
  }
}
```

```json
// packages/game/package.json
{
  "name": "@cat2048/game",
  "version": "1.0.0",
  "dependencies": {
    "@cat2048/shared": "workspace:*"
  }
}
```

#### 2.3.2 Python 环境管理

**使用 Poetry 管理依赖**:
```toml
# scripts/pyproject.toml
[tool.poetry]
name = "cat2048-scripts"
version = "1.0.0"
description = "Asset processing scripts"

[tool.poetry.dependencies]
python = "^3.9"
Pillow = "^10.0.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0.0"
black = "^23.0.0"
```

---

### 2.4 文档体系完善

#### 2.4.1 新建文档清单

**docs/README.md** (项目总览):
```markdown
# 猫咪2048 项目文档

## 快速开始
- [开发环境搭建](./DEVELOPMENT.md#环境准备)
- [运行游戏](./DEVELOPMENT.md#本地运行)
- [部署指南](./DEPLOYMENT.md)

## 核心文档
- [产品需求文档 (PRD)](./PRD.md)
- [架构设计](./ARCHITECTURE.md)
- [API文档](./API.md)

## 开发指南
- [代码规范](./DEVELOPMENT.md#代码规范)
- [提交规范](./DEVELOPMENT.md#Git提交规范)
- [测试指南](./DEVELOPMENT.md#测试)
```

**docs/ARCHITECTURE.md** (架构设计):
```markdown
# 架构设计文档

## 技术栈
### 前端
- Cocos Creator 3.8.8
- TypeScript 5.7
- Vitest

### 后端
- NestJS 10.4
- Prisma ORM
- MySQL 8.0

## 分层架构
[架构图]

## 模块划分
### Core层
- 职责：2048游戏核心算法
- 依赖：无外部依赖
- 关键模块：Game2048, Board

### Features层
- 职责：业务功能模块
- 依赖：Core, Shared
- 模块：Economy, Tasks, Collection, Leaderboard

### UI层
- 职责：用户界面
- 依赖：Features, Core
- 模块：Screens, Components, Panels

## 数据流
[数据流图]
```

**docs/API.md** (API文档):
```markdown
# API 文档

## 认证
### POST /auth/wechat/login
微信小程序登录

**请求体**:
```json
{
  "code": "string",
  "nickname": "string",
  "avatarUrl": "string"
}
```

**响应**:
```json
{
  "accessToken": "string",
  "playerId": "string"
}
```

## 排行榜
### GET /leaderboard
获取排行榜

**查询参数**:
- `mode`: 'friends' | 'global'
- `limit`: number (default: 50)

...
```

**docs/DEVELOPMENT.md** (开发指南):
```markdown
# 开发指南

## 环境准备
### 必需软件
- Node.js 20+ (推荐使用nvm)
- Python 3.9+ (推荐使用pyenv)
- Cocos Creator 3.8.8
- MySQL 8.0 (开发后端时)

### 安装依赖
```bash
# 使用pnpm安装所有依赖
pnpm install

# 或分别安装
cd packages/game && npm install
cd packages/server && npm install
cd scripts && poetry install
```

## 代码规范
### TypeScript
- 使用ESLint + Prettier
- 遵循Airbnb风格指南
- 严格模式：`strict: true`

### 命名规范
- 文件名：PascalCase.ts (组件) 或 camelCase.ts (工具)
- 类名：PascalCase
- 函数/变量：camelCase
- 常量：UPPER_SNAKE_CASE
- 私有成员：_camelCase

### Git提交规范
使用Conventional Commits:
```
feat: 新功能
fix: 修复bug
docs: 文档更新
refactor: 重构
test: 测试相关
chore: 构建/工具配置
```

## 测试
### 运行测试
```bash
# 游戏项目测试
cd packages/game
npm test

# 后端测试
cd packages/server
npm test
npm run test:e2e
```

### 测试覆盖率要求
- 核心逻辑（core/）: 90%+
- 业务逻辑（features/）: 80%+
- UI层（ui/）: 60%+
```

**docs/DEPLOYMENT.md** (部署文档):
```markdown
# 部署指南

## 游戏前端部署
### 构建微信小游戏
1. 用Cocos Creator打开 `packages/game`
2. 项目 -> 构建发布
3. 平台：微信小游戏
4. 构建路径：`packages/game/build/wechatgame`
5. 运行构建后脚本：
   ```bash
   npm run customize:wechat-loading
   npm run verify:wechat-build
   ```
6. 用微信开发者工具打开构建目录
7. 上传代码

### 环境变量配置
编辑 `packages/game/config/production.json`:
```json
{
  "api": {
    "baseUrl": "https://your-domain.com/api"
  }
}
```

## 后端部署
### Docker部署（推荐）
```bash
cd packages/server
docker build -t cat2048-server .
docker run -p 3000:3000 --env-file .env cat2048-server
```

### PM2部署
```bash
cd packages/server
npm run build
pm2 start ecosystem.config.js
```

### 数据库迁移
```bash
npm run prisma:deploy
```
```

#### 2.4.2 文档维护规则

1. **文档与代码同步更新**: 代码改动必须更新相关文档
2. **PR必须包含文档**: 新功能PR必须包含文档更新
3. **定期文档审查**: 每个Sprint结束时审查文档准确性
4. **过期文档归档**: 将过时文档移至 `docs/archive/`

---

### 2.5 开发工作流优化

#### 2.5.1 Git工作流规范

**分支策略**:
```
main (生产)
  ├── develop (开发主分支)
  │   ├── feature/xxx (功能分支)
  │   ├── fix/xxx (修复分支)
  │   └── refactor/xxx (重构分支)
  └── hotfix/xxx (紧急修复)
```

**提交信息模板**:
```
<type>(<scope>): <subject>

<body>

<footer>

# 示例:
feat(game): 添加每日任务系统

- 实现4个每日任务类型
- 添加任务进度追踪
- 完成任务奖励发放逻辑

Closes #123
```

#### 2.5.2 CI/CD配置

**GitHub Actions 示例**:
```yaml
# .github/workflows/game-ci.yml
name: Game CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'packages/game/**'
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm --filter @cat2048/game typecheck
      - run: pnpm --filter @cat2048/game test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm --filter @cat2048/game lint
```

#### 2.5.3 开发环境配置

**.vscode/settings.json**:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/temp": true,
    "**/library": true,
    "**/.DS_Store": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true
  }
}
```

**.vscode/extensions.json**:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-python.python",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma"
  ]
}
```

---

## 三、实施路线图

### 阶段一：文档和目录整理（1-2天）
**目标**: 清理根目录，建立文档体系

- [ ] 创建 `docs/` 目录结构
- [ ] 迁移和重命名现有文档
- [ ] 编写新的核心文档（README, ARCHITECTURE, DEVELOPMENT）
- [ ] 整理 `scripts/` 目录
- [ ] 重命名 `assets/` 为 `resources/`
- [ ] 更新 `.gitignore`

**验收标准**:
- 根目录只保留必要的配置文件和README
- 所有文档有明确分类
- 新人能通过README快速上手

### 阶段二：代码结构重组（3-5天）
**目标**: 优化代码分层，提高可维护性

- [ ] 创建新的目录结构
- [ ] 按功能模块迁移文件（保持git历史）
- [ ] 更新所有import路径
- [ ] 配置TypeScript路径别名
- [ ] 运行测试确保功能正常
- [ ] 拆分大文件（HomeView, LeaderboardView等）

**验收标准**:
- 所有测试通过
- 代码能正常构建和运行
- 分层职责清晰，无循环依赖

### 阶段三：配置管理优化（2-3天）
**目标**: 统一配置管理，支持多环境

- [ ] 创建配置中心模块
- [ ] 提取硬编码常量到配置文件
- [ ] 创建环境配置文件（dev/staging/prod）
- [ ] 实现配置加载逻辑
- [ ] 更新代码使用新配置系统
- [ ] 文档化配置项

**验收标准**:
- 无硬编码的配置值
- 可通过配置文件切换环境
- 配置项有完整文档

### 阶段四：依赖管理升级（2-3天）
**目标**: 优化依赖管理，加快安装和构建

- [ ] 安装并配置PNPM
- [ ] 创建workspace配置
- [ ] 迁移现有package.json
- [ ] 创建共享包 `@cat2048/shared`
- [ ] 配置Python Poetry
- [ ] 清理未使用的依赖

**验收标准**:
- 依赖安装时间减少50%+
- 磁盘占用减少30%+
- monorepo命令正常工作

### 阶段五：工具链完善（2-3天）
**目标**: 提升开发体验和代码质量

- [ ] 配置ESLint + Prettier
- [ ] 配置Husky + lint-staged（Git钩子）
- [ ] 编写commit-msg验证
- [ ] 配置CI/CD流程
- [ ] 添加代码覆盖率报告
- [ ] 配置VSCode工作区

**验收标准**:
- 代码提交自动格式化和检查
- CI自动运行测试
- 团队成员IDE配置一致

### 阶段六：测试补充（持续）
**目标**: 提高测试覆盖率

- [ ] 为核心模块补充单元测试（目标90%）
- [ ] 为业务模块补充单元测试（目标80%）
- [ ] 添加集成测试
- [ ] 添加E2E测试（可选）

---

## 四、风险控制

### 4.1 迁移风险
**风险**: 大规模文件移动可能导致功能异常

**应对措施**:
1. 使用 `git mv` 保持文件历史
2. 分阶段迁移，每阶段都运行完整测试
3. 在feature分支进行，充分测试后再合并
4. 保留原目录结构的备份分支

### 4.2 团队协作风险
**风险**: 重构期间团队开发冲突

**应对措施**:
1. 重构前冻结新特性开发
2. 通知团队重构时间窗口
3. 提供迁移指南和脚本
4. 组织代码审查会议

### 4.3 回退策略
**风险**: 重构失败需要回退

**应对措施**:
1. 在Git标签标记重构前状态
2. 每个阶段完成后创建里程碑分支
3. 准备回退脚本
4. 保留旧配置文件1-2个版本

---

## 五、收益评估

### 5.1 短期收益（1-2周内）
- ✅ 根目录清爽，文档易查找
- ✅ 代码分层清晰，降低理解成本
- ✅ 配置统一管理，环境切换方便

### 5.2 中期收益（1-2个月）
- ✅ 新功能开发效率提升30%
- ✅ Bug修复时间缩短40%
- ✅ 代码审查效率提升50%
- ✅ 新成员上手时间减少50%

### 5.3 长期收益（3个月+）
- ✅ 技术债务显著降低
- ✅ 测试覆盖率达标，回归测试可靠
- ✅ 支持团队扩展（5人以上）
- ✅ 代码可复用性提升，支持多端扩展

---

## 六、后续优化方向

### 6.1 技术优化
1. **性能监控**: 接入性能分析工具（如Sentry）
2. **错误追踪**: 完善错误日志和用户反馈系统
3. **热更新**: 实现游戏内容热更新能力
4. **自动化测试**: E2E测试覆盖关键流程

### 6.2 流程优化
1. **自动化部署**: 一键部署到多个环境
2. **文档自动生成**: API文档自动生成
3. **依赖安全扫描**: 定期检查依赖漏洞
4. **代码质量监控**: 集成SonarQube等工具

### 6.3 团队协作
1. **代码Review清单**: 制定Review标准
2. **技术分享**: 定期技术分享会
3. **架构决策记录**: 记录重要架构决策（ADR）
4. **知识库建设**: 搭建团队Wiki

---

## 附录

### A. 迁移脚本示例

**文件批量迁移脚本** (migrate-files.sh):
```bash
#!/bin/bash
set -e

echo "开始迁移文件..."

# 迁移文档
echo "迁移文档..."
mkdir -p docs/archive
git mv doc.md docs/PRD.md
git mv PROJECT_OVERVIEW.md docs/ARCHITECTURE.md
git mv P0_FIX_COMPLETED.md docs/archive/
git mv P1_ERROR_FIX.md docs/archive/
git mv P1_OPTIMIZATION_COMPLETED.md docs/archive/
git mv home_redesign_notes.md docs/archive/
git mv HOME_UI_OPTIMIZATION_ANALYSIS.md docs/archive/

# 迁移脚本
echo "迁移脚本..."
git mv tools scripts
mkdir -p scripts/{build,assets,tests}
git mv scripts/customize_wechat_loading.mjs scripts/build/
git mv scripts/verify_wechat_build.mjs scripts/build/
# ... 其他脚本

# 迁移资源
echo "迁移美术资源..."
git mv assets resources

echo "迁移完成！请运行测试验证功能正常。"
```

**路径更新脚本** (update-imports.js):
```javascript
const fs = require('fs');
const path = require('path');

const pathMappings = {
  'infrastructure/economy': 'features/economy',
  'infrastructure/dailyTasks': 'features/tasks/dailyTasks',
  'presentation/GameScreen': 'ui/screens/GameScreen',
  // ... 更多映射
};

function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let updated = false;
  
  for (const [oldPath, newPath] of Object.entries(pathMappings)) {
    const regex = new RegExp(`from ['"](.*)${oldPath}['"]`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `from '$1${newPath}'`);
      updated = true;
    }
  }
  
  if (updated) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
}

// 遍历所有TS文件并更新
// ... 实现目录遍历逻辑
```

### B. 配置文件模板

详见上文各配置示例。

### C. 检查清单

**重构完成检查清单**:
- [ ] 所有文件已迁移到新位置
- [ ] 所有import路径已更新
- [ ] 所有测试通过
- [ ] 游戏可正常运行
- [ ] 构建脚本正常工作
- [ ] 文档已更新
- [ ] CI/CD流程正常
- [ ] 团队成员已培训
- [ ] 旧分支已标记
- [ ] 部署流程已测试

---

**文档版本**: 1.0  
**创建日期**: 2025-01-XX  
**维护者**: 开发团队  
**审阅者**: 技术负责人
