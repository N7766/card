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
export const INITIAL_ENERGY = 5;

/**
 * 能量上限
 * @type {number}
 */
export const MAX_ENERGY = 20;

/**
 * 每秒能量恢復速度
 * @type {number}
 */
export const ENERGY_REGEN_PER_SECOND = 2;

/**
 * 塔攻擊獲取範圍系數（基於 DOM 中心距離）
 * @type {number}
 */
export const RANGE_UNIT = 1;

/**
 * 基地半徑（像素，用於判斷敵人是否到達基地）
 * @type {number}
 */
export const BASE_RADIUS = 55;

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
 * 敌人基礎屬性配置
 * 
 * 统一的敌人配置系统，包含所有敌人类型的基础属性和特殊行为参数
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
  normal: {
    maxHp: 40,
    moveSpeed: 80, // 像素/秒
    armor: 0, // 傷害減免（0-1之間的小數，例如0.1表示減免10%傷害）
    damageToBase: 1,
    specialBehavior: null, // 普通怪無特殊行為
  },
  sprinter: {
    maxHp: 35,
    moveSpeed: 70, // 平時速度，略低於普通怪
    armor: 0,
    damageToBase: 1,
    specialBehavior: {
      sprintCooldown: 4000, // 冲刺冷却時間（毫秒）
      sprintDuration: 1500, // 冲刺持續時間（毫秒）
      sprintSpeedMultiplier: 2.5, // 冲刺時速度倍率
      baseSpeed: 70, // 基礎速度（平時）
    },
  },
  devourer: {
    maxHp: 60,
    moveSpeed: 55, // 初始中等速度
    armor: 0,
    damageToBase: 2,
    specialBehavior: {
      devourRadius: 50, // 吞噬感知範圍（像素）
      devourHpGain: 30, // 每次吞噬恢復的血量
      devourSpeedLoss: 5, // 每次吞噬速度減少（像素/秒）
      devourSizeGain: 0.15, // 每次吞噬體型增加比例（0.15 = 15%）
      maxDevours: 5, // 最大吞噬次數（防止無限增長）
    },
  },
  smart: {
    maxHp: 50,
    moveSpeed: 65, // 中等速度
    armor: 0,
    damageToBase: 2,
    specialBehavior: {
      dangerWeight: 8, // 危險度權重（格子附近每座塔增加的成本）
      dangerRadius: 2, // 危險度計算半徑（格子數，檢查周圍NxN區域）
    },
  },
  healer: {
    maxHp: 30, // 低血量，很脆
    moveSpeed: 60,
    armor: 0,
    damageToBase: 1,
    specialBehavior: {
      healInterval: 3000, // 治療間隔（毫秒）
      healAmount: 15, // 每次治療量
      healRadius: 80, // 治療範圍（像素）
    },
  },
  // 保留舊類型作為兼容（映射到新系統）
  ad: {
    maxHp: 26,
    moveSpeed: 95,
    armor: 0,
    damageToBase: 1,
    specialBehavior: null,
  },
  banner: {
    maxHp: 140,
    moveSpeed: 45,
    armor: 0,
    damageToBase: 3,
    specialBehavior: null,
  },
  script: {
    maxHp: 70,
    moveSpeed: 70,
    armor: 0,
    damageToBase: 2,
    specialBehavior: null,
  },
};

/**
 * 敌人基礎屬性配置（保留舊接口以兼容現有代碼）
 * @deprecated 使用 ENEMY_CONFIGS 代替
 */
export const ENEMY_STATS = {
  ad: {
    speed: ENEMY_CONFIGS.ad.moveSpeed,
    hp: ENEMY_CONFIGS.ad.maxHp,
  },
  banner: {
    speed: ENEMY_CONFIGS.banner.moveSpeed,
    hp: ENEMY_CONFIGS.banner.maxHp,
  },
  script: {
    speed: ENEMY_CONFIGS.script.moveSpeed,
    hp: ENEMY_CONFIGS.script.maxHp,
  },
};

