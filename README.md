# 猫咪2048 项目

一款基于 Cocos Creator 3.8.8 开发的微信小游戏，实现经典 2048 玩法的猫咪主题变体。支持猫咪进化、每日任务、商店装扮、排行榜、每日奖励等系统，后端基于 NestJS + Prisma。

## 📚 文档导航

- [产品需求文档 (PRD)](./docs/PRD.md)
- [项目架构文档](./docs/ARCHITECTURE.md)
- [项目重整计划](./PROJECT_REFACTOR_PLAN.md)
- [历史文档归档](./docs/archive/)

## 🚀 快速开始

### 环境要求

- Node.js 20+
- Python 3.9+（资源处理需要）
- Cocos Creator 3.8.8
- MySQL 8.0（开发后端时）

### 安装依赖

```bash
# 游戏项目
cd game
npm install

# 后端服务
cd server
npm install
```

### 运行游戏

1. 用 Cocos Creator 3.8.8 打开 `packages/game/` 目录
2. 打开 `assets/main.scene`
3. 点击预览按钮运行游戏

### 运行后端

```bash
cd packages/server
cp .env.example .env   # 配置环境变量
npm run prisma:deploy
npm run start:dev
```

## 📁 项目结构

```
cat2048/
├── docs/              # 📚 文档中心
│   ├── PRD.md         # 产品需求文档
│   ├── ARCHITECTURE.md # 架构设计文档（以当前实现为准）
│   ├── API.md         # 后端接口文档
│   ├── DEVELOPMENT.md # 开发指南
│   └── archive/       # 历史文档归档
├── packages/          # 📦 项目包（monorepo 结构）
│   ├── game/          # 🎮 Cocos Creator 游戏项目
│   ├── server/        # 🔧 NestJS 后端服务
│   └── shared/        # 🔗 前后端共享代码（占位）
├── scripts/           # 🛠️ 开发脚本（资源处理/构建）
└── skills/            # 美术生成技能
```

## 🧪 测试

```bash
# 游戏项目测试（类型检查 + 单测）
cd packages/game
npm run verify

# 后端测试
cd packages/server
npm test
npm run test:e2e
```

## 📦 构建（微信小游戏）

1. 用 Cocos Creator 打开游戏项目
2. 项目 → 构建发布 → 微信小游戏
3. 运行构建后脚本：

```bash
cd packages/game
npm run customize:wechat-loading
npm run verify:wechat-build
```

4. 用微信开发者工具打开 `packages/game/build/wechatgame`

## 🤝 贡献指南

1. 提交前运行 `cd packages/game && npm run verify` 确保代码质量
2. 遵循提交规范：`feat/fix/docs/refactor/test/chore: 描述`
3. 大型改动先创建 Issue 讨论

## 📄 许可证

Private - All Rights Reserved
