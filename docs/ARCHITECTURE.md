# 猫咪2048 项目总览

> 本文以当前代码实现为准（2026-08 校对）。模块路径均相对 `packages/game/assets/scripts/`。

## 项目概述

基于 **Cocos Creator 3.8.8** 开发的微信小游戏，经典 2048 玩法的猫咪主题变体。已实现完整的核心玩法、道具系统、经济系统、每日任务与签到、每日挑战、图鉴收集、装饰品商店、排行榜联网同步，以及微信首页分享与结算/复活分享卡片。

## 技术栈

### 前端（游戏客户端）
- **游戏引擎**: Cocos Creator 3.8.8
- **开发语言**: TypeScript
- **目标平台**: 微信小游戏 + 浏览器预览
- **设计分辨率**: 750×1334（竖屏，运行时适配安全区）
- **环境要求**: Node.js 20+（`.nvmrc`）

### 后端（排行榜服务）
- **框架**: NestJS
- **数据库**: MySQL + Prisma ORM
- **认证**: 微信小程序登录 + JWT
- **部署地址**: https://hongshu.sale/wx_server

## 项目结构

```
cat2048/                                # npm monorepo（根 package.json 提供 verify 聚合命令）
├── packages/
│   ├── game/                          # Cocos Creator 游戏项目
│   │   ├── assets/
│   │   │   ├── main.scene             # 启动场景
│   │   │   ├── scripts/
│   │   │   │   ├── core/              # 纯游戏逻辑（引擎无关，可单测）
│   │   │   │   │   ├── Game2048.ts    # 对局主控制器（移动/道具/复活/存档）
│   │   │   │   │   ├── Board.ts       # 棋盘数据结构与移动算法
│   │   │   │   │   ├── types.ts       # 快照/结果类型定义
│   │   │   │   │   └── config/        # gameConfig / catDefinitions / constants / gameRules
│   │   │   │   ├── features/          # 领域服务层
│   │   │   │   │   ├── economy/       # economy.ts（金币/道具/购买/装备/广告获取）、catalog.ts（饰品目录）
│   │   │   │   │   ├── tasks/         # dailyTasks.ts（每日任务）
│   │   │   │   │   ├── gameplay/      # dailyChallenge.ts、collectionProgress.ts、runItems.ts
│   │   │   │   │   ├── leaderboard/   # leaderboard.ts、pendingQueue.ts（离线队列）、wechatTransport.ts
│   │   │   │   │   └── storage/       # storage.ts（SaveDataV3）、runSession.ts（对局会话）、validate.ts
│   │   │   │   ├── ui/                # 表现层（全部代码化构建 UI，无预制体）
│   │   │   │   │   ├── screens/       # Cat2048Boot（入口）、AppHost（导航）、HomeView、GameScreen、
│   │   │   │   │   │                  # ShopView、CollectionView、LeaderboardView、LoadingView、
│   │   │   │   │   │                  # GameFlowController（对局流程）
│   │   │   │   │   ├── controllers/   # EconomyPanelsController、LeaderboardController
│   │   │   │   │   ├── panels/        # ModalView、DailyRewardView、TaskPanelView、SettingsPanel、
│   │   │   │   │   │                  # GameOverDialogView、CatDetailModal、modalDecorations
│   │   │   │   │   ├── components/    # BoardView/TileView、ItemBarView、EvolutionPanelView、
│   │   │   │   │   │                  # GameStatsBarView、ModernNavDock、TutorialView、SwipeInput、
│   │   │   │   │   │                  # AudioController、CosmeticRuntime、shop/ leaderboard/ tasks/ 子目录
│   │   │   │   │   ├── utils/         # uiFactory、ArtRepository、resourceLoading、startupSequence 等
│   │   │   │   │   └── styles/        # layout、tokens、boardGeometry、fontPolicy 等
│   │   │   │   └── infrastructure/    # 平台能力：WechatShare、ResultShareController（分享卡片）、
│   │   │   │                          # HapticController、StartupMetrics
│   │   │   └── resources/game/        # 运行时资源：cats/ backgrounds/ ui/ effects/ audio/ fonts/
│   │   ├── tests/                     # vitest 单测（27 个文件，覆盖 core/features/UI 纯逻辑）
│   │   └── package.json               # verify = typecheck:core + vitest
│   ├── server/                        # NestJS 后端
│   │   ├── src/
│   │   │   ├── auth/                  # POST v1/auth/wechat（微信登录换 JWT）
│   │   │   ├── players/               # v1/players/me（玩家资料）
│   │   │   ├── leaderboard/           # POST v1/leaderboard/scores、scores/batch、GET v1/leaderboard
│   │   │   ├── prisma/                # Prisma Service
│   │   │   └── common/                # 全局异常过滤器
│   │   └── prisma/schema.prisma       # Player + ScoreSubmission（runId 幂等）
│   └── shared/                        # 占位
├── scripts/                           # 资源处理与构建脚本（Python/Node，见 scripts/README.md）
└── docs/                              # 文档中心（PRD/API/DEVELOPMENT/本文）
```

