/**
 * 遊戲配置與常量定義。
 * 未來若想調整難度/波次/能量等，只需修改本文件的配置。
 */

/**
 * 初始基地生命
 * @type {number}
 */
export const INITIAL_BASE_HP = 20;

/**
 * 初始能量
 * @type {number}
 */
export const INITIAL_ENERGY = 6;

/**
 * 能量上限
 * @type {number}
 */
export const MAX_ENERGY = 20;

/**
 * 每秒能量恢復速度（默认值，可在关卡配置中覆盖）
 * 已调整为每2.5秒+1能量（0.4/秒），让游戏节奏更慢
 * @type {number}
 */
export const ENERGY_REGEN_PER_SECOND = 0.4;

/**
 * 塔攻擊獲取範圍系數（基於 DOM 中心距離）
 * @type {number}
 */
export const RANGE_UNIT = 1;

/**
 * 基地半徑（像素，用於判斷敵人是否到達基地）
 * @type {number}
 */
export const BASE_RADIUS = 36;

/**
 * 塔的寬高（像素）
 * @type {number}
 */
export const TOWER_WIDTH = 34;
export const TOWER_HEIGHT = 34;

/**
 * 敵人的寬高（像素）
 * @type {number}
 */
export const ENEMY_WIDTH = 40;
export const ENEMY_HEIGHT = 30;

/**
 * 地圖網格單元大小（像素）
 * @type {number}
 */
export const MAP_TILE_SIZE = 40;

/**
 * 新的敌人配置系统
 * 统一的敌人类型配置，包含基础属性和奖励
 * 
 * @typedef {Object} EnemyConfig
 * @property {string} id - 敌人类型ID
 * @property {string} name - 敌人名称
 * @property {number} maxHp - 最大血量
 * @property {number} moveSpeed - 移动速度（像素/秒，基于BASE_MOVE_SPEED的系数）
 * @property {number} rewardEnergy - 击杀后提供的能量奖励
 * @property {string} [specialTag] - 特殊标签（fast, tank, healer等）
 * @property {number} [armor] - 伤害减免（0-1之间）
 * @property {number} [damageToBase] - 对基地造成的伤害
 * @property {Object} [specialBehavior] - 特殊行为配置（可选）
 * @property {{width?:number,height?:number,hitRadius?:number,highlightRadius?:number}} [visual] - 渲染尺寸与命中半径
 */
export const BASE_MOVE_SPEED = 30; // 基础移动速度（像素/秒），全局下调

/**
 * 统一的敌人类型常量，确保全局命名一致
 */
export const ENEMY_TYPES = Object.freeze({
  NORMAL: "normal",
  SPRINTER: "sprinter",
  DEVOURER: "devourer",
  SMART: "smart",
  HEALER: "healer",
  AD: "ad",
  BANNER: "banner",
  SCRIPT: "script",
  COURIER: "courier",
  SYMBIOTE: "symbiote",
  JAMMER: "jammer",
  BOSS: "boss",
});

/**
 * Boss 专用基础配置
 * 单独抽出方便在敌人模块与 UI 中引用，避免散落的常量。
 */
const BASE_BOSS_CONFIG = {
  type: "boss",
  displayName: "語法霸主",
  maxHp: 3200,
  baseSpeed: 18,
  moveSpeed: 18,
  armor: 0.2,
  damageToBase: 10,
  rewardEnergy: 30,
  visual: {
    width: 110,
    height: 42,
    hitRadius: 32,
    highlightRadius: 130,
  },
  specialBehavior: {
    role: "boss",
    summonInterval: 5000,
    summonCountEachTime: 5,
    summonTypes: ["normal", "sprinter"],
    summonRadius: 2,
    summonRetryDelay: 1500,
    summonHpMultiplier: 1,
    summonSpeedMultiplier: 1,
    towerDestroyInterval: 8000,
    towerDestroyRange: 3,
    towerDestroyCount: 1,
    towerDestroyRetryDelay: 2000,
    towerDestroyWarningDuration: 900,
  },
};

/**
 * 敌人基礎屬性配置
 * 
 * 本配置为游戏内实际使用的权威数据源，包含所有敌人类型的基础属性和特殊行为参数
 * 
 * 敵人類型說明：
 * - normal: 普通移動型，平衡的血量和速度
 * - sprinter: 冲刺型，平時速度略低，每隔幾秒會進入高速冲刺狀態
 * - devourer: 吞噬型，可以吞噬死亡的小怪獲得強化，越吃越大越慢
 * - smart: 智能绕路型，優先選擇塔密度較低的路径
 * - healer: 治疗型，會周期性為附近的友軍回血
 * 
 * 特殊行為配置說明：
 * - specialBehavior: 特殊行為參數對象，包含該類型敵人的特有配置
 *   - sprinter: { sprintCooldown, sprintDuration, sprintSpeedMultiplier, baseSpeed }
 *   - devourer: { devourRadius, devourHpGain, devourSpeedLoss, devourSizeGain, maxDevours }
 *   - smart: { dangerWeight, dangerRadius }
 *   - healer: { healInterval, healAmount, healRadius }
 */
export const ENEMY_CONFIGS = {
  [ENEMY_TYPES.NORMAL]: {
    maxHp: 40,
    baseSpeed: 40,
    moveSpeed: 40,
    armor: 0,
    damageToBase: 1,
    rewardEnergy: 2,
    specialBehavior: null,
    visual: {
      width: 46,
      height: 26,
      hitRadius: 18,
    },
  },
  [ENEMY_TYPES.SPRINTER]: {
    maxHp: 35,
    baseSpeed: 35,
    moveSpeed: 35,
    armor: 0,
    damageToBase: 1,
    rewardEnergy: 3,
    specialBehavior: {
      baseSpeed: 35,
      sprintCooldown: 3500,
      sprintInterval: 3500,
      sprintDuration: 900,
      sprintSpeedMultiplier: 2.5,
    },
    visual: {
      width: 42,
      height: 24,
      hitRadius: 16,
    },
  },
  [ENEMY_TYPES.DEVOURER]: {
    maxHp: 60,
    baseSpeed: 28,
    moveSpeed: 28,
    armor: 0,
    damageToBase: 2,
    rewardEnergy: 5,
    specialBehavior: {
      devourRadius: 50,
      devourHpGain: 30,
      speedDecayPerDevour: 5,
      devourSpeedLoss: 5,
      devourSizeGain: 0.15,
      maxDevours: 5,
    },
    visual: {
      width: 54,
      height: 32,
      hitRadius: 24,
    },
  },
  [ENEMY_TYPES.SMART]: {
    maxHp: 50,
    baseSpeed: 33,
    moveSpeed: 33,
    armor: 0,
    damageToBase: 2,
    rewardEnergy: 4,
    specialBehavior: {
      dangerWeight: 8,
      dangerRadius: 2,
    },
    visual: {
      width: 44,
      height: 26,
      hitRadius: 18,
    },
  },
  [ENEMY_TYPES.HEALER]: {
    maxHp: 30,
    baseSpeed: 30,
    moveSpeed: 30,
    armor: 0,
    damageToBase: 1,
    rewardEnergy: 4,
    specialBehavior: {
      healInterval: 3000,
      healAmount: 15,
      healRadius: 80,
    },
    visual: {
      width: 40,
      height: 26,
      highlightRadius: 72,
      hitRadius: 18,
    },
  },
  [ENEMY_TYPES.COURIER]: {
    maxHp: 18,
    baseSpeed: 70,
    moveSpeed: 70,
    armor: 0,
    damageToBase: 0,
    rewardEnergy: 1,
    specialBehavior: {
      courier: true,
      shieldBonusRatio: 0.35,
    },
    visual: {
      width: 32,
      height: 22,
      hitRadius: 14,
    },
  },
  [ENEMY_TYPES.SYMBIOTE]: {
    maxHp: 95,
    baseSpeed: 32,
    moveSpeed: 32,
    armor: 0.05,
    damageToBase: 2,
    rewardEnergy: 5,
    specialBehavior: {
      parasiteCount: 3,
      parasiteShieldRatio: 0.25,
      parasiteRegenPerSecond: 5,
      parasiteDuration: 7000,
    },
    visual: {
      width: 50,
      height: 30,
      hitRadius: 22,
    },
  },
  [ENEMY_TYPES.JAMMER]: {
    maxHp: 150,
    baseSpeed: 24,
    moveSpeed: 24,
    armor: 0.05,
    damageToBase: 2,
    rewardEnergy: 7,
    maxShield: 35,
    specialBehavior: {
      auraRadius: 150,
      slowMultiplier: 1.3,
      maxStacks: 2,
    },
    visual: {
      width: 54,
      height: 32,
      highlightRadius: 160,
      hitRadius: 26,
    },
  },
  [ENEMY_TYPES.AD]: {
    maxHp: 26,
    baseSpeed: 48,
    moveSpeed: 48,
    armor: 0,
    damageToBase: 1,
    rewardEnergy: 1,
    specialBehavior: null,
    visual: {
      width: 40,
      height: 22,
      hitRadius: 14,
    },
  },
  [ENEMY_TYPES.BANNER]: {
    maxHp: 140,
    baseSpeed: 23,
    moveSpeed: 23,
    armor: 0,
    damageToBase: 3,
    rewardEnergy: 6,
    specialBehavior: null,
    visual: {
      width: 58,
      height: 30,
      hitRadius: 24,
    },
  },
  [ENEMY_TYPES.SCRIPT]: {
    maxHp: 70,
    baseSpeed: 35,
    moveSpeed: 35,
    armor: 0,
    damageToBase: 2,
    rewardEnergy: 3,
    specialBehavior: null,
    visual: {
      width: 48,
      height: 26,
      hitRadius: 18,
    },
  },
  [ENEMY_TYPES.BOSS]: BASE_BOSS_CONFIG,
};

