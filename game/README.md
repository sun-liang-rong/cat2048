# 猫咪 2048（Cocos Creator 3.8.8）

这是首个可玩垂直切片，包含主页、经典 4×4 猫咪 2048、分数与最高分、滑动和键盘操作、
移动/合并/出生反馈、单手友好的下置棋盘、撤回与消除道具、重新开始与返回确认、
游戏结束弹窗、音效开关以及本地持久化。

## 开发

环境要求：Node.js 20+、Python 3.9+（安装 Pillow）和 Cocos Creator 3.8.8。
仓库根目录的 `.nvmrc` 可用于切换到推荐的 Node 版本。

1. 使用 Cocos Dashboard 导入本目录 `game/`，编辑器版本选择 3.8.8。
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

后端位于仓库根目录的 `server/`，先在 `server/.env` 配置 MySQL、微信小程序 AppID/AppSecret 和 JWT 密钥，再运行：

```bash
cd ../server
npm install
npm run prisma:deploy
npm run start:dev
```

将 `assets/scripts/infrastructure/gameConfig.ts` 中的 `leaderboardBaseUrl` 设置为可从当前运行环境访问的 NestJS 服务地址。微信小游戏正式构建还需要把该地址配置为合法的 request 域名并使用 HTTPS；未配置地址时游戏仍可正常游玩，成绩会保存在本地待重试队列中。

运行时资源已提交在 `assets/resources/game/`，并按资源类型和主题整理。可选的 `prepare:assets` 命令需要仓库根目录下的美术源文件；本次精简后该源文件目录不包含在当前工作区。

## 操作

- 手机或浏览器：在棋盘内向上、下、左、右滑动。
- 桌面调试：方向键或 WASD。
- 每次有效移动后随机生成一只猫；90% 为 Lv1，10% 为 Lv2。
- 同等级猫咪合并升级，Lv12 为最终等级。
- 每局可以撤回最近一次有效移动 1 次。
- 每局可以按等级和棋盘顺序消除最多 3 只最低等级猫咪 1 次。