/**
 * 塔基礎屬性配置
 *
 * 設計意圖：
 * - div 塔：中射速、中傷害、中射程，作為穩定主力輸出。
 * - button 塔：低射速、高傷害、中短射程，適合放在路徑近處專門擊殺高血怪。
 * - img 塔：攻速較低、範圍傷害、高射程但 Cost 較貴，用於覆蓋大片區域清理小怪。
 */
export const TOWER_STATS = {
  div: {
    range: 150,
    damage: 18,
    attackInterval: 750, // 中等攻速
  },
  button: {
    range: 115,
    damage: 38,
    attackInterval: 1250, // 較慢攻速，換取更高單發傷害
  },
  img: {
    range: 200,
    damage: 20,
    attackInterval: 1400, // 偏慢，但具備範圍輸出
    aoe: true,
  },
};

/**
 * 單位敵人到達基地時扣除的基地生命
 */
export const ENEMY_DAMAGE_TO_BASE = {
  normal: ENEMY_CONFIGS.normal.damageToBase,
  sprinter: ENEMY_CONFIGS.sprinter.damageToBase,
  devourer: ENEMY_CONFIGS.devourer.damageToBase,
  smart: ENEMY_CONFIGS.smart.damageToBase,
  healer: ENEMY_CONFIGS.healer.damageToBase,
  // 保留舊類型兼容
  ad: ENEMY_CONFIGS.ad.damageToBase,
  banner: ENEMY_CONFIGS.banner.damageToBase,
  script: ENEMY_CONFIGS.script.damageToBase,
};

/**
 * 波次配置（保留作为默认配置，关卡中可复用）
 * 每一波描述要生成的敵人類型和數量，以及生成間隔和進入下一波前的延遲。
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
    delayAfter: 2500,
  },
  {
    id: 2,
    // 稍微增加 AD 數量與生成頻率，仍然以熟悉遊戲為主
    enemies: [{ type: "ad", count: 9, interval: 1000 }],
    delayAfter: 2800,
  },
  {
    id: 3,
    // 加入少量 BANNER，提示玩家需要高傷害塔處理坦克
    enemies: [
      { type: "ad", count: 8, interval: 900 },
      { type: "banner", count: 1, interval: 2600 },
    ],
    delayAfter: 3200,
  },
  {
    id: 4,
    // 混合更多 BANNER 與 AD，整體壓力上升
    enemies: [
      { type: "banner", count: 2, interval: 2600 },
      { type: "ad", count: 12, interval: 800 },
    ],
    delayAfter: 3600,
  },
  {
    id: 5,
    // 引入 SCRIPT 腳本怪，中速移動並干擾塔，作為中後期挑戰
    enemies: [
      { type: "ad", count: 12, interval: 750 },
      { type: "script", count: 3, interval: 2200 },
      { type: "banner", count: 2, interval: 2600 },
    ],
    delayAfter: 4200,
  },
];

/**
 * 關卡配置數組
 * 每個關卡包含：名稱、背景主題、BASE位置、敵人出生點、波次配置
 */
