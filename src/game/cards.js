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
    id: "tower-div",
    name: "Div Tower",
    type: "tower",
    cost: 3,
    description: "中等攻速與傷害的 DIV 塔，射程適中，適合作為通用主力輸出。",
    // 卡牌正面显示的数值摘要
    stats: {
      attack: 2, // 攻击力等级 (1-3)
      range: 2, // 射程等级 (1-3)
      speed: 2, // 攻速等级 (1-3, 数值越高越快)
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
    cost: 4,
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
    cost: 6,
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
    id: "layout-flex",
    name: "Flex Layout",
    type: "layout",
    cost: 3,
    description: "為戰場套上 Flex 佈局增益，所有塔獲得小幅攻速加成。",
    stats: {
      effectTag: "全塔攻速＋10%",
    },
    config: {
      layoutType: "flex",
      fieldClass: "field-layout-flex",
      attackIntervalMultiplier: 0.9, // 攻速约+11%
      damageMultiplier: 1.0,
    },
  },
  {
    id: "layout-grid",
    name: "Grid Layout",
    type: "layout",
    cost: 4,
    description: "為戰場套上 Grid 佈局增益，所有塔傷害略微提升。",
    stats: {
      effectTag: "全塔攻击＋15%",
    },
    config: {
      layoutType: "grid",
      fieldClass: "field-layout-grid",
      attackIntervalMultiplier: 1.0,
      damageMultiplier: 1.15, // 伤害+15%
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