## 核心功能实现情况

### 1. 核心玩法
- **4×4 猫咪 2048**: 滑动合并，`MoveResult` 携带 motions/merges 记录驱动视图动画
- **12 级猫咪进化链**: Lv1 橘猫 → Lv12 创世极光猫（详见文末配置表）
- **计分**: 合并得分 = 2^等级（Lv1 合并得 2 分）
- **随机生成**: 90% Lv1 橘猫，10% Lv2 蓝白英短（`SPAWN_LEVEL_*_PROBABILITY`）
- **游戏结束**: 棋盘满且无可合并方向时触发，弹出结算弹窗
- **操作**: 触屏滑动（`SwipeInput`）+ 键盘方向键/WASD
- **运行模式**: `classic` 经典无尽 / `daily-challenge` 每日挑战（目标合成 Lv.5，进化条切换为挑战展示）

### 2. 道具系统（4 种道具）
| 道具 | 效果 | 每局限用 | 持有上限 | 每日广告获取上限 |
|------|------|---------|---------|----------------|
| undo 撤回一步 | 撤销最近一次有效移动（回退棋盘+分数） | 1 | 5 | 3 |
| erase 消除猫咪 | 移除 1 只等级最低的猫咪（目标选择为临时方案，暂取最低） | 1 | 2 | 1 |
| spawn 刷新 | 在随机空格生成 Lv1/Lv2 猫咪 | 1 | 3 | 3 |
| shuffle 洗牌 | 重排棋盘猫咪 | 1 | 2 | 2 |

- **每局总限制**: 每局最多使用 2 次道具（`ITEM_PER_GAME_MAX = 2`，不限种类组合）
- **对局内道具栏**: 经典模式挂载撤回 + 消除两个按钮（spawn/shuffle 逻辑已实现，UI 未挂载）
- **库存**: 金币/道具持久化在本地存档，对局消耗走 `economy.consumeItems`
- **游戏结束救援**: 结算弹窗提供「撤回一步 / 消除最低级猫咪」救援按钮（消耗对应库存）
- **已知差异**: 旧文档描述的"消除 3 只最低猫咪"已过时，当前实现只移除 1 只

### 3. 经济系统
- **猫爪金币**: 获取、消费、持久化（`features/economy/economy.ts`）
- **对局奖励**（`calculateRunReward`）: `min(150, max(5, floor(分数/100)) + 等级加成)`
  - 等级加成: 最高级 ≥Lv5 +10、≥Lv7 +20、≥Lv9 +50、≥Lv11 +35、≥Lv12 +35（叠加）