export const BOSS_CONFIG = BASE_BOSS_CONFIG;

/**
 * 敌人基礎屬性配置（保留舊接口以兼容現有代碼）
 * @deprecated 使用 ENEMY_CONFIGS 代替
 */
export const ENEMY_STATS = {
  ad: {
    speed: ENEMY_CONFIGS.ad.baseSpeed ?? ENEMY_CONFIGS.ad.moveSpeed,
    hp: ENEMY_CONFIGS.ad.maxHp,
  },
  banner: {
    speed: ENEMY_CONFIGS.banner.baseSpeed ?? ENEMY_CONFIGS.banner.moveSpeed,
    hp: ENEMY_CONFIGS.banner.maxHp,
  },
  script: {
    speed: ENEMY_CONFIGS.script.baseSpeed ?? ENEMY_CONFIGS.script.moveSpeed,
    hp: ENEMY_CONFIGS.script.maxHp,
  },
};

/**
 * 塔基礎屬性配置（保留舊接口以兼容）
 * @deprecated 使用 TOWERS_CONFIG 代替
 */
export const TOWER_STATS = {
  div: {
    range: 150,
    damage: 18,
    attackInterval: 1000,
  },
  button: {
    range: 115,
    damage: 38,
    attackInterval: 1600,
  },
  img: {
    range: 200,
    damage: 20,
    attackInterval: 1800,
    aoe: true,
  },
};

/**
 * 新的塔配置系统
 * 支持3种不同风格的塔类型
 * 
 * @typedef {Object} TowerConfig
 * @property {string} type - 塔类型标识
 * @property {string} name - 塔名称
 * @property {number} attackDamage - 攻击伤害
 * @property {number} attackInterval - 攻击间隔（毫秒）
 * @property {number} attackRange - 攻击范围（像素）
 * @property {number} [minRange] - 最小攻击距离（像素），如果敌人距离小于此值则不攻击
 * @property {number} bulletSpeed - 子弹速度（像素/秒）
 * @property {string} bulletStyle - 子弹样式类型 ("fast", "explosive", "heavy")
 * @property {"first"|"strongest"} targetStrategy - 目标选择策略
 * @property {number} [aoeRadius] - 范围伤害半径（像素），仅范围攻击塔使用
 * @property {number} [aoeDamage] - 范围伤害值，如果存在则对范围内敌人造成此伤害
 */
export const TOWERS_CONFIG = {
  // Tower1: 快速单体攻击塔
  tower1: {
    type: "tower1",
    name: "Rapid Tower",
    attackDamage: 8, // 低伤害
    attackInterval: 400, // 高攻速
    attackRange: 140, // 中等范围
    minRange: 0, // 无最小距离限制
    bulletSpeed: 600, // 快速子弹
    bulletStyle: "fast", // 细长直线型子弹
    targetStrategy: "first", // 攻击首个进入射程的敌人
  },
  // Tower2: 范围伤害塔，无法攻击贴脸敌人
  tower2: {
    type: "tower2",
    name: "Explosive Tower",
    attackDamage: 15, // 中等伤害
    attackInterval: 2500, // 很慢的攻速
    attackRange: 180, // 中等范围
    minRange: 60, // 最小攻击距离，无法攻击太近的敌人
    bulletSpeed: 300, // 中等速度
    bulletStyle: "explosive", // 爆炸型子弹
    targetStrategy: "first",
    aoeRadius: 80, // 爆炸范围
    aoeDamage: 12, // 范围伤害
  },
  // Tower3: 高伤害远程塔，优先攻击血量最高的敌人
  tower3: {
    type: "tower3",
    name: "Sniper Tower",
    attackDamage: 50, // 高伤害
    attackInterval: 2200, // 很慢的攻速
    attackRange: 280, // 大范围
    minRange: 0,
    bulletSpeed: 450, // 中等速度
    bulletStyle: "heavy", // 粗能量球/激光束
    targetStrategy: "strongest", // 优先攻击血量最高的敌人
  },
  executioner: {
    type: "executioner",
    name: "Executioner's Tower",
    attackDamage: 28,
    attackInterval: 2500,
    attackRange: 220,
    bulletSpeed: 420,
    bulletStyle: "heavy",
    targetStrategy: "lowest",
    executionerThreshold: 0.2,
    executionerMultiplier: 5,
  },
  percentile: {
    type: "percentile",
    name: "Percentile Spire",
    attackDamage: 0,
    attackInterval: 0,
    attackRange: 260,
    minRange: 0,
    bulletSpeed: 0,
    bulletStyle: "beam",
    targetStrategy: "first",
    percentDamagePerSecond: 0.05,
    minPercentDamage: 5,
  },
};

/**
 * 單位敵人到達基地時扣除的基地生命
 */
export const ENEMY_DAMAGE_TO_BASE = Object.fromEntries(
  Object.entries(ENEMY_CONFIGS).map(([type, config]) => [type, config.damageToBase ?? 1])
);

const DEFAULT_ENEMY_VISUAL_SPEC = Object.freeze({
  width: 46,
  height: 28,
  hitRadius: 20,
  highlightRadius: 0,
});

/**
 * 获取敌人类型的视觉参数（命中半径、装饰大小等）
 * @param {string} type
 */
export function getEnemyVisualSpec(type) {
  const config = ENEMY_CONFIGS[type];
  if (!config || typeof config.visual !== "object") {
    return DEFAULT_ENEMY_VISUAL_SPEC;
  }
  return {
    ...DEFAULT_ENEMY_VISUAL_SPEC,
    ...config.visual,
  };
}

