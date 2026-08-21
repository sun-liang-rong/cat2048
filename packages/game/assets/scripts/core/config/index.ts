/**
 * 配置中心：统一从这里引入游戏配置与规则常量。
 *
 * - `gameConfig`：GAME_CONFIG（设计尺寸 / 猫咪 / 美术资源路径 / 网络地址 / 字体）
 * - `catDefinitions`：猫咪等级定义
 * - `constants`：基础数值常量
 * - `gameRules`：规则函数与常量
 */
export * from './catDefinitions';
export * from './constants';
export * from './gameConfig';
export * from './gameRules';