- **每日签到**（`calculateDailyReward`）: `min(100, 30 + 连续天数×10)`
- **装饰品商店**（`features/economy/catalog.ts`，共 12 件）:
  - 猫咪皮肤 ×6: 经典猫咪(0，默认) / 装扮猫咪(800) / 糖果派对(900) / 海洋奇遇(1000) / 梦幻花园(1500) / 极光星河(1800)
  - 棋盘背景 ×3: 木质猫窝(0，默认) / 粉色猫窝(250) / 星空猫窝(500)
  - 合成特效 ×3: 经典合成(0，默认) / 极光合成(300) / 星屑合成(600)
- **购买**: 商店点击「购买」直接扣款（无二次确认），按钮状态在 使用中/装备/购买 间流转
- **装备**: 皮肤/背景/特效即时生效并持久化（`CosmeticRuntime` 管理运行时换装）
- **广告获取道具**: `canGrantViaAd` / `grantViaAd` 已实现（含每日上限校验），等待前端接微信广告 SDK

### 4. 每日任务系统
- 4 项任务（`features/tasks/dailyTasks.ts`）:
  - 完成 3 局游戏（30 金币）
  - 单局合成 Lv.5 猫咪（30 金币）
  - 使用道具 2 次（20 金币）
  - 分享游戏 1 次（20 金币）
- 进度自动记录、跨天重置（本地日期）、完成后领取；首页任务入口有可领取角标

### 5. 图鉴系统
- 12 种猫咪收集进度（已解锁数/12）、未解锁显示剪影+锁
- 点击卡片弹出详情弹窗（大图、简介、合并得分；未解锁显示解锁提示）

### 6. 本地持久化与对局会话
- **存档** `SaveDataV3`（`features/storage/`）: 棋局、最高分、经济（金币/库存/已购/装备）、每日任务、图鉴、设置项；启动自动恢复
- **对局会话** `runSession.ts`: 对局中退出时自动保存（含 runId、模式、步数、合成数），首页显示「继续游戏」
- **数据校验** `validate.ts`: 读档时修复损坏数据

### 7. 排行榜（联网）
- 微信好友排行榜 + 后端排行（`features/leaderboard/`）
- 微信登录换 JWT（`POST v1/auth/wechat`）；成绩提交以 `(playerId, runId)` 幂等
- **离线队列** `pendingQueue.ts`: 网络异常时成绩本地暂存待重试；排行榜页有离线态与「重新连接」

### 8. 分享（已接入，非广告路径）
- **首页分享**: `infrastructure/WechatShare.ts` 通过 `wx.onShareAppMessage` 挂载原生菜单分享
- **结算分享**: `ResultShareController` 用 Canvas 生成成绩分享卡片（purpose: `score`）
- **分享复活**: 游戏结束弹窗「分享复活」→ 分享成功回调后 `game.revive()`（移除 2 只最低级猫咪）
- 分享行为会记录「分享 1 次」每日任务进度

### 9. UI/UX
- 代码化 UI（`uiFactory`），统一弹窗骨架（`ModalView`）、按压反馈、色板 token
- 首页场景立绘 + 底部导航坞（图鉴/商店/任务/设置）、新手引导（可跳过）
- 对局 HUD: 本局/最高分卡、进化路线条（或今日挑战）、步数/合成/空位统计条、道具栏
- 音效/音乐/震动三开关（设置面板），触感反馈（`HapticController`）
- 启动序列: 微信首屏 → 加载页（`LoadingView`）→ 首页；`StartupMetrics` 埋点启动耗时
- 竖屏设计，运行时适配安全区（刘海/胶囊）

### 🚧 部分实现/待完善

1. **广告系统**: `grantViaAd`/`canGrantViaAd` 接口就绪（含每日上限），微信激励视频 SDK 未接
2. **结算弹窗**: 功能完整；「新纪录」提示、救援/分享复活/再玩一局均已实现
3. **道具目标选择**: 消除道具暂自动选取最低级猫咪（代码注释标注 TODO）

