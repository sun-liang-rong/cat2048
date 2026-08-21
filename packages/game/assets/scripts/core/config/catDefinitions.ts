/**
 * 猫咪等级定义（名称 / 描述 / 默认美术资源路径）。
 */
const classicCatAsset = (level: number): string =>
  `game/cats/classic/cat_${level < 10 ? '0' : ''}${level}/texture`;

export const CAT_DEFINITIONS = [
  { level: 1, name: '橘猫', description: '爱晒太阳，也爱把棋盘占得满满当当。', asset: classicCatAsset(1) },
  { level: 2, name: '蓝白英短', description: '圆脸短腿，认真守着每一次合成。', asset: classicCatAsset(2) },
  { level: 3, name: '三花猫', description: '花色独一无二，运气也总是很好。', asset: classicCatAsset(3) },
  { level: 4, name: '布偶猫', description: '温柔安静，像一团会呼吸的云。', asset: classicCatAsset(4) },
  { level: 5, name: '暹罗猫', description: '好奇又健谈，什么动静都逃不过它。', asset: classicCatAsset(5) },
  { level: 6, name: '美短虎斑', description: '精力十足，最擅长把局面重新盘活。', asset: classicCatAsset(6) },
  { level: 7, name: '奶牛猫', description: '黑白分明，行动却永远出人意料。', asset: classicCatAsset(7) },
  { level: 8, name: '孟买黑猫', description: '像一小片夜色，安静又神秘。', asset: classicCatAsset(8) },
  { level: 9, name: '银河极光猫', description: '星光落在毛尖，开启通往星穹的进化。', asset: classicCatAsset(9) },
  { level: 10, name: '星穹守护猫', description: '守护星河的光环，在每次合成中闪耀。', asset: classicCatAsset(10) },
  { level: 11, name: '星环圣灵猫', description: '星环环绕肩头，静静积蓄最后的光芒。', asset: classicCatAsset(11) },
  { level: 12, name: '创世极光猫', description: '万千极光汇于一身，完成猫咪的终极进化。', asset: classicCatAsset(12) },
] as const;
