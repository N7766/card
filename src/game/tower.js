/**
 * 塔模組：負責創建塔 DOM 與對應數據結構，並應用樣式卡效果。
 */

import { TOWER_STATS, TOWERS_CONFIG } from "./config.js";

/** @typedef {import("./cards.js").Card} Card */

/**
 * @typedef {Object} Tower
 * @property {string} id
 * @property {HTMLElement} el
 * @property {number} x   在戰場中的相對座標（像素）
 * @property {number} y
 * @property {number} range
 * @property {number} damage
 * @property {number} attackInterval
 * @property {number} lastAttackTime
 * @property {"div"|"button"|"img"|"tower1"|"tower2"|"tower3"} towerType
 * @property {boolean} alive
 * @property {boolean} aoe 是否為範圍攻擊塔
 * @property {number | undefined} [disabledUntil] 若被腳本怪干擾，該時間前無法攻擊
 * @property {number} [minRange] 最小攻击距离
 * @property {number} [bulletSpeed] 子弹速度
 * @property {string} [bulletStyle] 子弹样式
 * @property {"first"|"strongest"} [targetStrategy] 目标选择策略
 * @property {number} [aoeRadius] 范围伤害半径
 * @property {number} [aoeDamage] 范围伤害值
 */

let towerIdCounter = 1;

/**
 * 創建塔元素並插入戰場。
 * @param {HTMLElement} gameField 戰場 DOM
 * @param {"div"|"button"|"img"|"tower1"|"tower2"|"tower3"} towerType
 * @param {number} x 在戰場中的 x 座標（像素）
 * @param {number} y 在戰場中的 y 座標（像素）
 * @param {string} label 顯示在塔上的短文字
 * @param {number} now 當前時間戳（毫秒）
 * @returns {Tower}
 */
export function createTower(gameField, towerType, x, y, label, now) {
  // 优先使用新的TOWERS_CONFIG，如果没有则使用旧的TOWER_STATS
  const newConfig = TOWERS_CONFIG[towerType];
  const oldStats = TOWER_STATS[towerType];
  
  const id = `tower-${towerIdCounter++}`;

  const el = document.createElement("div");
  el.classList.add("tower");

  // 设置塔的样式类
  if (towerType === "div") {
    el.classList.add("tower-div");
  } else if (towerType === "button") {
    el.classList.add("tower-button");
  } else if (towerType === "img") {
    el.classList.add("tower-img");
  } else if (towerType === "tower1") {
    el.classList.add("tower-tower1");
  } else if (towerType === "tower2") {
    el.classList.add("tower-tower2");
  } else if (towerType === "tower3") {
    el.classList.add("tower-tower3");
  }

  el.dataset.towerId = id;
  el.textContent = label;

  // 將塔放置在戰場指定位置
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  gameField.appendChild(el);

  /** @type {Tower} */
  const tower = {
    id,
    el,
    x,
    y,
    range: newConfig ? newConfig.attackRange : oldStats.range,
    damage: newConfig ? newConfig.attackDamage : oldStats.damage,
    attackInterval: newConfig ? newConfig.attackInterval : oldStats.attackInterval,
    lastAttackTime: now,
    towerType,
    alive: true,
    aoe: newConfig ? Boolean(newConfig.aoeRadius) : Boolean(oldStats.aoe),
  };
  
  // 如果是新塔类型，添加新属性
  if (newConfig) {
    tower.minRange = newConfig.minRange || 0;
    tower.bulletSpeed = newConfig.bulletSpeed;
    tower.bulletStyle = newConfig.bulletStyle;
    tower.targetStrategy = newConfig.targetStrategy;
    tower.aoeRadius = newConfig.aoeRadius || 0;
    tower.aoeDamage = newConfig.aoeDamage || 0;
  }

  // 如果是 button 塔，點擊時可觸發微弱 buff（示例）
  if (towerType === "button") {
    el.addEventListener("click", () => {
      // 給自己一點暫時的攻速加成，只做一次性簡單效果
      tower.attackInterval = Math.max(300, tower.attackInterval * 0.9);
      el.classList.add("tower-style-shadow");
      setTimeout(() => {
        el.classList.remove("tower-style-shadow");
      }, 600);
    });
  }

  return tower;
}

/**
 * 對塔應用樣式卡效果。
 * @param {Tower} tower
 * @param {Card} card 樣式卡
 */
export function applyStyleCardToTower(tower, card) {
  const cfg = card.config || {};
  const towerClass = cfg.towerClass;
  const rangeMultiplier = typeof cfg.rangeMultiplier === "number" ? cfg.rangeMultiplier : 1;
  const attackIntervalMultiplier =
    typeof cfg.attackIntervalMultiplier === "number" ? cfg.attackIntervalMultiplier : 1;
  const damageMultiplier =
    typeof cfg.damageMultiplier === "number" ? cfg.damageMultiplier : 1;

  if (towerClass) {
    tower.el.classList.add(towerClass);
  }

  // 調整屬性，這裡直接在現有數值上乘以倍率
  tower.range *= rangeMultiplier;
  tower.attackInterval *= attackIntervalMultiplier;
  tower.damage *= damageMultiplier;
}