/**
 * 波次配置（保留作为默认配置，关卡中可复用）
 * 每一波描述要生成的敵人類型和數量，以及生成間隔和進入下一波前的延遲（delay）。
 *
 * 設計分檔：
 * - 波 1～2：只出現 ad，小量慢速生成，用於讓新玩家熟悉出塔與能量節奏。
 * - 波 3～4：加入少量 banner，讓玩家開始思考高傷害塔與佈局。
 * - 波 5+：引入 script 腳本怪，帶來塔被干擾的壓力並略微提升數值。
 */
export const waveConfigs = [
  {
    id: 1,
    // 新手友好的起手波：少量 AD，間隔較長
    enemies: [{ type: "ad", count: 5, interval: 1300 }],
    delay: 2500,
  },
  {
    id: 2,
    // 稍微增加 AD 數量與生成頻率，仍然以熟悉遊戲為主
    enemies: [{ type: "ad", count: 9, interval: 1000 }],
    delay: 2800,
  },
  {
    id: 3,
    // 加入少量 BANNER，提示玩家需要高傷害塔處理坦克
    enemies: [
      { type: "ad", count: 8, interval: 900 },
      { type: "banner", count: 1, interval: 2600 },
    ],
    delay: 3200,
  },
  {
    id: 4,
    // 混合更多 BANNER 與 AD，整體壓力上升
    enemies: [
      { type: "banner", count: 2, interval: 2600 },
      { type: "ad", count: 12, interval: 800 },
    ],
    delay: 3600,
  },
  {
    id: 5,
    // 引入 SCRIPT 腳本怪，中速移動並干擾塔，作為中後期挑戰
    enemies: [
      { type: "ad", count: 12, interval: 750 },
      { type: "script", count: 3, interval: 2200 },
      { type: "banner", count: 2, interval: 2600 },
    ],
    delay: 4200,
  },
];

/**
 * 關卡配置數組
 * 每個關卡包含：名稱、背景主題、BASE位置、敵人出生點、波次配置、能量配置
 *
 * Level 統一字段說明：
 * - mapPreset / mapSize：描述地圖骨架及格子參考，用於隨機障礙生成
 * - entryPosition：主入口參考點（即使有多個 spawnPoints，也便於 HUD 顯示）
 * - randomObstacles：{@link RandomObstacleConfig}，用於生成動態障礙
 * - obstacles：預設的靜態障礙，會與隨機障礙合併後一併渲染
 *
 * 能量配置說明：
 * - initialEnergy: 初始能量
 * - maxEnergy: 最大能量上限
 * - energyRegenPerSecond: 每秒能量回復速度（可覆蓋全局默認值）
 *
 * 波次配置說明：
 * - 每一波可以配置敵人的血量係數(hpMultiplier)和速度係數(speedMultiplier)
 * - 前幾波用於教學，中後期逐步提升難度
 */

/**
 * @typedef {Object} RandomObstacleConfig
 * @property {number} count 預計生成的障礙數量
 * @property {number} avoidRadiusAroundBase 基地周圍的避讓半徑（0~1，相對地圖較短邊）
 * @property {number} avoidRadiusAroundEntry 入口周圍的避讓半徑
 * @property {number} [avoidPathDistance] 與預覽路徑保持的最小距離（0~1）
 * @property {number} [minDistanceBetween] 兩個隨機障礙之間的最小距離（0~1）
 * @property {number} [maxAttemptsPerObstacle] 單個障礙的嘗試次數上限
 */