### ❌ 未实现（PRD 提及）
- 图鉴 8 关闯关模式
- 成就系统、每周任务
- 头像框、棋盘格子底纹装饰
- 背景解锁条件（当前全部可直接购买）

## 核心模块说明

### core/Game2048.ts — 对局核心
```typescript
start(): BoardSnapshot                    // 开局（2 个初始猫咪）
move(direction): MoveResult               // 移动+合并+自动生成
undo(): UndoResult                        // 撤回（回退棋盘与分数，每局 1 次）
spawn(): SpawnResult                      // 刷新道具
shuffle(): ShuffleResult                  // 洗牌道具
erase(position): EraseResult              // 消除道具（移除指定格猫咪）
revive(): ReviveResult                    // 分享复活（移除 2 只最低级）
loadFixture(levels, score?): BoardSnapshot // 测试/关卡夹具
exportState() / restore(state)            // 对局存档
canUseItem(kind) / markItemUsed(kind)     // 局内道具限制（总数 2、每种 1）
```

### features/economy/economy.ts — 经济仓库
```typescript
claimDailyReward(): 签到（30 + 连续天数×10，上限 100）
settleRun(request): 对局结算奖励
grantCoins / grantItem / consumeItems
purchase(itemId) / equip(itemId)
canGrantViaAd(kind, today) / grantViaAd(kind)   // 广告获取道具（待接 SDK）
getItemCount(kind) / hasItem(kind)
```

### features/tasks/dailyTasks.ts — 每日任务
```typescript
recordEvent(kind, amount?)   // play-runs / reach-lv5 / use-items / share-once
claim(taskId)                // 领取奖励
snapshot()                   // 任务面板数据
```

### ui 层职责
- `Cat2048Boot`: Cocos 生命周期、Canvas/安全区、键盘、服务装配 → 注入 `AppHost`
- `AppHost`: 屏幕导航与宿主服务（lockInput、notice、分享等）
- `GameFlowController`: 对局全流程（滑动处理、道具、复活、结算、存档、新手引导）
- `EconomyPanelsController` / `LeaderboardController`: 商店/签到/任务/图鉴与排行榜的屏幕装配

### 后端接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/auth/wechat` | 微信 code 登录，换 JWT |
| GET  | `/v1/players/me` | 玩家资料（昵称/头像/最高分） |
| POST | `/v1/leaderboard/scores` | 提交单条成绩（runId 幂等） |
| POST | `/v1/leaderboard/scores/batch` | 批量补交离线成绩 |
| GET  | `/v1/leaderboard` | 查询排行榜 |

## 开发与构建

```bash
# 根目录聚合验证（游戏 + 后端）
npm run verify

# 游戏端
cd packages/game
npm run typecheck:core   # 核心逻辑类型检查
npm test                 # vitest（27 个测试文件）
npm run verify           # 类型检查 + 测试

# 后端
cd packages/server
npm test
```

微信构建：Cocos Creator 打开 `packages/game/` → 构建微信小游戏（竖屏）→
`npm run customize:wechat-loading` 定制首屏 → `npm run verify:wechat-build` 校验产物 →
微信开发者工具打开 `packages/game/build/wechatgame`。

## 与 PRD 的差异速览

| PRD 章节 | 状态 | 实现位置 |
|---------|------|---------|
| 3. 核心玩法/12 级进化/计分 | ✅ | `core/` |
| 4.1 经典模式 | ✅ | `ui/screens/GameScreen.ts` + `GameFlowController.ts` |
| 4.2 闯关模式 | ❌ 未实现 | — |
| 5. 道具系统 | ✅ 逻辑完整（4 种） | `core/Game2048.ts`、`ui/components/ItemBarView.ts` |
| 6. 经济系统 | ✅ | `features/economy/` |
| 7.1-7.2 图鉴 | ✅ | `ui/screens/CollectionView.ts`、`ui/panels/CatDetailModal.ts` |
| 7.3 背景皮肤 | ✅ 可购买装备（无解锁条件） | `features/economy/catalog.ts` |
| 7.4 成就 / 8.2 每周任务 | ❌ 未实现 | — |
| 8.1 每日任务 | ✅ | `features/tasks/dailyTasks.ts` |
| 9. 广告 | ⚠️ 仅缺 SDK 调用 | `economy.grantViaAd` 就绪 |
| 11. 微信接口 | ⚠️ 分享已接、广告未接、排行榜 ✅ | `infrastructure/WechatShare.ts`、`ResultShareController.ts` |

