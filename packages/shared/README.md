# @cat2048/shared

前后端共享代码包（占位）。

## 规划

计划包含：
- `types/` — 前后端共享类型定义（如排行榜条目、玩家摘要）
- `constants/` — 共享常量

## 接入方式（待定）

当前游戏（Cocos Creator）与后端（NestJS）尚未接入本包。接入方案：
- **后端**：通过 workspace 依赖（pnpm/npm workspaces）或 TypeScript path alias 引入
- **游戏**：Cocos 只编译 `assets/scripts`，需将共享类型以源码方式放置或构建为 JS 后放入 `node_modules`

> ⚠️ 接入会改动构建链路，属高影响变更，需单独验证（暂缓）。

## 约束

- 只放**纯类型与纯常量**，禁止运行时依赖（保持零依赖，便于两端引入）