export const LEVELS = [
  {
    id: 1,
    name: "Level 1",
    description: "敌人从顶部两侧进攻，尝试用 DIV 塔守住正面。",
    backgroundClass: "map-theme-default",
    mapPreset: "two-corridors",
    mapSize: { width: 28, height: 20 },
    entryPosition: { x: 0.5, y: 0.05 },
    basePosition: { x: 0.5, y: 0.85 }, // BASE 在底部中央
    baseClearRadiusTiles: 2,
    spawnPoints: [
      { x: 0.1, y: 0.1 }, // 左上
      { x: 0.9, y: 0.1 }, // 右上
    ],
    gridObstacles: [
      { x: 2, y: 3, w: 5, h: 3 },
      { x: 21, y: 3, w: 5, h: 3 },
      { x: 8, y: 2, w: 3, h: 8 },
      { x: 17, y: 2, w: 3, h: 8 },
      { x: 5, y: 12, w: 4, h: 3 },
      { x: 19, y: 12, w: 4, h: 3 },
      { x: 11, y: 14, w: 6, h: 3 },
    ],
    obstacles: [
      // 簡單的障礙物，形成基本的通道
      { x: 0.4, y: 0.4, width: 0.12, height: 0.03 },
      { x: 0.55, y: 0.55, width: 0.18, height: 0.03 },
    ],
    // 能量配置：前期偏緊張，讓玩家思考建塔位置
    initialEnergy: 7,
    maxEnergy: 22,
    energyRegenPerSecond: 0.45, // 每約2.2秒+1能量
    randomObstacles: {
      count: 6,
      avoidRadiusAroundBase: 0.2,
      avoidRadiusAroundEntry: 0.12,
      avoidPathDistance: 0.05,
      minDistanceBetween: 0.05,
      maxAttemptsPerObstacle: 18,
    },
    waves: [
      {
        id: 1,
        delay: 0,
        enemies: [{ type: "normal", count: 8, interval: 1150 }],
      },
      {
        id: 2,
        delay: 4800,
        enemies: [{ type: "normal", count: 10, interval: 1050 }],
      },
      {
        id: 3,
        delay: 5200,
        enemies: [
          { type: "normal", count: 12, interval: 1000 },
          { type: "courier", count: 2, interval: 1600 },
        ],
      },
      {
        id: 4,
        delay: 4200,
        enemies: [
          { type: "sprinter", count: 4, interval: 1200 },
          { type: "normal", count: 10, interval: 900 },
        ],
      },
      {
        id: 5,
        delay: 4200,
        enemies: [
          { type: "devourer", count: 2, interval: 2100 },
          { type: "smart", count: 4, interval: 1200 },
        ],
      },
      {
        id: 6,
        delay: 4200,
        enemies: [
          { type: "sprinter", count: 6, interval: 950 },
          { type: "banner", count: 2, interval: 2500 },
          { type: "healer", count: 2, interval: 2000 },
        ],
      },
      {
        id: 7,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.05, speedMultiplier: 0.8 },
          { type: "normal", count: 14 },
          { type: "sprinter", count: 4 },
          { type: "devourer", count: 2 },
          { type: "healer", count: 2 },
        ],
      },
    ],
    difficulty: 1, // 难度星级 1~3
    enemyTypes: ["普通", "冲刺", "吞噬", "智能", "治疗", "BANNER", "信使", "Boss"], // 敌人类型
    recommended: "推荐多放 DIV 塔防守正面", // 推荐玩法提示
    setupTimeSeconds: 10, // 布置时间（秒）
    previewPaths: [
      // 路径预览：从左上到BASE的大致路线
      [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.85 },
      ],
      // 从右上到BASE的大致路线
      [
        { x: 0.9, y: 0.1 },
        { x: 0.55, y: 0.55 },
        { x: 0.5, y: 0.85 },
      ],
    ],
  },
  {
    id: 2,
    name: "Level 2",
    description: "敌人从四个方向进攻，BASE 位于中央，需要全方位防御。",
    backgroundClass: "map-theme-cross",
    mapPreset: "crossroads",
    mapSize: { width: 32, height: 22 },
    entryPosition: { x: 0.5, y: 0.05 },
    basePosition: { x: 0.5, y: 0.5 }, // BASE 在中央
    baseClearRadiusTiles: 2,
    spawnPoints: [
      { x: 0.1, y: 0.1 }, // 左上
      { x: 0.9, y: 0.1 }, // 右上
      { x: 0.1, y: 0.9 }, // 左下
      { x: 0.9, y: 0.9 }, // 右下
    ],
    gridObstacles: [
      { x: 5, y: 2, w: 5, h: 5 },
      { x: 22, y: 2, w: 5, h: 5 },
      { x: 5, y: 14, w: 5, h: 5 },
      { x: 22, y: 14, w: 5, h: 5 },
      { x: 11, y: 4, w: 10, h: 3 },
      { x: 11, y: 15, w: 10, h: 3 },
      { x: 4, y: 10, w: 6, h: 3 },
      { x: 22, y: 10, w: 6, h: 3 },
    ],
    obstacles: [
      // 用幾條牆組成曲折通道，讓路線差異明顯
      { x: 0.25, y: 0.15, width: 0.02, height: 0.7 },
      { x: 0.45, y: 0.0, width: 0.02, height: 0.65 },
      { x: 0.65, y: 0.35, width: 0.02, height: 0.65 },
      { x: 0.75, y: 0.0, width: 0.02, height: 0.4 },
    ],
    // 能量配置：中期略富裕，後期再次緊張
    initialEnergy: 10,
    maxEnergy: 28,
    energyRegenPerSecond: 0.46, // 稍快的回能，讓玩家建立多方向防線
    randomObstacles: {
      count: 8,
      avoidRadiusAroundBase: 0.18,
      avoidRadiusAroundEntry: 0.15,
      avoidPathDistance: 0.06,
      minDistanceBetween: 0.06,
      maxAttemptsPerObstacle: 20,
    },
    waves: [
      {
        id: 1,
        delay: 0,
        enemies: [{ type: "normal", count: 10, interval: 1150 }],
      },
      {
        id: 2,
        delay: 5000,
        enemies: [{ type: "normal", count: 12, interval: 1000 }],
      },
      {
        id: 3,
        delay: 5200,
        enemies: [
          { type: "normal", count: 14, interval: 950 },
          { type: "sprinter", count: 4, interval: 1250 },
        ],
      },
      {
        id: 4,
        delay: 4800,
        enemies: [
          { type: "normal", count: 12, interval: 900 },
          { type: "banner", count: 2, interval: 2600 },
        ],
      },
      {
        id: 5,
        delay: 4600,
        enemies: [
          { type: "smart", count: 4, interval: 1300 },
          { type: "sprinter", count: 6, interval: 1000 },
        ],
      },
      {
        id: 6,
        delay: 4600,
        enemies: [
          { type: "devourer", count: 2, interval: 2200 },
          { type: "courier", count: 3, interval: 1500 },
          { type: "healer", count: 2, interval: 2000 },
        ],
      },
      {
        id: 7,
        delay: 4800,
        enemies: [
          { type: "normal", count: 16, interval: 850 },
          { type: "script", count: 4, interval: 1800 },
          { type: "smart", count: 3, interval: 1300 },
        ],
      },
      {
        id: 8,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.15, speedMultiplier: 0.85 },
          { type: "normal", count: 18 },
          { type: "sprinter", count: 4 },
          { type: "devourer", count: 2 },
          { type: "script", count: 4 },
          { type: "healer", count: 2 },
        ],
      },
    ],
    difficulty: 2, // 难度星级
    enemyTypes: ["普通", "冲刺", "BANNER", "SCRIPT", "吞噬", "智能", "治疗", "信使", "Boss"], // 敌人类型
    recommended: "需要全方位防御，合理使用布局卡提升整体战力", // 推荐玩法提示
    setupTimeSeconds: 12, // 布置时间（秒）
    previewPaths: [
      // 从四个方向到中央BASE的大致路线
      [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.4 },
        { x: 0.5, y: 0.5 },
      ],
      [
        { x: 0.9, y: 0.1 },
        { x: 0.7, y: 0.4 },
        { x: 0.5, y: 0.5 },
      ],
      [
        { x: 0.1, y: 0.9 },
        { x: 0.3, y: 0.6 },
        { x: 0.5, y: 0.5 },
      ],
      [
        { x: 0.9, y: 0.9 },
        { x: 0.7, y: 0.6 },
        { x: 0.5, y: 0.5 },
      ],
    ],
  },
  {
    id: 3,
    name: "Level 3",
    description: "多段回旋走廊与分层防线同时压迫，合理使用布局卡和样式卡。",
    backgroundClass: "map-theme-dark",
    mapPreset: "maze-core",
    mapSize: { width: 34, height: 26 },
    entryPosition: { x: 0.15, y: 0.05 },
    basePosition: { x: 0.5, y: 0.7 }, // BASE 在中下
    baseClearRadiusTiles: 2,
    spawnPoints: [
      { x: 0.0, y: 0.02 }, // 左上角
      { x: 1.0, y: 0.02 }, // 右上角
      { x: 0.0, y: 0.38 }, // 左上中
      { x: 1.0, y: 0.38 }, // 右上中
    ],
    gridObstacles: [
      // 蛇形主干，迫使敵人多次橫移
      { x: 0, y: 3, w: 30, h: 2 },
      { x: 6, y: 7, w: 28, h: 2 },
      { x: 0, y: 11, w: 30, h: 2 },
      { x: 6, y: 15, w: 28, h: 2 },
      { x: 0, y: 17, w: 8, h: 2 },
      // 前線分層與半開口 U 形
      { x: 8, y: 17, w: 2, h: 3 },
      { x: 10, y: 17, w: 3, h: 6 },
      { x: 21, y: 17, w: 3, h: 6 },
      { x: 24, y: 17, w: 2, h: 3 },
      { x: 16, y: 18, w: 2, h: 2 },
      { x: 13, y: 22, w: 3, h: 2 },
      { x: 19, y: 22, w: 3, h: 2 },
      { x: 27, y: 18, w: 2, h: 4 },
      // 上半區的轉角與小平台
      { x: 2, y: 0, w: 2, h: 3 },
      { x: 8, y: 0, w: 3, h: 3 },
      { x: 24, y: 0, w: 3, h: 3 },
      { x: 5, y: 5, w: 2, h: 2 },
      { x: 10, y: 5, w: 3, h: 2 },
      { x: 18, y: 5, w: 3, h: 2 },
      { x: 25, y: 5, w: 2, h: 2 },
      { x: 4, y: 9, w: 3, h: 2 },
      { x: 12, y: 9, w: 3, h: 2 },
      { x: 20, y: 9, w: 3, h: 2 },
      { x: 28, y: 9, w: 2, h: 2 },
      // 中段交會的轉折與塔位
      { x: 4, y: 13, w: 3, h: 2 },
      { x: 11, y: 13, w: 3, h: 2 },
      { x: 21, y: 13, w: 3, h: 2 },
      { x: 28, y: 13, w: 2, h: 2 },
      // 基地前緣的多層防線與塔臺
      { x: 12, y: 17, w: 2, h: 2 },
      { x: 18, y: 17, w: 2, h: 2 },
      { x: 3, y: 20, w: 2, h: 3 },
      { x: 28, y: 20, w: 3, h: 3 },
      { x: 15, y: 23, w: 3, h: 2 },
    ],
    obstacles: [
      // 複雜的迷宮式障礙，形成多條路徑
      { x: 0.2, y: 0.1, width: 0.15, height: 0.03 },
      { x: 0.65, y: 0.15, width: 0.2, height: 0.03 },
      { x: 0.15, y: 0.3, width: 0.03, height: 0.25 },
      { x: 0.5, y: 0.25, width: 0.03, height: 0.3 },
      { x: 0.8, y: 0.35, width: 0.03, height: 0.25 },
      { x: 0.3, y: 0.5, width: 0.25, height: 0.03 },
      { x: 0.7, y: 0.55, width: 0.2, height: 0.03 },
    ],
    // 能量配置：後期再次緊張，需要精打細算
    initialEnergy: 10,
    maxEnergy: 30,
    energyRegenPerSecond: 0.5, // 每2秒+1能量
    randomObstacles: {
      count: 6,
      avoidRadiusAroundBase: 0.18,
      avoidRadiusAroundEntry: 0.15,
      avoidPathDistance: 0.08,
      minDistanceBetween: 0.07,
      maxAttemptsPerObstacle: 28,
    },
    waves: [
      {
        id: 1,
        delay: 0,
        enemies: [
          { type: "normal", count: 14 },
          { type: "sprinter", count: 4 },
          { type: "banner", count: 2 },
        ],
      },
      {
        id: 2,
        delay: 4200,
        enemies: [
          { type: "normal", count: 16 },
          { type: "script", count: 3 },
          { type: "banner", count: 2 },
        ],
      },
      {
        id: 3,
        delay: 4600,
        enemies: [
          { type: "normal", count: 18 },
          { type: "script", count: 3 },
          { type: "banner", count: 3 },
          { type: "devourer", count: 1 },
        ],
      },
      {
        id: 4,
        delay: 5000,
        enemies: [
          { type: "normal", count: 20 },
          { type: "script", count: 4 },
          { type: "devourer", count: 2 },
          { type: "smart", count: 2 },
          { type: "healer", count: 2 },
        ],
      },
      {
        id: 5,
        delay: 4800,
        enemies: [
          { type: "banner", count: 3, interval: 2500 },
          { type: "smart", count: 3, interval: 1200 },
          { type: "devourer", count: 2, interval: 2200 },
          { type: "symbiote", count: 2, interval: 2600 },
        ],
      },
      {
        id: 6,
        delay: 4500,
        enemies: [
          { type: "sprinter", count: 8, interval: 900 },
          { type: "script", count: 4, interval: 1500 },
          { type: "healer", count: 2, interval: 2000 },
          { type: "jammer", count: 2, interval: 3600 },
        ],
      },
      {
        id: 7,
        delay: 4800,
        enemies: [
          { type: "normal", count: 22, interval: 650 },
          { type: "smart", count: 4, interval: 1100 },
          { type: "devourer", count: 3, interval: 2000 },
        ],
      },
      {
        id: 8,
        delay: 4200,
        enemies: [
          { type: "script", count: 6, interval: 1400 },
          { type: "banner", count: 3, interval: 2300 },
          { type: "healer", count: 3, interval: 2000 },
        ],
      },
      {
        id: 9,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.3, speedMultiplier: 0.85 },
          { type: "normal", count: 24 },
          { type: "script", count: 5 },
          { type: "devourer", count: 3 },
          { type: "smart", count: 4 },
          { type: "healer", count: 3 },
        ],
      },
    ],
    difficulty: 3, // 难度星级
    enemyTypes: ["普通", "冲刺", "BANNER", "SCRIPT", "吞噬", "智能", "治疗", "信使", "共生体", "干扰者", "Boss"], // 敌人类型
    recommended: "芜湖", // 推荐玩法提示
    setupTimeSeconds: 15, // 布置时间（秒）
    previewPaths: [
      // 蛇形回旋路線示意（左上）
      [
        { x: 0.0, y: 0.0 },
        { x: 0.88, y: 0.05 },
        { x: 0.85, y: 0.22 },
        { x: 0.18, y: 0.33 },
        { x: 0.82, y: 0.45 },
        { x: 0.25, y: 0.58 },
        { x: 0.78, y: 0.64 },
        { x: 0.35, y: 0.7 },
        { x: 0.5, y: 0.72 },
      ],
      // 蛇形回旋路線示意（右上）
      [
        { x: 1.0, y: 0.0 },
        { x: 0.12, y: 0.06 },
        { x: 0.15, y: 0.24 },
        { x: 0.82, y: 0.34 },
        { x: 0.2, y: 0.48 },
        { x: 0.75, y: 0.58 },
        { x: 0.32, y: 0.68 },
        { x: 0.5, y: 0.72 },
      ],
      // 左側上中入口匯入
      [
        { x: 0.0, y: 0.38 },
        { x: 0.7, y: 0.42 },
        { x: 0.2, y: 0.52 },
        { x: 0.75, y: 0.6 },
        { x: 0.4, y: 0.68 },
        { x: 0.5, y: 0.72 },
      ],
      // 右側上中入口匯入
      [
        { x: 1.0, y: 0.38 },
        { x: 0.3, y: 0.42 },
        { x: 0.85, y: 0.52 },
        { x: 0.35, y: 0.6 },
        { x: 0.63, y: 0.68 },
        { x: 0.5, y: 0.72 },
      ],
    ],
  },

  {
    id: 4,
    name: "Level 4",
    description: "控场",
    backgroundClass: "map-theme-labyrinth",
    mapPreset: "labyrinth-practice",
    mapSize: { width: 26, height: 20 },
    entryPosition: { x: 0.05, y: 0.1 },
    basePosition: { x: 0.82, y: 0.78 },
    baseClearRadiusTiles: 2,
    spawnPoints: [
      { x: 0.05, y: 0.1 },
      { x: 0.05, y: 0.9 },
      { x: 0.2, y: 0.5 },
    ],
    gridObstacles: [
      { x: 2, y: 2, w: 2, h: 16 },
      { x: 6, y: 0, w: 2, h: 14 },
      { x: 10, y: 4, w: 2, h: 14 },
      { x: 14, y: 2, w: 2, h: 16 },
      { x: 18, y: 6, w: 2, h: 10 },
      { x: 8, y: 8, w: 8, h: 2 },
      { x: 12, y: 12, w: 10, h: 2 },
      { x: 4, y: 14, w: 7, h: 2 },
    ],
    obstacles: [
      { x: 0.25, y: 0.2, width: 0.04, height: 0.12 },
      { x: 0.35, y: 0.6, width: 0.05, height: 0.1 },
      { x: 0.55, y: 0.4, width: 0.04, height: 0.12 },
    ],
    initialEnergy: 9,
    maxEnergy: 26,
    energyRegenPerSecond: 0.46,
    randomObstacles: {
      count: 4,
      avoidRadiusAroundBase: 0.2,
      avoidRadiusAroundEntry: 0.12,
      avoidPathDistance: 0.07,
      minDistanceBetween: 0.07,
      maxAttemptsPerObstacle: 16,
    },
    waves: [
      { id: 1, delay: 0, enemies: [{ type: "normal", count: 12, interval: 1100 }] },
      { id: 2, delay: 4800, enemies: [{ type: "normal", count: 14, interval: 1000 }] },
      {
        id: 3,
        delay: 5000,
        enemies: [
          { type: "normal", count: 12, interval: 950 },
          { type: "smart", count: 2, interval: 1400 },
        ],
      },
      {
        id: 4,
        delay: 4600,
        enemies: [
          { type: "sprinter", count: 4, interval: 1100 },
          { type: "normal", count: 12, interval: 900 },
        ],
      },
      {
        id: 5,
        delay: 4400,
        enemies: [
          { type: "devourer", count: 2, interval: 2200 },
          { type: "smart", count: 4, interval: 1200 },
        ],
      },
      {
        id: 6,
        delay: 4600,
        enemies: [
          { type: "banner", count: 2, interval: 2500 },
          { type: "normal", count: 16, interval: 820 },
        ],
      },
      {
        id: 7,
        delay: 4800,
        enemies: [
          { type: "script", count: 4, interval: 1600 },
          { type: "sprinter", count: 6, interval: 950 },
        ],
      },
      {
        id: 8,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.1, speedMultiplier: 0.85 },
          { type: "normal", count: 18 },
          { type: "smart", count: 4 },
          { type: "healer", count: 2 },
        ],
      },
    ],
    difficulty: 2,
    enemyTypes: ["普通", "智能", "冲刺", "吞噬", "BANNER", "SCRIPT", "治疗", "Boss"],
    recommended: "持续输出。",
    setupTimeSeconds: 11,
    previewPaths: [
      [
        { x: 0.05, y: 0.1 },
        { x: 0.35, y: 0.2 },
        { x: 0.6, y: 0.4 },
        { x: 0.82, y: 0.78 },
      ],
      [
        { x: 0.05, y: 0.9 },
        { x: 0.3, y: 0.8 },
        { x: 0.62, y: 0.6 },
        { x: 0.82, y: 0.78 },
      ],
      [
        { x: 0.2, y: 0.5 },
        { x: 0.45, y: 0.5 },
        { x: 0.7, y: 0.65 },
        { x: 0.82, y: 0.78 },
      ],
    ],
  },

  {
    id: 5,
    name: "Level 5",
    description: "敌人开始携带护盾与共生体，中后期逐渐压迫。",
    backgroundClass: "map-theme-oasis",
    mapPreset: "shield-trial",
    mapSize: { width: 28, height: 22 },
    entryPosition: { x: 0.1, y: 0.1 },
    basePosition: { x: 0.72, y: 0.78 },
    baseClearRadiusTiles: 3,
    spawnPoints: [
      { x: 0.1, y: 0.1 },
      { x: 0.15, y: 0.85 },
      { x: 0.4, y: 0.0 },
    ],
    gridObstacles: [
      { x: 4, y: 3, w: 3, h: 15 },
      { x: 9, y: 5, w: 3, h: 13 },
      { x: 14, y: 7, w: 3, h: 11 },
      { x: 19, y: 5, w: 3, h: 13 },
      { x: 10, y: 14, w: 10, h: 2 },
      { x: 6, y: 17, w: 16, h: 2 },
      { x: 16, y: 10, w: 2, h: 8 },
    ],
    obstacles: [
      { x: 0.3, y: 0.2, width: 0.05, height: 0.08 },
      { x: 0.45, y: 0.6, width: 0.04, height: 0.12 },
      { x: 0.6, y: 0.4, width: 0.05, height: 0.08 },
    ],
    initialEnergy: 11,
    maxEnergy: 30,
    energyRegenPerSecond: 0.48,
    randomObstacles: {
      count: 5,
      avoidRadiusAroundBase: 0.22,
      avoidRadiusAroundEntry: 0.12,
      avoidPathDistance: 0.06,
      minDistanceBetween: 0.08,
      maxAttemptsPerObstacle: 18,
    },
    waves: [
      { id: 1, delay: 0, enemies: [{ type: "normal", count: 12, interval: 1100 }] },
      {
        id: 2,
        delay: 4800,
        enemies: [
          { type: "normal", count: 12, interval: 1000 },
          { type: "courier", count: 2, interval: 1500 },
        ],
      },
      {
        id: 3,
        delay: 5000,
        enemies: [
          { type: "symbiote", count: 2, interval: 2100 },
          { type: "normal", count: 10, interval: 900 },
        ],
      },
      {
        id: 4,
        delay: 4800,
        enemies: [
          { type: "healer", count: 2, interval: 2000 },
          { type: "smart", count: 4, interval: 1200 },
        ],
      },
      {
        id: 5,
        delay: 4600,
        enemies: [
          { type: "banner", count: 2, interval: 2400 },
          { type: "symbiote", count: 3, interval: 1900 },
        ],
      },
      {
        id: 6,
        delay: 4600,
        enemies: [
          { type: "sprinter", count: 6, interval: 950 },
          { type: "devourer", count: 2, interval: 2200 },
        ],
      },
      {
        id: 7,
        delay: 4600,
        enemies: [
          { type: "script", count: 4, interval: 1600 },
          { type: "healer", count: 3, interval: 2000 },
          { type: "courier", count: 3, interval: 1500 },
        ],
      },
      {
        id: 8,
        delay: 4800,
        enemies: [
          { type: "symbiote", count: 3, interval: 1800 },
          { type: "smart", count: 4, interval: 1100 },
          { type: "normal", count: 16, interval: 850 },
        ],
      },
      {
        id: 9,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.2, speedMultiplier: 0.85 },
          { type: "symbiote", count: 3 },
          { type: "banner", count: 2 },
          { type: "smart", count: 4 },
          { type: "healer", count: 3 },
        ],
      },
    ],
    difficulty: 3,
    enemyTypes: ["普通", "冲刺", "共生体", "智能", "治疗", "信使", "脚本", "吞噬", "BANNER", "Boss"],
    recommended: "优先处理共生体与护盾怪",
    setupTimeSeconds: 12,
    previewPaths: [
      [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.25 },
        { x: 0.55, y: 0.45 },
        { x: 0.72, y: 0.78 },
      ],
      [
        { x: 0.15, y: 0.85 },
        { x: 0.35, y: 0.7 },
        { x: 0.6, y: 0.7 },
        { x: 0.72, y: 0.78 },
      ],
      [
        { x: 0.4, y: 0.0 },
        { x: 0.45, y: 0.3 },
        { x: 0.65, y: 0.5 },
        { x: 0.72, y: 0.78 },
      ],
    ],
  },

  {
    id: 6,
    name: "Level 6",
    description: "多方向来袭并伴随干扰者光环",
    backgroundClass: "map-theme-neon",
    mapPreset: "jammer-ring",
    mapSize: { width: 30, height: 24 },
    entryPosition: { x: 0.2, y: 0.05 },
    basePosition: { x: 0.2, y: 0.2 },
    baseClearRadiusTiles: 2,
    spawnPoints: [
      { x: 0.2, y: 0.0 },
      { x: 0.8, y: 0.15 },
      { x: 1.0, y: 0.55 },
      { x: 0.4, y: 1.0 },
    ],
    gridObstacles: [
      { x: 6, y: 2, w: 18, h: 2 },
      { x: 6, y: 6, w: 18, h: 2 },
      { x: 6, y: 10, w: 18, h: 2 },
      { x: 6, y: 14, w: 18, h: 2 },
      { x: 6, y: 2, w: 2, h: 14 },
      { x: 22, y: 2, w: 2, h: 14 },
      { x: 2, y: 10, w: 3, h: 6 },
      { x: 24, y: 6, w: 3, h: 10 },
    ],
    obstacles: [
      { x: 0.45, y: 0.35, width: 0.04, height: 0.08 },
      { x: 0.6, y: 0.55, width: 0.05, height: 0.12 },
      { x: 0.75, y: 0.25, width: 0.04, height: 0.08 },
    ],
    initialEnergy: 12,
    maxEnergy: 32,
    energyRegenPerSecond: 0.5,
    randomObstacles: {
      count: 5,
      avoidRadiusAroundBase: 0.24,
      avoidRadiusAroundEntry: 0.12,
      avoidPathDistance: 0.06,
      minDistanceBetween: 0.08,
      maxAttemptsPerObstacle: 18,
    },
    waves: [
      {
        id: 1,
        delay: 0,
        enemies: [
          { type: "normal", count: 14, interval: 1050 },
          { type: "sprinter", count: 2, interval: 1300 },
        ],
      },
      {
        id: 2,
        delay: 5000,
        enemies: [
          { type: "normal", count: 12, interval: 950 },
          { type: "script", count: 2, interval: 1900 },
        ],
      },
      {
        id: 3,
        delay: 4800,
        enemies: [
          { type: "smart", count: 3, interval: 1300 },
          { type: "normal", count: 12, interval: 900 },
        ],
      },
      {
        id: 4,
        delay: 4700,
        enemies: [
          { type: "devourer", count: 2, interval: 2200 },
          { type: "sprinter", count: 4, interval: 1100 },
        ],
      },
      {
        id: 5,
        delay: 4600,
        enemies: [
          { type: "jammer", count: 1, interval: 0 },
          { type: "script", count: 4, interval: 1700 },
          { type: "normal", count: 12, interval: 900 },
        ],
      },
      {
        id: 6,
        delay: 4600,
        enemies: [
          { type: "jammer", count: 2, interval: 3000 },
          { type: "sprinter", count: 6, interval: 950 },
          { type: "normal", count: 16, interval: 850 },
        ],
      },
      {
        id: 7,
        delay: 4800,
        enemies: [
          { type: "jammer", count: 2, interval: 2800 },
          { type: "script", count: 5, interval: 1500 },
          { type: "healer", count: 3, interval: 2000 },
        ],
      },
      {
        id: 8,
        delay: 4800,
        enemies: [
          { type: "symbiote", count: 3, interval: 2000 },
          { type: "banner", count: 2, interval: 2400 },
          { type: "smart", count: 4, interval: 1100 },
        ],
      },
      {
        id: 9,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.25, speedMultiplier: 0.8 },
          { type: "jammer", count: 2 },
          { type: "script", count: 4 },
          { type: "sprinter", count: 4 },
          { type: "healer", count: 3 },
        ],
      },
    ],
    difficulty: 3,
    enemyTypes: ["普通", "冲刺", "脚本", "智能", "吞噬", "干扰者", "共生体", "BANNER", "治疗", "Boss"],
    recommended: "优先点杀干扰者并保持多条退路，避免光环叠加拖慢整条防线。",
    setupTimeSeconds: 13,
    previewPaths: [
      [
        { x: 0.2, y: 0.0 },
        { x: 0.22, y: 0.18 },
        { x: 0.2, y: 0.2 },
      ],
      [
        { x: 0.8, y: 0.15 },
        { x: 0.55, y: 0.3 },
        { x: 0.35, y: 0.25 },
        { x: 0.2, y: 0.2 },
      ],
      [
        { x: 1.0, y: 0.55 },
        { x: 0.8, y: 0.55 },
        { x: 0.45, y: 0.4 },
        { x: 0.2, y: 0.2 },
      ],
      [
        { x: 0.4, y: 1.0 },
        { x: 0.35, y: 0.7 },
        { x: 0.25, y: 0.4 },
        { x: 0.2, y: 0.2 },
      ],
    ],
  },

  {
    id: 7,
    name: "Level 7",
    description: "只有一个紧凑的哨站，敌人全部是普通怪，考验布塔效率。",
    backgroundClass: "map-theme-oasis",
    mapPreset: "single-lane",
    mapSize: { width: 22, height: 18 },
    entryPosition: { x: 0.95, y: 0.5 },
    basePosition: { x: 0.18, y: 0.5 },
    baseClearRadiusTiles: 1,
    spawnPoints: [
      { x: 0.95, y: 0.25 },
      { x: 0.95, y: 0.75 },
    ],
    gridObstacles: [
      { x: 6, y: 1, w: 2, h: 16 },
      { x: 10, y: 1, w: 2, h: 16 },
      { x: 14, y: 1, w: 2, h: 16 },
      { x: 18, y: 3, w: 2, h: 12 },
    ],
    obstacles: [
      { x: 0.55, y: 0.2, width: 0.08, height: 0.08 },
      { x: 0.55, y: 0.6, width: 0.08, height: 0.08 },
    ],
    initialEnergy: 6,
    maxEnergy: 18,
    energyRegenPerSecond: 0.42,
    randomObstacles: {
      count: 3,
      avoidRadiusAroundBase: 0.18,
      avoidRadiusAroundEntry: 0.1,
      avoidPathDistance: 0.08,
      minDistanceBetween: 0.08,
      maxAttemptsPerObstacle: 12,
    },
    waves: [
      { id: 1, delay: 0, enemies: [{ type: "normal", count: 8, interval: 900 }] },
      { id: 2, delay: 3200, enemies: [{ type: "normal", count: 12, interval: 800 }] },
      { id: 3, delay: 3400, enemies: [{ type: "normal", count: 14, interval: 750 }] },
      { id: 4, delay: 3600, enemies: [{ type: "normal", count: 16, interval: 700 }] },
      { id: 5, delay: 3800, enemies: [{ type: "normal", count: 18, interval: 660 }] },
      { id: 6, delay: 4100, enemies: [{ type: "normal", count: 20, interval: 620 }] },
      { id: 7, delay: 4300, enemies: [{ type: "normal", count: 22, interval: 580 }] },
      { id: 8, delay: 0, enemies: [{ type: "normal", count: 24, interval: 540 }] },
    ],
    difficulty: 2,
    enemyTypes: ["普通"],
    recommended: "利用长直线路径堆叠火力，提早合成高阶塔卡。",
    setupTimeSeconds: 8,
    previewPaths: [
      [
        { x: 0.95, y: 0.25 },
        { x: 0.6, y: 0.25 },
        { x: 0.18, y: 0.5 },
      ],
      [
        { x: 0.95, y: 0.75 },
        { x: 0.6, y: 0.75 },
        { x: 0.18, y: 0.5 },
      ],
    ],
  },
  {
    id: 8,
    name: "Level 8",
    description: "固定迷宫走廊迫使敌人绕行，善用转角火力覆盖长路径。",
    backgroundClass: "map-theme-labyrinth",
    mapPreset: "labyrinth-core",
    mapSize: { width: 30, height: 24 },
    entryPosition: { x: 0.05, y: 0.1 },
    basePosition: { x: 0.75, y: 0.8 },
    baseClearRadiusTiles: 3,
    spawnPoints: [
      { x: 0.05, y: 0.1 },
      { x: 0.05, y: 0.9 },
      { x: 0.35, y: 0.0 },
      { x: 0.35, y: 1.0 },
    ],
    gridObstacles: [
      { x: 4, y: 2, w: 3, h: 18 },
      { x: 9, y: 0, w: 3, h: 20 },
      { x: 15, y: 4, w: 3, h: 18 },
      { x: 21, y: 2, w: 3, h: 16 },
      { x: 12, y: 8, w: 10, h: 3 },
      { x: 2, y: 10, w: 8, h: 3 },
      { x: 20, y: 14, w: 6, h: 3 },
      { x: 8, y: 16, w: 12, h: 3 },
    ],
    obstacles: [
      { x: 0.25, y: 0.2, width: 0.05, height: 0.08 },
      { x: 0.55, y: 0.45, width: 0.05, height: 0.1 },
      { x: 0.7, y: 0.65, width: 0.08, height: 0.05 },
    ],
    initialEnergy: 9,
    maxEnergy: 28,
    energyRegenPerSecond: 0.48,
    randomObstacles: {
      count: 7,
      avoidRadiusAroundBase: 0.2,
      avoidRadiusAroundEntry: 0.12,
      avoidPathDistance: 0.08,
      minDistanceBetween: 0.08,
      maxAttemptsPerObstacle: 20,
    },
    waves: [
      { id: 1, delay: 0, enemies: [{ type: "normal", count: 16, interval: 850 }] },
      {
        id: 2,
        delay: 3600,
        enemies: [
          { type: "normal", count: 14, interval: 750 },
          { type: "sprinter", count: 4, interval: 1100 },
        ],
      },
      {
        id: 3,
        delay: 4000,
        enemies: [
          { type: "banner", count: 2, interval: 2500 },
          { type: "devourer", count: 2, interval: 2200 },
        ],
      },
      {
        id: 4,
        delay: 4200,
        enemies: [
          { type: "script", count: 4, interval: 1600 },
          { type: "smart", count: 3, interval: 1300 },
          { type: "healer", count: 2, interval: 2000 },
        ],
      },
      {
        id: 5,
        delay: 4400,
        enemies: [
          { type: "normal", count: 18, interval: 650 },
          { type: "sprinter", count: 6, interval: 950 },
        ],
      },
      {
        id: 6,
        delay: 4600,
        enemies: [
          { type: "banner", count: 3, interval: 2300 },
          { type: "smart", count: 3, interval: 1200 },
        ],
      },
      {
        id: 7,
        delay: 4800,
        enemies: [
          { type: "script", count: 5, interval: 1500 },
          { type: "devourer", count: 3, interval: 2100 },
          { type: "healer", count: 3, interval: 2000 },
        ],
      },
      {
        id: 8,
        delay: 5000,
        enemies: [
          { type: "normal", count: 24, interval: 600 },
          { type: "smart", count: 4, interval: 1100 },
        ],
      },
      {
        id: 9,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.28, speedMultiplier: 0.8 },
          { type: "normal", count: 20 },
          { type: "script", count: 5 },
          { type: "devourer", count: 3 },
          { type: "smart", count: 4 },
          { type: "healer", count: 3 },
        ],
      },
    ],
    difficulty: 3,
    enemyTypes: ["普通", "冲刺", "BANNER", "SCRIPT", "吞噬", "智能", "治疗", "Boss"],
    recommended: "在迷宫弯道布置范围塔并善用减速类卡牌。",
    setupTimeSeconds: 14,
    previewPaths: [
      [
        { x: 0.05, y: 0.1 },
        { x: 0.2, y: 0.15 },
        { x: 0.5, y: 0.45 },
        { x: 0.75, y: 0.8 },
      ],
      [
        { x: 0.05, y: 0.9 },
        { x: 0.2, y: 0.85 },
        { x: 0.55, y: 0.65 },
        { x: 0.75, y: 0.8 },
      ],
      [
        { x: 0.35, y: 0.0 },
        { x: 0.4, y: 0.25 },
        { x: 0.6, y: 0.5 },
        { x: 0.75, y: 0.8 },
      ],
      [
        { x: 0.35, y: 1.0 },
        { x: 0.45, y: 0.75 },
        { x: 0.65, y: 0.6 },
        { x: 0.75, y: 0.8 },
      ],
    ],
  },
  {
    id: 9,
    name: "Level 9",
    description: "O.o",
    backgroundClass: "map-theme-neon",
    mapPreset: "ring-hold",
    mapSize: { width: 28, height: 22 },
    entryPosition: { x: 0.5, y: 0 },
    basePosition: { x: 0.18, y: 0.18 },
    baseClearRadiusTiles: 2,
    spawnPoints: [
      { x: 0.5, y: 0.0 },
      { x: 1.0, y: 0.4 },
      { x: 1.0, y: 0.9 },
    ],
    gridObstacles: [
      { x: 8, y: 4, w: 12, h: 2 },
      { x: 8, y: 8, w: 12, h: 2 },
      { x: 8, y: 12, w: 12, h: 2 },
      { x: 8, y: 4, w: 2, h: 10 },
      { x: 18, y: 4, w: 2, h: 10 },
      { x: 4, y: 10, w: 3, h: 6 },
      { x: 22, y: 2, w: 3, h: 14 },
    ],
    obstacles: [
      { x: 0.4, y: 0.4, width: 0.05, height: 0.05 },
      { x: 0.58, y: 0.6, width: 0.06, height: 0.04 },
      { x: 0.7, y: 0.3, width: 0.04, height: 0.08 },
    ],
    initialEnergy: 10,
    maxEnergy: 32,
    energyRegenPerSecond: 0.5,
    randomObstacles: {
      count: 6,
      avoidRadiusAroundBase: 0.22,
      avoidRadiusAroundEntry: 0.12,
      avoidPathDistance: 0.07,
      minDistanceBetween: 0.08,
      maxAttemptsPerObstacle: 18,
    },
    waves: [
      {
        id: 1,
        delay: 0,
        enemies: [
          { type: "normal", count: 14, interval: 800 },
          { type: "sprinter", count: 4, interval: 1100 },
        ],
      },
      {
        id: 2,
        delay: 3600,
        enemies: [
          { type: "banner", count: 2, interval: 2400 },
          { type: "script", count: 3, interval: 1700 },
        ],
      },
      {
        id: 3,
        delay: 3800,
        enemies: [
          { type: "smart", count: 3, interval: 1400 },
          { type: "healer", count: 2, interval: 2000 },
        ],
      },
      {
        id: 4,
        delay: 4200,
        enemies: [
          { type: "sprinter", count: 6, interval: 900 },
          { type: "normal", count: 16, interval: 650 },
        ],
      },
      {
        id: 5,
        delay: 4500,
        enemies: [
          { type: "devourer", count: 3, interval: 2100 },
          { type: "script", count: 4, interval: 1600 },
        ],
      },
      {
        id: 6,
        delay: 4600,
        enemies: [
          { type: "banner", count: 3, interval: 2300 },
          { type: "smart", count: 4, interval: 1200 },
          { type: "healer", count: 3, interval: 1900 },
        ],
      },
      {
        id: 7,
        delay: 4800,
        enemies: [
          { type: "normal", count: 20, interval: 600 },
          { type: "sprinter", count: 8, interval: 850 },
        ],
      },
      {
        id: 8,
        delay: 5000,
        enemies: [
          { type: "script", count: 6, interval: 1500 },
          { type: "devourer", count: 3, interval: 2000 },
          { type: "healer", count: 3, interval: 1800 },
        ],
      },
      {
        id: 9,
        delay: 0,
        enemies: [
          { type: "boss", count: 1, interval: 0, hpMultiplier: 1.35, speedMultiplier: 0.8 },
          { type: "normal", count: 24 },
          { type: "sprinter", count: 6 },
          { type: "script", count: 5 },
          { type: "smart", count: 4 },
          { type: "healer", count: 4 },
        ],
      },
    ],
    difficulty: 3,
    enemyTypes: ["普通", "冲刺", "BANNER", "SCRIPT", "吞噬", "智能", "治疗", "Boss"],
    recommended: "把基地周围当作据点，利用分岔路与多方向火力守住角落。",
    setupTimeSeconds: 15,
    previewPaths: [
      [
        { x: 0.5, y: 0.0 },
        { x: 0.5, y: 0.25 },
        { x: 0.3, y: 0.3 },
        { x: 0.18, y: 0.18 },
      ],
      [
        { x: 1.0, y: 0.4 },
        { x: 0.8, y: 0.4 },
        { x: 0.5, y: 0.35 },
        { x: 0.18, y: 0.18 },
      ],
      [
        { x: 1.0, y: 0.9 },
        { x: 0.8, y: 0.8 },
        { x: 0.45, y: 0.5 },
        { x: 0.18, y: 0.18 },
      ],
    ],
  },
];

/**
 * HUD 布局常量
 * 集中管理所有布局相关的尺寸，方便后续调参
 */
export const HUD_LAYOUT = {
  /** 顶部状态栏高度（像素） */
  TOP_BAR_HEIGHT: 52,
  /** 底部控制栏高度（像素） */
  BOTTOM_PANEL_HEIGHT: 80,
  /** 右侧道具栏宽度（像素） */
  RIGHT_ITEM_PANEL_WIDTH: 80,
  /** 道具槽位大小（像素） */
  ITEM_SLOT_SIZE: 56,
  /** 道具槽位间距（像素） */
  ITEM_SLOT_GAP: 8,
};

/**
 * 計算指定關卡的總敵人數
 * @param {typeof LEVELS[0]} level 關卡配置對象
 * @returns {number} 該關卡所有波次中敵人的總數量
 */
export function getTotalEnemiesForLevel(level) {
  let total = 0;
  for (const wave of level.waves) {
    for (const group of wave.enemies) {
      total += group.count;
    }
  }
  return total;
}