export const LEVELS = [
  {
    id: 1,
    name: "Level 1 · 入門訓練",
    backgroundClass: "map-theme-default",
    basePosition: { x: 0.5, y: 0.85 }, // BASE 在底部中央
    spawnPoints: [
      { x: 0.1, y: 0.1 }, // 左上
      { x: 0.9, y: 0.1 }, // 右上
    ],
    obstacles: [
      // 簡單的障礙物，形成基本的通道
      { x: 0.4, y: 0.4, width: 0.12, height: 0.03 },
      { x: 0.55, y: 0.55, width: 0.18, height: 0.03 },
    ],
    waves: [
      {
        id: 1,
        enemies: [{ type: "normal", count: 5, interval: 1300 }],
        delayAfter: 2500,
      },
      {
        id: 2,
        enemies: [
          { type: "normal", count: 6, interval: 1000 },
          { type: "sprinter", count: 2, interval: 2000 },
        ],
        delayAfter: 2800,
      },
    ],
    difficulty: 1, // 难度星级 1~3
    enemyTypes: ["普通", "冲刺"], // 敌人类型
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
    name: "Level 2 · 四面楚歌",
    backgroundClass: "map-theme-cross",
    basePosition: { x: 0.5, y: 0.5 }, // BASE 在中央
    spawnPoints: [
      { x: 0.1, y: 0.1 }, // 左上
      { x: 0.9, y: 0.1 }, // 右上
      { x: 0.1, y: 0.9 }, // 左下
      { x: 0.9, y: 0.9 }, // 右下
    ],
    obstacles: [
      // 用幾條牆組成曲折通道，讓路線差異明顯
      { x: 0.25, y: 0.15, width: 0.02, height: 0.7 },
      { x: 0.45, y: 0.0, width: 0.02, height: 0.65 },
      { x: 0.65, y: 0.35, width: 0.02, height: 0.65 },
      { x: 0.75, y: 0.0, width: 0.02, height: 0.4 },
    ],
    waves: [
      {
        id: 1,
        enemies: [
          { type: "ad", count: 8, interval: 900 },
          { type: "banner", count: 1, interval: 2600 },
        ],
        delayAfter: 3200,
      },
      {
        id: 2,
        enemies: [
          { type: "banner", count: 2, interval: 2600 },
          { type: "ad", count: 12, interval: 800 },
        ],
        delayAfter: 3600,
      },
      {
        id: 3,
        enemies: [
          { type: "ad", count: 10, interval: 750 },
          { type: "script", count: 2, interval: 2200 },
          { type: "banner", count: 2, interval: 2600 },
          { type: "devourer", count: 1, interval: 3000 },
          { type: "healer", count: 1, interval: 4000 },
        ],
        delayAfter: 4200,
      },
    ],
    difficulty: 2, // 难度星级
    enemyTypes: ["AD", "BANNER", "SCRIPT", "吞噬", "治疗"], // 敌人类型
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
    name: "Level 3 · 終極挑戰",
    backgroundClass: "map-theme-dark",
    basePosition: { x: 0.5, y: 0.7 }, // BASE 在中下
    spawnPoints: [
      { x: 0.0, y: 0.0 }, // 左上角
      { x: 1.0, y: 0.0 }, // 右上角
      { x: 0.0, y: 0.5 }, // 左中
      { x: 1.0, y: 0.5 }, // 右中
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
    waves: [
      {
        id: 1,
        enemies: [
          { type: "ad", count: 10, interval: 800 },
          { type: "banner", count: 2, interval: 2400 },
        ],
        delayAfter: 3000,
      },
      {
        id: 2,
        enemies: [
          { type: "script", count: 3, interval: 2000 },
          { type: "ad", count: 15, interval: 700 },
        ],
        delayAfter: 3500,
      },
      {
        id: 3,
        enemies: [
          { type: "banner", count: 2, interval: 2500 },
          { type: "script", count: 3, interval: 2100 },
          { type: "ad", count: 12, interval: 650 },
          { type: "smart", count: 2, interval: 2800 },
          { type: "devourer", count: 1, interval: 3500 },
          { type: "healer", count: 2, interval: 4000 },
        ],
        delayAfter: 4500,
      },
    ],
    difficulty: 3, // 难度星级
    enemyTypes: ["AD", "BANNER", "SCRIPT", "智能", "吞噬", "治疗"], // 敌人类型
    recommended: "终极挑战！合理使用布局卡和样式卡，多放范围伤害塔", // 推荐玩法提示
    setupTimeSeconds: 15, // 布置时间（秒）
    previewPaths: [
      // 复杂路径预览
      [
        { x: 0.0, y: 0.0 },
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.5 },
        { x: 0.5, y: 0.7 },
      ],
      [
        { x: 1.0, y: 0.0 },
        { x: 0.8, y: 0.2 },
        { x: 0.6, y: 0.5 },
        { x: 0.5, y: 0.7 },
      ],
      [
        { x: 0.0, y: 0.5 },
        { x: 0.3, y: 0.5 },
        { x: 0.5, y: 0.7 },
      ],
      [
        { x: 1.0, y: 0.5 },
        { x: 0.7, y: 0.55 },
        { x: 0.5, y: 0.7 },
      ],
    ],
  },
];

/**
 * 長時間暫停後自動返回主菜單的時間閾值（毫秒）
 * 當遊戲暫停時間超過此值時，會自動返回主菜單
 * @type {number}
 */
export const AUTO_BACK_TO_MENU_MS = 60000; // 60秒

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


