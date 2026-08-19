# 游戏界面视觉改造设计

## 目标

将 Cocos Creator 游戏对局界面重做为 `cat_merge_gameplay_interface/screen.png` 的视觉风格，仅修改界面样式和布局。保留全部游戏逻辑、存档、手势输入、分数更新、进化引导、撤回与消除最低猫道具行为。

## 页面结构

- 左上角保留返回行为，视觉资源使用 `assets/shangdian/01_back_button.png`。
- 顶部分别显示本局和最高分数，采用设计稿的木纹胶囊样式。
- 中部显示猫咪进化路线与图鉴进度，保留图鉴入口回调。
- 4x4 棋盘使用 `assets/youxi/grid_4x4.png` 作为底板，猫咪方块继续按实时棋盘状态渲染。
- 底部保留撤回和消除最低猫两项道具，使用 `button_paw.png` 与 `button_broom.png`，并保持剩余次数和补充状态。

## 资源映射

- `assets/youxi/grid_4x4.png`：棋盘背景。
- `assets/youxi/tile_yellow.png`：空位与方块视觉基底。
- `assets/youxi/instruction_panel.png`：进化路线面板。
- `assets/youxi/button_paw.png`：撤回道具按钮。
- `assets/youxi/button_broom.png`：消除最低猫道具按钮。
- `assets/youxi/board_center.png`、`wood_slot_left.png`：棋盘和分数区的装饰性底板，按资源构图择用。
- `assets/shangdian/01_back_button.png`：游戏页返回按钮。

## 实现边界

- 修改 `GameScreen`、`EvolutionPanelView`、`BoardView`、`ItemBarView` 的布局和样式。
- 在 `GAME_CONFIG.art` 和 `ArtRepository` 注册并加载新资源。
- 维持现有公开接口、`GameScreenModel`、`GameScreenActions`、动画调用和棋盘坐标计算。
- 不修改 `Game2048`、`GameFlowController`、输入处理、经济系统或存储数据。
- 保留右上设置入口；仅对其按钮外观做适配。
