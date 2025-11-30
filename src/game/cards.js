/**
 * 卡牌定義與工具。
 * 若要新增卡牌，在 CARD_LIBRARY 中添加配置即可。
 */

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} name
 * @property {"tower"|"layout"|"style"} type
 * @property {number} cost
 * @property {string} description
 * @property {Object} config 不同類型卡牌的具體配置
 */

/**
 * 手牌上限
 * @type {number}
 */
export const MAX_HAND_SIZE = 5;

/**
 * 卡牌池：此處定義所有可用卡牌。
 * 想擴展更多卡牌時，直接在此數組中添加即可。
 * @type {Card[]}
 */
export const CARD_LIBRARY = [
  {
    id: "tower1",
    name: "Rapid Tower",
    type: "tower",
    cost: 4, // 基础塔，费用较低
    description: "单体高速攻击，伤害较低。",
    stats: {
      attack: 1, // 攻击力等级 (1-3)
      range: 2, // 射程等级 (1-3)
      speed: 3, // 攻速等级 (1-3, 数值越高越快)
      typeTag: "快速单体",
    },
    config: {
      towerType: "tower1",
      label: "RAPID",
    },
  },
  {
    id: "tower2",
    name: "Explosive Tower",
    type: "tower",
    cost: 7, // 中等费用
    description: "范围伤害塔，攻速慢，无法攻击贴身敌人。",
    stats: {
      attack: 2,
      range: 2,
      speed: 1,
      typeTag: "范围爆炸",
    },
    config: {
      towerType: "tower2",
      label: "EXPL",
    },
  },
  {
    id: "tower3",
    name: "Sniper Tower",
    type: "tower",
    cost: 10, // 高费用
    description: "高伤害远程塔，优先血量最高。攻速慢，单次伤害高。",
    stats: {
      attack: 3,
      range: 3,
      speed: 1,
      typeTag: "远程狙击",
    },
    config: {
      towerType: "tower3",
      label: "SNIP",
    },
  },
  {
    id: "tower-executioner",
    name: "Executioner's Tower",
    type: "tower",
    cost: 11,
    description: "对生命值最低的敌人发出处决斩击，对血量低于20%的敌人造成巨额伤害。",
    stats: {
      attack: 3,
      range: 2,
      speed: 1,
      typeTag: "处决斩杀",
    },
    config: {
      towerType: "executioner",
      label: "EXEC",
    },
  },
  {
    id: "tower-percentile",
    name: "Percentile Spire",
    type: "tower",
    cost: 9,
    description: "锁定一个目标并持续发射光束，每秒按目标当前生命值造成百分比伤害。",
    stats: {
      attack: 2,
      range: 3,
      speed: 2,
      typeTag: "持续光束",
    },
    config: {
      towerType: "percentile",
      label: "PCT",
    },
  },
  // 保留旧塔类型作为兼容（可选）
  {
    id: "tower-div",
    name: "Div Tower",
    type: "tower",
    cost: 5,
    description: "中等攻速與傷害的 DIV 塔，射程適中，適合作為通用主力輸出。",
    stats: {
      attack: 2,
      range: 2,
      speed: 2,
      typeTag: "单体",
    },
    config: {
      towerType: "div",
      label: "DIV",
    },
  },
  {
    id: "tower-button",
    name: "Button Tower",
    type: "tower",
    cost: 7,
    description: "攻速較慢但傷害高的 BUTTON 塔，射程略短，專門點殺高血目標。",
    stats: {
      attack: 3,
      range: 1,
      speed: 1,
      typeTag: "单点爆发",
    },
    config: {
      towerType: "button",
      label: "BTN",
    },
  },
  {
    id: "tower-img",
    name: "Image Tower",
    type: "tower",
    cost: 9,
    description: "範圍攻擊 IMG 塔，高射程覆蓋大片區域，但攻速偏慢、Cost 較高。",
    stats: {
      attack: 2,
      range: 3,
      speed: 1,
      typeTag: "范围伤害",
    },
    config: {
      towerType: "img",
      label: "IMG",
    },
  },
  {
    id: "style-rotate",
    name: "Rotate",
    type: "style",
    cost: 2,
    description: "讓目標塔旋轉，增加射程但攻速略降。",
    stats: {
      effectTag: "射程＋30% / 攻速－17%",
    },
    config: {
      styleType: "rotate",
      towerClass: "tower-style-rotate",
      rangeMultiplier: 1.3,
      attackIntervalMultiplier: 1.2,
      damageMultiplier: 1.0,
    },
  },
  {
    id: "style-shadow",
    name: "Shadow",
    type: "style",
    cost: 2,
    description: "給目標塔添加陰影，顯著增加傷害。",
    stats: {
      effectTag: "伤害＋30%",
    },
    config: {
      styleType: "shadow",
      towerClass: "tower-style-shadow",
      rangeMultiplier: 1.0,
      attackIntervalMultiplier: 1.0,
      damageMultiplier: 1.3,
    },
  },
];

/**
 * 獲取初始手牌。
 * 目前簡單地取卡牌庫的前 MAX_HAND_SIZE 張，不做隨機。
 * @returns {Card[]}
 */
export function getInitialHand() {
  return CARD_LIBRARY.slice(0, MAX_HAND_SIZE);
}


