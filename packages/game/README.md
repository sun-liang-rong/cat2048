# 猫咪 2048（Cocos Creator 3.8.8）

完整的猫咪 2048 微信小游戏客户端：主页、经典 4×4 猫咪 2048 与每日挑战模式、12 级猫咪进化、
4 种道具（撤回/消除/刷新/洗牌）、金币经济与装饰品商店（皮肤/背景/特效）、每日任务与签到、
图鉴收集、排行榜联网同步、微信首页分享与结算/复活分享卡片，以及本地持久化与自动存档续玩。

## 开发

环境要求：Node.js 20+、Python 3.9+（安装 Pillow）和 Cocos Creator 3.8.8。
仓库根目录的 `.nvmrc` 可用于切换到推荐的 Node 版本。

1. 使用 Cocos Dashboard 导入本目录，编辑器版本选择 3.8.8。
2. 首次打开后等待 Cocos 导入素材并生成 `temp/`。
3. 打开 `assets/main.scene`，将其设为启动场景，然后使用浏览器预览。
4. 微信小游戏构建时选择竖屏；排行榜联调需要配置微信登录和后端地址。
5. 微信小游戏构建时关闭普通 `useSplashScreen` 和 `wechatgame.separateEngine`，保留
   Cocos 微信首屏作为第一阶段加载页。原生首屏结束后，游戏会显示黑底项目加载页，
   持续展示 logo 和 `resources/game` 的实际加载进度，资源全部加载完成后才进入首页。

## 命令

```bash
npm install
npm run typecheck:core
npm test
npm run verify
```

## 排行榜联调

后端位于仓库的 `packages/server/`，先在 `packages/server/.env` 配置 MySQL、微信小程序
AppID/AppSecret 和 JWT 密钥，再运行：

```bash
cd ../server
npm install
npm run prisma:deploy
npm run start:dev
```

将 `assets/scripts/core/config/gameConfig.ts` 中的 `leaderboardBaseUrl` 设置为可从当前运行环境访问的 NestJS 服务地址。微信小游戏正式构建还需要把该地址配置为合法的 request 域名并使用 HTTPS；未配置地址时游戏仍可正常游玩，成绩会保存在本地待重试队列中。

运行时资源已提交在 `assets/resources/game/`，并按资源类型和主题整理。可选的 `prepare:assets` 命令需要仓库根目录下的美术源文件；本次精简后该源文件目录不包含在当前工作区。

## 操作与规则

- 手机或浏览器：在棋盘内向上、下、左、右滑动。
- 桌面调试：方向键或 WASD。
- 每次有效移动后随机生成一只猫；90% 为 Lv1，10% 为 Lv2。
- 同等级猫咪合并升级并得分（合并得分 = 2^等级），Lv12 为最终等级。
- 道具：每局最多使用 2 次道具（不限种类组合），每种道具每局限 1 次：
  - 撤回一步：撤销最近一次有效移动（回退棋盘与分数）。
  - 消除猫咪：移除 1 只等级最低的猫咪（目标自动选取，选择交互为 TODO）。
  - 刷新 / 洗牌：逻辑已在核心层实现，对局道具栏暂只挂载撤回与消除。
- 游戏结束时结算金币奖励（与最高等级相关，上限 150），可撤回/消除救援或分享复活。