## 已知问题与技术债务（2026-08 预览实测）

1. **弹窗右上角关闭按钮疑似命中失效**: 猫咪详情弹窗与每日奖励弹窗的 × 在浏览器预览中精确点击无响应（任务面板同款按钮正常）。可疑点为 `ModalView` 关闭按钮与面板 `Mask`（GRAPHICS_STENCIL）的命中测试交互，需真机复测并代码排查。
2. **撤回不回退统计**: `GameFlowController.useUndoItem()` 恢复棋盘与分数，但 `movesCount`/`mergesCount` 未回退，撤回后统计条与分数不一致。
3. **消除道具与旧文档不一致**: 实现只移除 1 只最低级猫咪（目标选择 TODO），历史文档写"3 只"。
4. **重排版路径不解锁输入**: 弹窗被外部销毁（如屏幕重排版）时 `onClose` 不触发，`inputLocked` 保持 true，后续购买/领取会被静默拦截。
5. 广告 SDK 未集成；闯关模式未实现；UI 层自动化测试偏少（当前以纯逻辑单测为主）。

## 12 级猫咪配置

| 等级 | 品种名称 | 描述 | 合并得分 |
|------|----------|------|----------|
| Lv1 | 橘猫 | 爱晒太阳，也爱把棋盘占得满满当当。| 2 |
| Lv2 | 蓝白英短 | 圆脸短腿，认真守着每一次合成。| 4 |
| Lv3 | 三花猫 | 花色独一无二，运气也总是很好。| 8 |
| Lv4 | 布偶猫 | 温柔安静，像一团会呼吸的云。| 16 |
| Lv5 | 暹罗猫 | 好奇又健谈，什么动静都逃不过它。| 32 |
| Lv6 | 美短虎斑 | 精力十足，最擅长把局面重新盘活。| 64 |
| Lv7 | 奶牛猫 | 黑白分明，行动却永远出人意料。| 128 |
| Lv8 | 孟买黑猫 | 像一小片夜色，安静又神秘。| 256 |
| Lv9 | 银河极光猫 | 星光落在毛尖，开启通往星穹的进化。| 512 |
| Lv10 | 星穹守护猫 | 守护星河的光环，在每次合成中闪耀。| 1024 |
| Lv11 | 星环圣灵猫 | 星环环绕肩头，静静积蓄最后的光芒。| 2048 |
| Lv12 | 创世极光猫 | 万千极光汇于一身，完成猫咪的终极进化。| 4096 |

## 总结

**项目当前状态**: 功能完整的可玩版本。核心玩法、4 种道具、经济与商店（12 件饰品）、每日任务/签到/挑战、图鉴、排行榜、微信分享（首页 + 结算卡片 + 分享复活）均已实现并在浏览器预览中验证可运行。

**主要缺口**:
- 微信激励视频广告 SDK 对接（接口已就绪）
- 图鉴闯关模式
- 成就系统与每周任务（可选增强）

**架构评价**: 分层清晰——`core/`（纯逻辑，引擎无关）→ `features/`（领域服务）→ `ui/`（表现层，代码化构建）→ `infrastructure/`（平台能力）；核心逻辑与 UI 通过快照/结果类型解耦，27 个 vitest 文件覆盖纯逻辑层，利于迭代。
