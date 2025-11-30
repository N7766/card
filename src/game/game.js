/**
 * game 模組：核心遊戲循環與狀態管理。
 * - 管理塔與敵人列表
 * - 波次生成與勝負判定
 * - 卡牌出牌交互與暫停/繼續
 */

/**
 * TODO：本輪迭代前的可見/潛在問題清單（簡要摘要）
 * 1）交互與反饋不足：
 *    - 手牌僅有選中邊框，能量不足時沒有禁用/提示，玩家容易誤點。
 *    - 塔攻擊與敵人受擊沒有明顯動效，難以感知輸出與壓力。
 *    - 波次開始/清空缺少明確提示，只能從波數文字推測。
 *
 * 2）信息可讀性：
 *    - 塔的攻擊範圍不可視，佈局與卡牌選擇較依賴猜測。
 *    - 敵人血條雖有，但缺少平滑變化與受擊提示。
 *
 * 3）節奏與體驗：
 *    - 缺少 1x/2x 速度切換，無法在「體驗前期」「加速刷後期」之間自由切換。
 *    - 波次配置前幾波偏密集，新手容易一開始就被壓制。
 *
 * 4）結構與維護性：
 *    - UI 相關更新大多集中在 ui.js，但手牌能量狀態尚未統一托管。
 *    - 攻擊/受擊等視覺反饋與邏輯交織在一起，可適度封裝輕量效果函數。
 */

import {
  INITIAL_BASE_HP,
  INITIAL_ENERGY,
  MAX_ENERGY,
  ENERGY_REGEN_PER_SECOND,
  LEVELS,
  ENEMY_TYPES,
} from "./config.js";
import { getInitialHand } from "./cards.js";
import {
  uiElements,
  bindControlButtons,
  updateHp,
  updateEnergy,
  updateWave,
  updateBestRecord,
  renderHandCards,
  showStartScreen,
  hideStartScreen,
  showVictory,
  showDefeat,
  hideResultOverlays,
  flashCardInsufficient,
  updatePauseButton,
  updateSpeedButton,
  updateHandEnergyState,
  showWaveToast,
  updateBasePosition,
  updateLevelInfo,
  updateEnemyProgress,
  updateBattleProgress,
  showLevelComplete,
  hideLevelComplete,
  showLevelIntroBubble,
  updateActiveBuffs,
  showPathPreview,
  hidePathPreview,
  highlightObstacles,
  unhighlightObstacles,
  showBossStatusBar,
  updateBossHpBar,
  hideBossStatusBar,
  initAdaptiveBattlefield,
  clientPointToFieldCoords,
  getFieldDimensions,
  getBaseLogicalPosition,
  showBaseAlert,
  notifyBattlefieldSizeChanged,
} from "./ui.js";
import { createTower, applyStyleCardToTower } from "./tower.js";
import {
  spawnEnemy,
  updateEnemies,
  recalculateAllEnemyPaths,
  applyDamageToEnemy,
} from "./enemy.js";
import {
  createBullet,
  updateBullet,
  checkBulletHit,
  playBulletHitEffect,
  cleanupBullets,
} from "./bullet.js";
import { ItemManager } from "./items.js";
import { loadBestRecord, saveBestRecord, markEverWon } from "./storage.js";
import { TOWER_WIDTH, TOWER_HEIGHT, BASE_RADIUS } from "./config.js";
import { pixelToGrid, gridToPixel, findPath, hasPath, GRID_CONFIG } from "./pathfinding.js";
import { featureFlags } from "./featureFlags.js";
import {
  initDebugMode,
  toggleDebugMode,
  getDebugMode,
  updateEnemyPaths,
  renderGridMarkers,
  checkEnemyCollision,
  updateTowerPlacementPreview,
  clearTowerPlacementPreview,
} from "./debug.js";

/** @typedef {import("./tower.js").Tower} Tower */
/** @typedef {import("./enemy.js").Enemy} Enemy */
/** @typedef {import("./cards.js").Card} Card */

/**
 * @typedef {Object} GameState
 * @property {Tower[]} towers
 * @property {Enemy[]} enemies
 * @property {number} baseHp
 * @property {number} maxBaseHp
 * @property {number} energy
 * @property {number} maxEnergy
 * @property {number} currentWaveIndex 當前波索引（0 開始）
 * @property {boolean} running 是否正在運行
 * @property {boolean} paused 是否暫停
 * @property {"menu"|"setup"|"battle"|"paused"} phase 遊戲階段：menu=主菜單，setup=布置階段，battle=戰鬥階段，paused=暫停
 * @property {Card[]} handCards
 * @property {number} lastFrameTime 上一幀時間戳（毫秒）
 * @property {boolean} isSpawningWave 當前是否正在生成該波敵人
 * @property {boolean} waveSpawnFinished 當前波是否已全部生成
 * @property {boolean} isWaveCleared 當前波敵人是否已清空
 * @property {number} spawnCursor 當前波中正在處理的敵人組索引
 * @property {number} spawnedInCurrentGroup 當前敵人組已生成數量
 * @property {number} timeSinceLastSpawn 當前組距上一個敵人生成的時間
 * @property {number} waveClearDelayRemaining 下一波開始前剩餘延遲時間
 * @property {number} logicTime 遊戲邏輯時間（毫秒，用於與可調速度掛鉤）
 * @property {number} speedMultiplier 遊戲速度倍率（1 表示正常，2 表示 2 倍速）
 * @property {number} currentLevelIndex 當前關卡索引（0 開始）
 * @property {number} enemiesKilledInLevel 本關已擊殺敵人數
 * @property {number} totalEnemiesInLevel 本關總敵人數
 * @property {Array} currentLevelWaves 當前關卡的波次配置
 * @property {string | null} activeBossId 當前場上 Boss 的 ID
 * @property {number | null} pauseStartTime 暫停開始的時間戳（毫秒），null 表示未暫停或已恢復
 * @property {Array} bullets 當前所有存活的子彈
 * @property {{
 *   width:number,
 *   height:number,
 *   tileSize:number,
 *   gridObstacles:Array<{x:number,y:number,w:number,h:number,source?:string}>,
 *   blockedGrid:boolean[][],
 *   spawnGrids:Array<{row:number,col:number}>,
 *   spawnRatios:Array<{x:number,y:number}>,
 *   baseGrid:{row:number,col:number},
 *   baseRatio:{x:number,y:number},
 *   previewPaths:Array<Array<{x:number,y:number}>>
 * } | null} map 地圖狀態
 * @property {(options:{x:number,y:number,width?:number,height?:number,source?:string,ensurePath?:boolean}) => {success: boolean, reason?: string}} [addPermanentObstacle]
 * @property {ItemManager} itemManager 道具管理器
 * @property {{shieldRatio?:number}} nextWaveModifiers
 * @property {{shieldRatio?:number}} activeWaveModifiers
 */

/** @type {GameState | null} */
let state = null;

/** @type {number | null} */
let animationFrameId = null;

let lastBossTowerToast = 0;

const MIN_WAVES_PER_LEVEL = 7;
const DEFAULT_GROUP_INTERVAL_MS = 900;
const MIN_GROUP_INTERVAL_MS = 250;
const DEFAULT_WAVE_DELAY_MS = 3500;
const COURIER_SHIELD_RATIO = 0.35;
const COURIER_SHIELD_RATIO_MAX = 0.75;
const JAMMER_SLOW_CAP = 2.8;

/**
 * 深拷貝並校驗關卡波次配置，確保至少具備 MIN_WAVES_PER_LEVEL 波。
 * @param {typeof LEVELS[0]} level
 * @returns {Array<{id:number, delay:number, enemies:Array}>}
 */
function sanitizeLevelWaves(level) {
  const waves = Array.isArray(level?.waves) ? level.waves : [];
  const sanitized = waves.map((wave, index) => sanitizeSingleWave(wave, index));

  if (sanitized.length === 0) {
    console.warn(`[wave] 關卡 ${level.name} 缺少波次配置，將使用空陣列。`);
    return sanitized;
  }

  if (sanitized.length < MIN_WAVES_PER_LEVEL) {
    const lastWave = sanitized[sanitized.length - 1];
    while (sanitized.length < MIN_WAVES_PER_LEVEL) {
      const nextIndex = sanitized.length;
      sanitized.push({
        id: nextIndex + 1,
        delay: lastWave.delay,
        enemies: lastWave.enemies.map((group) => ({ ...group })),
      });
    }
    console.warn(
      `[wave] 關卡 ${level.name} 波數不足 ${MIN_WAVES_PER_LEVEL} 波，已自動補齊。`
    );
  }

  return sanitized;
}

/**
 * @param {any} wave
 * @param {number} index
 */
function sanitizeSingleWave(wave, index) {
  const enemies = Array.isArray(wave?.enemies)
    ? wave.enemies.map((group) => sanitizeEnemyGroup(group)).filter(Boolean)
    : [];

  return {
    id: wave?.id ?? index + 1,
    delay: resolveWaveDelay(wave),
    enemies,
  };
}

/**
 * @param {any} group
 */
function sanitizeEnemyGroup(group) {
  if (!group) return null;
  const count = Number(group.count) || 0;
  if (count <= 0) return null;

  return {
    type: group.type || "normal",
    count,
    interval: resolveGroupInterval(group.interval),
    hpMultiplier: group.hpMultiplier ?? 1,
    speedMultiplier: group.speedMultiplier ?? 1,
  };
}

function resolveGroupInterval(interval) {
  if (typeof interval !== "number" || Number.isNaN(interval)) {
    return DEFAULT_GROUP_INTERVAL_MS;
  }
  return Math.max(MIN_GROUP_INTERVAL_MS, interval);
}

function resolveWaveDelay(wave) {
  if (!wave) return DEFAULT_WAVE_DELAY_MS;
  const delayValue =
    typeof wave.delay === "number"
      ? wave.delay
      : typeof wave.delayAfter === "number"
      ? wave.delayAfter
      : DEFAULT_WAVE_DELAY_MS;
  return Math.max(0, delayValue);
}

/**
 * @param {Array<{enemies:Array<{count:number}>}>} waves
 */
function countEnemiesInWaves(waves) {
  let total = 0;
  for (const wave of waves) {
    for (const group of wave.enemies) {
      total += group.count;
    }
  }
  return total;
}

/**
 * 返回主菜单，清理当前游戏状态。
 */
export function backToMainMenu() {
  // 停止游戏循环
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 停止游戏运行
  if (state) {
    state.running = false;
    state.paused = false;
    state.phase = "menu";
  }

  // 清空所有塔与敌人 DOM
  clearFieldDom();

  // 清空状态数组
  if (state) {
    state.towers = [];
    state.enemies = [];
    if (state.itemManager) {
      state.itemManager.cleanup();
    }
  }

  // 重置选中状态
  selectedAction = null;
  removeTowerPreview();

  // 隐藏所有覆盖层
  hideResultOverlays();
  hideLevelComplete();
  hideBossStatusBar();
  
  // 显示开始界面
  showStartScreen();
  
  // 重置状态为 null，确保重新开始是干净的一局
  state = null;
}

/** 當前選中的卡牌及其使用模式 */
/**
 * @typedef {"place-tower"|"layout-field"|"target-tower"} SelectionMode
 */

/**
 * @typedef {Object} SelectedAction
 * @property {Card} card
 * @property {SelectionMode} mode
 */

/** @type {SelectedAction | null} */
let selectedAction = null;

/** 塔放置預覽元素 */
/** @type {HTMLElement | null} */
let towerPreviewEl = null;

/** 塔攻擊範圍顯示元素 */
/** @type {HTMLElement | null} */
let towerRangeEl = null;

/** 最近一次鼠標在戰場中的座標，用於放置塔 */
const lastMousePos = { x: 0, y: 0 };

/** 當前關卡的出生點配置（用於敵人生成） */
let currentSpawnPoints = [];

/** 當前已激活的布局卡buff列表 */
let activeLayoutBuffs = [];

/**
 * 调试函数已移除，正式版本不暴露调试接口
 * 如需调试，请在开发环境中使用浏览器开发者工具
 */

/**
 * 初始化遊戲，綁定 UI 事件並顯示開始界面。
 */
export function initGame() {
  try {
    const best = loadBestRecord();
    updateBestRecord(best);
  } catch (error) {
    console.error("[initGame] 加载存档失败：", error);
    // 继续执行，使用默认值
  }
  
  try {

  // 初始化调试模式（保留功能，但移除UI按钮）
  const isDebug = initDebugMode();

  initAdaptiveBattlefield();

  bindControlButtons({
    onStart: () => {
      // 從開始界面獲取選中的關卡索引，默認為 0
      const selectedLevel = getSelectedLevelIndex();
      startGame(selectedLevel);
    },
    onTogglePause: () => {
      togglePause();
    },
    onRestart: () => {
      // 重試當前關卡
      if (state) {
        startGame(state.currentLevelIndex);
      } else {
        startGame(0);
      }
    },
    onToggleSpeed: () => {
      toggleSpeed();
    },
    onNextLevel: () => {
      if (state && state.currentLevelIndex < LEVELS.length - 1) {
        startGame(state.currentLevelIndex + 1);
      }
    },
    onRetryLevel: () => {
      if (state) {
        startGame(state.currentLevelIndex);
      }
    },
    onBackToStart: () => {
      showStartScreen();
      hideResultOverlays();
      hideLevelComplete();
      state = null;
    },
    onBackToMenu: () => {
      backToMainMenu();
    },
  });

  // 戰場鼠標移動與點擊，用於處理塔放置與卡牌目標選擇
  uiElements.gameField.addEventListener("mousemove", handleFieldMouseMove);
  uiElements.gameField.addEventListener("click", handleFieldClick);

    // 初次進入顯示開始界面
    showStartScreen();
    updatePauseButton(false);
  } catch (error) {
    console.error("[initGame] 初始化失败：", error);
    // 显示错误信息
    const errorEl = document.getElementById("game-error");
    if (errorEl) {
      errorEl.textContent = `游戏初始化失败：${error.message || error}。请打开控制台查看详细错误。`;
      errorEl.style.display = "block";
    }
    throw error; // 重新抛出错误，让上层处理
  }
}

/**
 * 創建新的遊戲狀態。
 * @param {number} levelIndex 關卡索引
 * @returns {GameState}
 */
function createInitialState(levelIndex) {
  const level = LEVELS[levelIndex];
  const sanitizedWaves = sanitizeLevelWaves(level);
  const totalEnemies = countEnemiesInWaves(sanitizedWaves);
  
  // 使用关卡配置中的能量设置，如果没有则使用默认值
  const initialEnergy = level.initialEnergy !== undefined ? level.initialEnergy : INITIAL_ENERGY;
  const maxEnergy = level.maxEnergy !== undefined ? level.maxEnergy : MAX_ENERGY;
  const energyRegenPerSecond = level.energyRegenPerSecond !== undefined ? level.energyRegenPerSecond : ENERGY_REGEN_PER_SECOND;
  
  /** @type {GameState} */
  const s = {
    towers: [],
    enemies: [],
    bullets: [], // 子弹数组
    map: null,
    addPermanentObstacle: null,
    baseHp: INITIAL_BASE_HP,
    maxBaseHp: INITIAL_BASE_HP,
    energy: initialEnergy,
    maxEnergy: maxEnergy,
    energyRegenPerSecond: energyRegenPerSecond, // 存储关卡的能量回复速度
    currentWaveIndex: 0,
    running: false,
    paused: false,
    phase: "menu", // 初始為菜單階段
    handCards: getInitialHand(),
    lastFrameTime: performance.now(),
    isSpawningWave: false,
    waveSpawnFinished: false,
    isWaveCleared: false,
    spawnCursor: 0,
    spawnedInCurrentGroup: 0,
    timeSinceLastSpawn: 0,
    waveClearDelayRemaining: 0,
    logicTime: 0,
    speedMultiplier: 1,
    currentLevelIndex: levelIndex,
    enemiesKilledInLevel: 0,
    totalEnemiesInLevel: totalEnemies,
    currentLevelWaves: sanitizedWaves,
    activeBossId: null,
    pauseStartTime: null, // 暫停開始時間，null 表示未暫停
    itemManager: new ItemManager(uiElements.gameField, null), // 稍后设置gameState引用
    nextWaveModifiers: {},
    activeWaveModifiers: {},
  };
  
  // 设置itemManager的gameState引用
  s.itemManager.gameState = s;
  s.itemManager.updateInventoryUI();
  
  return s;
}

/**
 * 開始指定關卡的遊戲。
 * @param {number} levelIndex 關卡索引（默認為 0）
 */
export function startGame(levelIndex = 0) {
  if (levelIndex < 0 || levelIndex >= LEVELS.length) {
    console.error(`[DOM 塔防卡] 無效的關卡索引：${levelIndex}`);
    return;
  }

  const level = LEVELS[levelIndex];
  
  // 清空戰場上的塔與敵人 DOM
  clearFieldDom();

  state = createInitialState(levelIndex);
  selectedAction = null;
  removeTowerPreview();
  hideStartScreen();
  hideResultOverlays();
  hideLevelComplete();
  hideBossStatusBar();
  
  // 初始化道具管理器
  if (state.itemManager) {
    state.itemManager.cleanup();
    state.itemManager.gameState = state;
    state.itemManager.updateInventoryUI();
  }

  // 初始化地圖狀態（包含障礙、阻塞網格、路徑預覽等）
  state.map = buildMapState(level);
  registerObstacleApi();

  if (state.map) {
    applyGameFieldDimensions(state.map);
    currentSpawnPoints = state.map.spawnRatios;
    if (state.map.baseRatio) {
      updateBasePosition(state.map.baseRatio);
    }
    renderObstacles(state.map);
  } else {
    currentSpawnPoints = level.spawnPoints || [];
    if (level.basePosition) {
      updateBasePosition(level.basePosition);
    }
  }

  // 更新戰場背景主題
  const field = uiElements.gameField;
  // 移除所有 map-theme-* 類
  Array.from(field.classList).forEach((cls) => {
    if (cls.startsWith("map-theme-")) {
      field.classList.remove(cls);
    }
  });
  // 添加當前關卡的主題類
  if (level.backgroundClass) {
    field.classList.add(level.backgroundClass);
  }

  // 重置布局卡buff
  activeLayoutBuffs = [];
  updateActiveBuffs([]);
  
  // 移除所有布局类
  field.classList.remove("field-layout-flex", "field-layout-grid");

  // 初始化UI状态（在显示气泡前）
  const bestRecord = loadBestRecord();
  updateBestRecord(bestRecord);
  updateHp(state.baseHp, state.maxBaseHp);
  const energyRegen = state.energyRegenPerSecond !== undefined ? state.energyRegenPerSecond : ENERGY_REGEN_PER_SECOND;
  updateEnergy(state.energy, state.maxEnergy, energyRegen);
  // 使用新的整合函数更新战局进度
  updateBattleProgress(
    levelIndex,
    level.name,
    state.currentWaveIndex,
    state.currentLevelWaves.length,
    state.enemiesKilledInLevel,
    state.totalEnemiesInLevel
  );
  renderHandCards(state.handCards, handleCardClick, null, state.energy);
  updateHandEnergyState(state.energy);

  // 在控制台输出一条明确的初始化日志
  console.log(`[DOM 塔防卡] 開始關卡 ${levelIndex + 1}：${level.name}`);
  
  // 设置阶段为布置阶段
  state.phase = "setup";
  state.running = false;
  
  // 显示关卡开始气泡
  const prepTime = level.setupTimeSeconds || 10; // 从关卡配置获取布置时间
  // 根据关卡生成描述
  let description = level.description || "准备防御，敌人即将来袭！";
  if (!level.description) {
    if (levelIndex === 0) {
      description = "敌人从顶部两侧进攻，尝试用 DIV 塔守住正面。";
    } else if (levelIndex === 1) {
      description = "敌人从四个方向进攻，BASE 位于中央，需要全方位防御。";
    } else if (levelIndex === 2) {
      description = "终极挑战！敌人从多个方向同时进攻，合理使用布局卡和样式卡。";
    }
  }
  
  // 构建关卡信息对象
  const levelInfo = {
    difficulty: level.difficulty || 1,
    enemyTypes: level.enemyTypes || [],
    recommended: level.recommended || "",
  };
  
  // 显示路径预览和障碍物高亮（布置阶段）
  if (state.map?.previewPaths && state.map.previewPaths.length > 0) {
    showPathPreview(state.map.previewPaths);
  } else if (level.previewPaths) {
    showPathPreview(level.previewPaths);
  }
  highlightObstacles();
  
  // 【新逻辑】初始化调试模式（通过featureFlags.debugOverlay控制）
  if (featureFlags.debugOverlay && getDebugMode() && state.map) {
    renderGridMarkers(state.map, state.towers, state.enemies);
  }
  
  // 验证初始状态：确保在没有塔的情况下，入口到BASE有路径
  const spawnPointsGrid = getSpawnPointsGrid(level);
  const baseGrid = getBaseGrid(level);
  if (baseGrid && spawnPointsGrid.length > 0) {
    const testIsWalkable = (row, col) => {
      return isWalkable(row, col, state.towers, state.enemies, level, null, null, true, state);
    };
    
    let hasInitialPath = false;
    for (const spawn of spawnPointsGrid) {
      const testPath = findPath(
        spawn.row,
        spawn.col,
        baseGrid.row,
        baseGrid.col,
        testIsWalkable,
        getMapSize().width,
        getMapSize().height
      );
      if (testPath && testPath.length > 0) {
        hasInitialPath = true;
        console.log(`[startGame] 验证：入口(${spawn.row},${spawn.col}) -> BASE(${baseGrid.row},${baseGrid.col}) 有路径，长度=${testPath.length}`);
        break;
      }
    }
    
    if (!hasInitialPath) {
      console.error(`[startGame] 警告：初始状态下，没有任何入口到BASE的路径！这可能是地图配置问题。`);
    }
  }
  
  showLevelIntroBubble(
    level.name,
    prepTime,
    description,
    () => {
      // 气泡关闭后切换到战斗阶段
      if (!state) return;
      
      // 隐藏路径预览和障碍物高亮
      hidePathPreview();
      unhighlightObstacles();
      
      // 切换到战斗阶段
      state.phase = "battle";
      state.running = true;
      state.paused = false;
      state.pauseStartTime = null;
      state.lastFrameTime = performance.now();
      state.logicTime = 0;
      updatePauseButton(false);
      updateSpeedButton(state.speedMultiplier);
      startWave(0);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(gameLoop);
    },
    levelInfo
  );
}

/**
 * 開始新遊戲或重新開始（兼容舊接口，默認使用第 1 關）。
 */
function startNewGame() {
  startGame(0);
}

/**
 * 透過關卡 ID 直接啟動對應關卡。
 * @param {number|string} levelId
 */
export function selectLevel(levelId) {
  let targetIndex = -1;
  if (typeof levelId === "number" && Number.isFinite(levelId)) {
    targetIndex = LEVELS.findIndex((level) => level.id === levelId);
  } else {
    const normalized = String(levelId).trim();
    targetIndex = LEVELS.findIndex(
      (level) => String(level.id) === normalized || level.name === normalized
    );
  }
  if (targetIndex < 0) {
    console.warn(`[selectLevel] 找不到 id 為 ${levelId} 的關卡，保持當前狀態。`);
    return;
  }
  startGame(targetIndex);
}

/**
 * 獲取開始界面中選中的關卡索引。
 * @returns {number}
 */
function getSelectedLevelIndex() {
  const selected = document.querySelector('.level-btn.selected');
  if (selected) {
    const index = Number(selected.dataset.levelIndex);
    if (Number.isFinite(index) && index >= 0 && index < LEVELS.length) {
      return index;
    }
  }
  return 0; // 默認第 1 關
}

/**
 * 清空戰場上的塔與敵人 DOM，但保留基地和障礙物。
 * 障礙物會在渲染新關卡時被替換，所以這裡只清理塔和敵人。
 */
function clearFieldDom() {
  const field = uiElements.gameField;
  const children = Array.from(field.children);
  for (const child of children) {
    // 保留基地和障礙物
    if (child === uiElements.baseEl || child.classList.contains("obstacle")) continue;
    field.removeChild(child);
  }
}

/**
 * 註冊供道具 / 腳本使用的永久障礙 API。
 */
function registerObstacleApi() {
  if (!state) return;
  state.addPermanentObstacle = (options) => placePermanentObstacle(options);
}

/**
 * 依據地圖狀態調整戰場尺寸。
 * @param {ReturnType<typeof buildMapState>} mapState
 */
function applyGameFieldDimensions(mapState) {
  if (!uiElements.gameField || !mapState) return;
  const widthPx = mapState.width * mapState.tileSize;
  const heightPx = mapState.height * mapState.tileSize;
  uiElements.gameField.style.setProperty("--map-width-px", `${widthPx}px`);
  uiElements.gameField.style.setProperty("--map-height-px", `${heightPx}px`);
  uiElements.gameField.style.setProperty("--tile-size", `${mapState.tileSize}px`);
  uiElements.gameField.style.width = `${widthPx}px`;
  uiElements.gameField.style.height = `${heightPx}px`;
  notifyBattlefieldSizeChanged();
}

/**
 * 根據地圖狀態渲染障礙 DOM。
 * @param {ReturnType<typeof buildMapState>} mapState
 */
function renderObstacles(mapState) {
  const field = uiElements.gameField;
  if (!field || !mapState) return;

  const oldObstacles = field.querySelectorAll(".obstacle");
  oldObstacles.forEach((obs) => obs.remove());

  requestAnimationFrame(() => {
    for (const obs of mapState.gridObstacles) {
      const obstacleEl = document.createElement("div");
      obstacleEl.className = "obstacle";
      if (obs.source === "random") {
        obstacleEl.classList.add("obstacle--random");
      } else if (obs.source === "player" || obs.source === "item") {
        obstacleEl.classList.add("obstacle--player");
      }
      if (obs.source) {
        obstacleEl.dataset.source = obs.source;
      }

      const area = (obs.w || 1) * (obs.h || 1);
      if (area >= 54) {
        obstacleEl.classList.add("obstacle--size-large");
      } else if (area >= 16) {
        obstacleEl.classList.add("obstacle--size-medium");
      } else {
        obstacleEl.classList.add("obstacle--size-small");
      }

      const isTurnAnchor = (obs.w <= 3 && obs.h >= 4) || (obs.h <= 3 && obs.w >= 4);
      if (isTurnAnchor) {
        obstacleEl.classList.add("obstacle--turn");
      }
      if (obs.w <= 3 && obs.h <= 3) {
        obstacleEl.classList.add("obstacle--platform");
      }

      obstacleEl.style.left = `${obs.x * mapState.tileSize}px`;
      obstacleEl.style.top = `${obs.y * mapState.tileSize}px`;
      obstacleEl.style.width = `${obs.w * mapState.tileSize}px`;
      obstacleEl.style.height = `${obs.h * mapState.tileSize}px`;

      field.insertBefore(obstacleEl, uiElements.baseEl);
    }
  });
}

/**
 * 建立地圖狀態：包含障礙、阻塞網格、入口/基地格子以及預覽路徑。
 * @param {typeof LEVELS[0]} level
 */
function buildMapState(level) {
  const fallbackMapSize = getMapSize();
  const mapWidth = level.mapSize?.width || fallbackMapSize.width || 28;
  const mapHeight = level.mapSize?.height || fallbackMapSize.height || 20;
  const baseRatio = level.basePosition || { x: 0.5, y: 0.8 };
  const spawnRatios =
    Array.isArray(level.spawnPoints) && level.spawnPoints.length > 0
      ? level.spawnPoints
      : level.entryPosition
      ? [level.entryPosition]
      : [{ x: 0.5, y: 0.02 }];

  const baseGrid = ratioPointToGrid(baseRatio, mapWidth, mapHeight);
  const spawnGrids = spawnRatios.map((point) => ratioPointToGrid(point, mapWidth, mapHeight));

  let gridObstacles = getConfiguredGridObstacles(level, mapWidth, mapHeight);
  const randomObstacles = generateStructuredRandomObstacles(level, {
    mapWidth,
    mapHeight,
    baseGrid,
    spawnGrids,
    existing: gridObstacles,
  });
  gridObstacles = [...gridObstacles, ...randomObstacles];

  let blockedGrid = buildBlockedGrid(mapWidth, mapHeight, gridObstacles);
  let safeBaseGrid = baseGrid;
  if (blockedGrid[baseGrid.row]?.[baseGrid.col]) {
    const resolved = findNearestWalkableTile(baseGrid, blockedGrid, mapWidth, mapHeight);
    if (resolved) {
      console.warn(
        `[map] 基地預設格子(${baseGrid.row},${baseGrid.col}) 被障礙覆蓋，已自動移動到 (${resolved.row},${resolved.col})。`
      );
      safeBaseGrid = resolved;
    } else {
      console.warn(
        `[map] 基地格子(${baseGrid.row},${baseGrid.col}) 被障礙覆蓋且無法移動，強制清理該格子。`
      );
      blockedGrid[baseGrid.row][baseGrid.col] = false;
    }
  }

  const baseClearRadiusTiles = Math.max(1, Math.round(level.baseClearRadiusTiles ?? 2));
  if (safeBaseGrid && baseClearRadiusTiles > 0) {
    const { filtered, removed } = removeObstaclesAroundBase(gridObstacles, safeBaseGrid, baseClearRadiusTiles);
    if (removed > 0) {
      gridObstacles = filtered;
      blockedGrid = buildBlockedGrid(mapWidth, mapHeight, gridObstacles);
      console.log(
        `[map] 清除了 ${removed} 個靠近基地的障礙 (半徑=${baseClearRadiusTiles})，避免視覺重疊。`
      );
    }
  }

  const previewPaths = computePreviewPaths(spawnGrids, safeBaseGrid, blockedGrid, mapWidth, mapHeight);

  return {
    tileSize: GRID_CONFIG.TILE_SIZE,
    width: mapWidth,
    height: mapHeight,
    gridObstacles,
    blockedGrid,
    spawnGrids,
    spawnRatios: spawnGrids.map((grid) => gridToNormalized(grid, mapWidth, mapHeight)),
    baseGrid: safeBaseGrid,
    baseRatio: gridToNormalized(safeBaseGrid, mapWidth, mapHeight),
    previewPaths,
  };
}

function getConfiguredGridObstacles(level, mapWidth, mapHeight) {
  if (Array.isArray(level.gridObstacles) && level.gridObstacles.length > 0) {
    return level.gridObstacles.map((obs) => ({
      x: Math.max(0, Math.min(mapWidth - 1, Math.floor(obs.x))),
      y: Math.max(0, Math.min(mapHeight - 1, Math.floor(obs.y))),
      w: Math.max(1, Math.min(mapWidth - Math.max(0, Math.floor(obs.x)), Math.floor(obs.w || 1))),
      h: Math.max(1, Math.min(mapHeight - Math.max(0, Math.floor(obs.y)), Math.floor(obs.h || 1))),
      source: obs.source || "preset",
    }));
  }
  if (Array.isArray(level.obstacles) && level.obstacles.length > 0) {
    return level.obstacles.map((obs) => normalizedObstacleToGrid(obs, mapWidth, mapHeight));
  }
  return [];
}

function normalizedObstacleToGrid(obstacle, mapWidth, mapHeight) {
  const x = Math.max(0, Math.min(mapWidth - 1, Math.floor((obstacle.x ?? 0) * mapWidth)));
  const y = Math.max(0, Math.min(mapHeight - 1, Math.floor((obstacle.y ?? 0) * mapHeight)));
  const w = Math.max(1, Math.round((obstacle.width ?? 0.05) * mapWidth));
  const h = Math.max(1, Math.round((obstacle.height ?? 0.05) * mapHeight));
  return {
    x,
    y,
    w: Math.min(mapWidth - x, w),
    h: Math.min(mapHeight - y, h),
    source: obstacle.source || "preset",
  };
}

function ratioPointToGrid(point, mapWidth, mapHeight) {
  const clampedX = Math.max(0, Math.min(1, Number(point?.x ?? 0.5)));
  const clampedY = Math.max(0, Math.min(1, Number(point?.y ?? 0.5)));
  return {
    col: Math.max(0, Math.min(mapWidth - 1, Math.round(clampedX * (mapWidth - 1)))),
    row: Math.max(0, Math.min(mapHeight - 1, Math.round(clampedY * (mapHeight - 1)))),
  };
}

function gridToNormalized(grid, mapWidth, mapHeight) {
  return {
    x: (grid.col + 0.5) / mapWidth,
    y: (grid.row + 0.5) / mapHeight,
  };
}

function buildBlockedGrid(mapWidth, mapHeight, obstacles) {
  const blocked = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));
  const warnedTiles = new Set();
  for (const obs of obstacles) {
    for (let r = obs.y; r < obs.y + obs.h; r++) {
      for (let c = obs.x; c < obs.x + obs.w; c++) {
        if (r < 0 || c < 0 || r >= mapHeight || c >= mapWidth) {
          if (!warnedTiles.has("out-of-range")) {
            console.warn("[map] 發現超出界限的障礙，已自動裁剪。");
            warnedTiles.add("out-of-range");
          }
          continue;
        }
        const key = `${r},${c}`;
        if (blocked[r][c]) {
          if (!warnedTiles.has(key)) {
            console.warn(`[map] 障礙重疊於格子 (${r},${c})，保留最早的障礙。`);
            warnedTiles.add(key);
          }
          continue;
        }
        blocked[r][c] = true;
      }
    }
  }
  return blocked;
}

function removeObstaclesAroundBase(obstacles, baseGrid, radiusTiles) {
  if (!baseGrid || radiusTiles <= 0) {
    return { filtered: obstacles, removed: 0 };
  }
  const filtered = [];
  let removed = 0;
  for (const obs of obstacles) {
    if (intersectsCircle(obs, baseGrid, radiusTiles)) {
      removed++;
    } else {
      filtered.push(obs);
    }
  }
  return { filtered, removed };
}

function generateStructuredRandomObstacles(level, context) {
  const config = level.randomObstacles;
  if (!config || !config.count) {
    return [];
  }
  const mapWidth = context.mapWidth;
  const mapHeight = context.mapHeight;
  const baseGrid = context.baseGrid;
  const spawnGrids = context.spawnGrids;
  const working = context.existing.map((obs) => ({ ...obs }));
  const results = [];

  const minGap = Math.max(1, Math.round((config.minDistanceBetween ?? 0.05) * Math.min(mapWidth, mapHeight)));
  const baseBuffer = Math.max(2, Math.round((config.avoidRadiusAroundBase ?? 0.15) * Math.min(mapWidth, mapHeight)));
  const spawnBuffer = Math.max(2, Math.round((config.avoidRadiusAroundEntry ?? 0.1) * Math.min(mapWidth, mapHeight)));
  const corridorPadding = Math.max(1, Math.round((config.avoidPathDistance ?? 0.05) * Math.min(mapWidth, mapHeight)));
  const corridors = createReservedCorridors(mapWidth, mapHeight, baseGrid, corridorPadding);
  const maxAttempts = Math.max(config.count * (config.maxAttemptsPerObstacle ?? 18), config.count * 10);

  let attempts = 0;
  while (results.length < config.count && attempts < maxAttempts) {
    attempts++;
    const candidate = createRandomObstacleShape(mapWidth, mapHeight);
    if (!candidate) continue;
    if (!rectWithinBounds(candidate, mapWidth, mapHeight)) continue;
    if (intersectsCircle(candidate, baseGrid, baseBuffer)) continue;
    if (spawnGrids.some((spawn) => intersectsCircle(candidate, spawn, spawnBuffer))) continue;
    if (intersectsCorridors(candidate, corridors)) continue;
    if (working.some((obs) => rectanglesOverlapGrid(candidate, obs) || rectanglesTooCloseGrid(candidate, obs, minGap))) {
      continue;
    }

    const testLayout = [...working, candidate];
    if (!pathsRemain(spawnGrids, baseGrid, testLayout, mapWidth, mapHeight)) {
      continue;
    }

    candidate.source = "random";
    working.push(candidate);
    results.push(candidate);
  }

  if (results.length < config.count) {
    console.warn(
      `[map] 隨機障礙僅生成 ${results.length}/${config.count} 個（${level.name}），以維持主路暢通。`
    );
  }

  return results;
}

function createRandomObstacleShape(mapWidth, mapHeight) {
  const roll = Math.random();
  if (roll < 0.45) {
    const w = randomInt(4, Math.max(5, Math.round(mapWidth * 0.25)));
    const h = randomInt(2, 3);
    return { x: randomInt(0, Math.max(0, mapWidth - w)), y: randomInt(0, Math.max(0, mapHeight - h)), w, h };
  }
  if (roll < 0.75) {
    const w = randomInt(2, 3);
    const h = randomInt(4, Math.max(5, Math.round(mapHeight * 0.25)));
    return { x: randomInt(0, Math.max(0, mapWidth - w)), y: randomInt(0, Math.max(0, mapHeight - h)), w, h };
  }
  const w = randomInt(3, 6);
  const h = randomInt(3, 5);
  return { x: randomInt(0, Math.max(0, mapWidth - w)), y: randomInt(0, Math.max(0, mapHeight - h)), w, h };
}

function randomInt(min, max) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectWithinBounds(rect, mapWidth, mapHeight) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= mapWidth && rect.y + rect.h <= mapHeight;
}

function intersectsCircle(rect, center, radius) {
  if (!center) return false;
  const nearestX = Math.max(rect.x, Math.min(center.col, rect.x + rect.w - 1));
  const nearestY = Math.max(rect.y, Math.min(center.row, rect.y + rect.h - 1));
  const dx = nearestX - center.col;
  const dy = nearestY - center.row;
  return dx * dx + dy * dy <= radius * radius;
}

function rectanglesOverlapGrid(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function rectanglesTooCloseGrid(a, b, gap) {
  const expanded = {
    x: a.x - gap,
    y: a.y - gap,
    w: a.w + gap * 2,
    h: a.h + gap * 2,
  };
  return rectanglesOverlapGrid(expanded, b);
}

function createReservedCorridors(mapWidth, mapHeight, baseGrid, padding) {
  const corridors = [];
  const halfWidth = Math.max(1, Math.round(mapWidth * 0.05)) + padding;
  const halfHeight = Math.max(1, Math.round(mapHeight * 0.05)) + padding;
  const vertical = {
    x: Math.max(0, baseGrid.col - halfWidth),
    y: 0,
    w: Math.min(mapWidth, halfWidth * 2 + 1),
    h: mapHeight,
  };
  const horizontal = {
    x: 0,
    y: Math.max(0, baseGrid.row - halfHeight),
    w: mapWidth,
    h: Math.min(mapHeight, halfHeight * 2 + 1),
  };
  corridors.push(vertical, horizontal);
  return corridors;
}

function intersectsCorridors(rect, corridors) {
  return corridors.some((corridor) => rectanglesOverlapGrid(rect, corridor));
}

function pathsRemain(spawnGrids, baseGrid, obstacles, mapWidth, mapHeight) {
  if (!baseGrid || spawnGrids.length === 0) return true;
  const blocked = buildBlockedGrid(mapWidth, mapHeight, obstacles);
  const walker = (row, col) => {
    if (row < 0 || row >= mapHeight || col < 0 || col >= mapWidth) return false;
    if (row === baseGrid.row && col === baseGrid.col) return true;
    if (spawnGrids.some((spawn) => spawn.row === row && spawn.col === col)) return true;
    return !blocked[row][col];
  };
  for (const spawn of spawnGrids) {
    const path = findPath(
      spawn.row,
      spawn.col,
      baseGrid.row,
      baseGrid.col,
      walker,
      mapWidth,
      mapHeight,
      false
    );
    if (!path || path.length === 0) {
      return false;
    }
  }
  return true;
}

function computePreviewPaths(spawnGrids, baseGrid, blockedGrid, mapWidth, mapHeight) {
  if (!baseGrid || spawnGrids.length === 0) return [];
  const walker = (row, col) => {
    if (row < 0 || row >= mapHeight || col < 0 || col >= mapWidth) return false;
    if (row === baseGrid.row && col === baseGrid.col) return true;
    if (spawnGrids.some((spawn) => spawn.row === row && spawn.col === col)) return true;
    return !blockedGrid[row][col];
  };
  const paths = [];
  for (const spawn of spawnGrids) {
    const path = findPath(
      spawn.row,
      spawn.col,
      baseGrid.row,
      baseGrid.col,
      walker,
      mapWidth,
      mapHeight,
      false
    );
    if (path && path.length > 0) {
      paths.push(path.map((node) => gridToNormalized({ col: node.col, row: node.row }, mapWidth, mapHeight)));
    }
  }
  return paths;
}

function findNearestWalkableTile(startGrid, blockedGrid, mapWidth, mapHeight) {
  const visited = new Set();
  const queue = [startGrid];
  while (queue.length > 0) {
    const current = queue.shift();
    const key = `${current.row},${current.col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (!blockedGrid[current.row]?.[current.col]) {
      return current;
    }
    const neighbors = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 },
    ];
    for (const neighbor of neighbors) {
      if (
        neighbor.row >= 0 &&
        neighbor.row < mapHeight &&
        neighbor.col >= 0 &&
        neighbor.col < mapWidth
      ) {
        queue.push(neighbor);
      }
    }
  }
  return null;
}

/**
 * 在當前關卡添加一個永久性障礙。
 * @param {{x:number,y:number,width?:number,height?:number,source?:string,ensurePath?:boolean}} options
 */
function placePermanentObstacle(options) {
  if (!state || !state.map) {
    return { success: false, reason: "遊戲尚未開始" };
  }
  const mapState = state.map;
  const tileSize = mapState.tileSize || GRID_CONFIG.TILE_SIZE;
  const ensurePath = options.ensurePath !== false;
  const widthTiles = Math.max(1, Math.round((options.width ?? tileSize) / tileSize));
  const heightTiles = Math.max(1, Math.round((options.height ?? tileSize) / tileSize));
  const col = Math.floor(options.x / tileSize);
  const row = Math.floor(options.y / tileSize);
  const rect = {
    x: Math.max(0, Math.min(mapState.width - widthTiles, col - Math.floor(widthTiles / 2))),
    y: Math.max(0, Math.min(mapState.height - heightTiles, row - Math.floor(heightTiles / 2))),
    w: widthTiles,
    h: heightTiles,
    source: options.source || "player",
  };

  if (!rectWithinBounds(rect, mapState.width, mapState.height)) {
    return { success: false, reason: "超出地圖範圍" };
  }
  if (mapState.gridObstacles.some((obs) => rectanglesOverlapGrid(rect, obs))) {
    return { success: false, reason: "該區域已有障礙" };
  }
  if (intersectsCircle(rect, mapState.baseGrid, 1.5)) {
    return { success: false, reason: "不能覆蓋基地" };
  }
  if (mapState.spawnGrids.some((spawn) => intersectsCircle(rect, spawn, 1))) {
    return { success: false, reason: "不能覆蓋敵人入口" };
  }

  const nextLayout = [...mapState.gridObstacles, rect];
  if (
    ensurePath &&
    !pathsRemain(mapState.spawnGrids, mapState.baseGrid, nextLayout, mapState.width, mapState.height)
  ) {
    return { success: false, reason: "此處放置會堵死主路徑" };
  }

  mapState.gridObstacles = nextLayout;
  mapState.blockedGrid = buildBlockedGrid(mapState.width, mapState.height, mapState.gridObstacles);
  renderObstacles(mapState);

  if (featureFlags.debugOverlay && getDebugMode()) {
    renderGridMarkers(mapState, state.towers, state.enemies);
  }

  if (state.enemies.length > 0 && featureFlags.newPathfinding && mapState.baseGrid) {
    const level = LEVELS[state.currentLevelIndex];
    const enemyWalkable = (row, col) =>
      isWalkable(row, col, state.towers, state.enemies, level, null, null, true, state);
    recalculateAllEnemyPaths(
      state.enemies,
      mapState.baseGrid,
      enemyWalkable,
      mapState.width,
      mapState.height,
      state.towers
    );
  }

  return { success: true };
}

/**
 * 遊戲主循環。
 * @param {number} timestamp
 */
function gameLoop(timestamp) {
  if (!state || !state.running) return;

  const delta = timestamp - state.lastFrameTime;
  state.lastFrameTime = timestamp;

  if (!state.paused) {
    updateGameState(delta, timestamp);
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * 更新整體遊戲邏輯。
 * @param {number} delta 本幀時間差（毫秒）
 * @param {number} now 當前時間戳（毫秒）
 */
function updateGameState(delta, now) {
  if (!state) return;

  // 根據速度倍率縮放邏輯時間，使 2x 速度下移動/生成/回能/攻速等整體加快
  const speed = state.speedMultiplier || 1;
  const scaledDelta = delta * speed;
  const dtSeconds = scaledDelta / 1000;
  state.logicTime += scaledDelta;
  const logicNow = state.logicTime;

  // 能量恢復：使用关卡配置的能量回复速度，受到遊戲速度倍率影響
  const energyRegen = state.energyRegenPerSecond !== undefined ? state.energyRegenPerSecond : ENERGY_REGEN_PER_SECOND;
  state.energy = Math.min(
    state.maxEnergy,
    state.energy + energyRegen * dtSeconds
  );
  updateEnergy(state.energy, state.maxEnergy, energyRegen);
  updateHandEnergyState(state.energy);

  // 波次與敵人生成
  updateWaveSpawning(scaledDelta);

  // 基地位置（每幀計算一次，避免視口調整問題）
  const basePos = getBasePosition();

  // 更新敵人位置與與基地碰撞
  const level = LEVELS[state.currentLevelIndex];
  const mapSize = getMapSize();
  const baseGrid = getBaseGrid(level);
  
  // 【新逻辑】创建isWalkable函数，用于敌人寻路（通过featureFlags.newPathfinding控制）
  // 注意：敌人寻路时应该允许到达BASE和入口点（allowBaseAndSpawn = true）
  const enemyIsWalkable = (row, col) => {
    return isWalkable(row, col, state.towers, state.enemies, level, null, null, true, state);
  };
  const requestFullPathRecalc = () => {
    if (!featureFlags.newPathfinding || !baseGrid) return;
    recalculateAllEnemyPaths(
      state.enemies,
      baseGrid,
      enemyIsWalkable,
      mapSize.width,
      mapSize.height,
      state.towers
    );
  };
  
  updateEnemies(
    state.enemies,
    scaledDelta,
    basePos,
    /**
     * @param {Enemy} enemy
     * @param {number} damageToBase
     */
    (enemy, damageToBase) => {
      // 敵人到達基地
      state.baseHp -= damageToBase;
      if (state.baseHp < 0) state.baseHp = 0;
      updateHp(state.baseHp, state.maxBaseHp);
    },
    /**
     * @param {Enemy} enemy
     */
    (enemy) => {
      // 敵人被擊殺（hp <= 0）
      state.enemiesKilledInLevel++;
      updateEnemyProgress(state.enemiesKilledInLevel, state.totalEnemiesInLevel);
    },
    enemyIsWalkable,
    mapSize.width,
    mapSize.height,
    baseGrid,
    state.towers,
    {
      gameField: uiElements.gameField,
      spawnPoints: currentSpawnPoints,
      basePosition: level.basePosition || null,
      onBossHpChanged: (hp, maxHp) => {
        updateBossHpBar(hp, maxHp);
      },
      onBossDefeated: (boss) => {
        if (state.activeBossId === boss.id) {
          state.activeBossId = null;
          hideBossStatusBar();
        }
      },
      onExtraEnemySpawned: (newEnemies) => {
        const deltaCount = Array.isArray(newEnemies) ? newEnemies.length : 0;
        if (deltaCount > 0) {
          state.totalEnemiesInLevel += deltaCount;
          updateEnemyProgress(state.enemiesKilledInLevel, state.totalEnemiesInLevel);
        }
      },
      onTowerDestroyed: () => {
        requestFullPathRecalc();
        const now = performance.now();
        if (!lastBossTowerToast || now - lastBossTowerToast > 1500) {
          showWaveToast("Boss 摧毁了一座防御塔！", "info");
          lastBossTowerToast = now;
        }
      },
      onCourierArrival: handleCourierArrival,
    }
  );

  // 【新逻辑】调试模式：更新敌人路径可视化和穿墙检测（通过featureFlags.debugOverlay控制）
  if (featureFlags.debugOverlay && getDebugMode()) {
    updateEnemyPaths(state.enemies, baseGrid);

    for (const enemy of state.enemies) {
      if (enemy.alive) {
        checkEnemyCollision(enemy, enemyIsWalkable, state.map || level);
      }
    }

    renderGridMarkers(state.map, state.towers, state.enemies);
  }

  // 腳本注入怪干擾塔：靠近塔時可能暫時禁用塔
  applyScriptDisruption(state.towers, state.enemies, logicNow);

  // 塔攻擊敵人（生成子弹）
  updateTowers(state.towers, state.enemies, logicNow, state.bullets, uiElements.gameField, dtSeconds);

  // 更新子弹位置（使用缩放后的时间差，受游戏速度倍率影响）
  updateBullets(state.bullets, dtSeconds, state.enemies, uiElements.gameField);

  // 更新道具系统
  if (state.itemManager && state.phase === "battle") {
    state.itemManager.update(logicNow, state.enemies);
  }

  // 清理死亡敵人與無效塔
  state.enemies = state.enemies.filter((e) => e.alive);
  state.towers = state.towers.filter((t) => t.alive);

  // 勝負判定
  checkGameEnd();
}

/**
 * 啟動指定波次。
 * @param {number} waveIndex
 */
function startWave(waveIndex) {
  if (!state) return;
  const waves = state.currentLevelWaves;
  const totalWaves = waves.length;
  if (totalWaves === 0) {
    console.warn("[wave] 當前關卡沒有可用的波次配置。");
    state.currentWaveIndex = 0;
    state.waveSpawnFinished = true;
    state.isSpawningWave = false;
    return;
  }

  if (waveIndex >= totalWaves) {
    state.currentWaveIndex = totalWaves;
    state.isSpawningWave = false;
    state.waveSpawnFinished = true;
    return;
  }

  state.currentWaveIndex = waveIndex;
  state.isSpawningWave = true;
  state.waveSpawnFinished = false;
  state.isWaveCleared = false;
  state.waveClearDelayRemaining = 0;
  state.spawnCursor = 0;
  state.spawnedInCurrentGroup = 0;
  state.timeSinceLastSpawn = 0;
  state.activeWaveModifiers = { ...(state.nextWaveModifiers || {}) };
  state.nextWaveModifiers = {};

  updateWave(waveIndex, totalWaves);
  const level = LEVELS[state.currentLevelIndex];
  updateBattleProgress(
    state.currentLevelIndex,
    level.name,
    waveIndex,
    totalWaves,
    state.enemiesKilledInLevel,
    state.totalEnemiesInLevel
  );

  const waveId = waves[waveIndex]?.id ?? waveIndex + 1;
  showWaveToast(`第 ${waveId} 波開始`, "start");

  if (state.activeWaveModifiers?.shieldRatio) {
    setTimeout(() => {
      showWaveToast("本波敵人護盾增強！", "info");
    }, 600);
  }
}

/**
 * 更新波次生成與切換。
 * @param {number} delta
 */
function updateWaveSpawning(delta) {
  if (!state) return;
  const waves = state.currentLevelWaves;
  const totalWaves = waves.length;
  if (totalWaves === 0 || state.currentWaveIndex >= totalWaves) {
    return;
  }

  const wave = waves[state.currentWaveIndex];

  if (state.isSpawningWave) {
    const group = wave?.enemies[state.spawnCursor];
    if (!group) {
      state.isSpawningWave = false;
      state.waveSpawnFinished = true;
      return;
    }

    state.timeSinceLastSpawn += delta;
    if (
      state.spawnedInCurrentGroup < group.count &&
      state.timeSinceLastSpawn >= group.interval
    ) {
      state.timeSinceLastSpawn = 0;
      const level = LEVELS[state.currentLevelIndex];
      const enemy = spawnEnemy(
        uiElements.gameField,
        /** @type any */ (group.type),
        currentSpawnPoints,
        null,
        level.basePosition || null,
        group.hpMultiplier ?? 1,
        group.speedMultiplier ?? 1
      );
      if (enemy) {
        applyActiveModifiersToEnemy(enemy);
        state.enemies.push(enemy);
        enemy.needsPathRecalculation = true;
        if (enemy.isBoss) {
          state.activeBossId = enemy.id;
          showBossStatusBar(enemy.displayName || "BOSS", enemy.hp, enemy.maxHp);
        }
        console.log(
          `[updateWaveSpawning] 敌人 ${enemy.id} 生成，位置(${enemy.row},${enemy.col})`
        );
      }
      state.spawnedInCurrentGroup++;
    }

    if (state.spawnedInCurrentGroup >= group.count) {
      state.spawnCursor++;
      state.spawnedInCurrentGroup = 0;
      state.timeSinceLastSpawn = 0;
      if (state.spawnCursor >= wave.enemies.length) {
        state.isSpawningWave = false;
        state.waveSpawnFinished = true;
      }
    }
    return;
  }

  if (!state.waveSpawnFinished) {
    return;
  }

  const aliveEnemies = state.enemies.some((enemy) => enemy.alive);
  if (aliveEnemies) {
    state.isWaveCleared = false;
    state.waveClearDelayRemaining = resolveWaveDelay(wave);
    return;
  }

  if (!state.isWaveCleared) {
    state.isWaveCleared = true;
    state.waveClearDelayRemaining = resolveWaveDelay(wave);
    const waveId = wave?.id ?? state.currentWaveIndex + 1;
    showWaveToast(`第 ${waveId} 波已清除`, "clear");
  }

  if (state.currentWaveIndex === totalWaves - 1) {
    state.currentWaveIndex = totalWaves;
    return;
  }

  if (state.waveClearDelayRemaining > 0) {
    state.waveClearDelayRemaining = Math.max(0, state.waveClearDelayRemaining - delta);
    if (state.waveClearDelayRemaining > 0) {
      return;
    }
  }

  startWave(state.currentWaveIndex + 1);
}

function handleCourierArrival(enemy) {
  if (!state) return;
  const bonus =
    (enemy && Number.isFinite(enemy.courierShieldBonus)
      ? enemy.courierShieldBonus
      : COURIER_SHIELD_RATIO) || COURIER_SHIELD_RATIO;
  const current = state.nextWaveModifiers?.shieldRatio || 0;
  const next = Math.min(COURIER_SHIELD_RATIO_MAX, current + bonus);
  state.nextWaveModifiers = { ...(state.nextWaveModifiers || {}), shieldRatio: next };
  showBaseAlert("信使抵達，下一波敵人獲得護盾強化", 2600);
  showWaveToast("下一波敵人獲得護盾強化", "info");
}

function applyActiveModifiersToEnemy(enemy) {
  if (!state?.activeWaveModifiers || !enemy) return;
  const ratio = state.activeWaveModifiers.shieldRatio || 0;
  if (ratio <= 0 || enemy.maxHp <= 0) return;
  const bonusShield = Math.round(enemy.maxHp * ratio);
  if (bonusShield <= 0) return;
  enemy.maxShield = (enemy.maxShield || 0) + bonusShield;
  enemy.currentShield = (enemy.currentShield || 0) + bonusShield;
  enemy.el.classList.add("enemy-wave-shielded");
}

/**
 * 獲取基地中心在戰場中的座標。
 * @returns {{ x: number, y: number }}
 */
function getBasePosition() {
  return getBaseLogicalPosition();
}

/**
 * 腳本注入怪干擾塔：靠近塔時可能使塔暫時失效。
 * @param {Tower[]} towers
 * @param {Enemy[]} enemies
 * @param {number} now
 */
function applyScriptDisruption(towers, enemies, now) {
  const disruptRadius = 90;

  for (const enemy of enemies) {
    if (!enemy.alive || enemy.enemyType !== "script") continue;
    const ex = enemy.x;
    const ey = enemy.y;

    for (const tower of towers) {
      if (!tower.alive) continue;
      const tx = tower.x;
      const ty = tower.y;
      const dx = tx - ex;
      const dy = ty - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= disruptRadius) {
        // 以小概率暫時禁用該塔，模擬腳本注入干擾
        if (Math.random() < 0.004 * (dist === 0 ? 1 : disruptRadius / dist)) {
          const disableDuration = 2000;
          tower.disabledUntil = Math.max(tower.disabledUntil || 0, now + disableDuration);
          tower.el.style.opacity = "0.45";
        }
      }
    }
  }
}

function getTowerSlowMultiplier(tower, enemies) {
  if (!enemies || enemies.length === 0) return 1;
  let multiplier = 1;
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.enemyType !== ENEMY_TYPES.JAMMER) continue;
    const radius = enemy.jammerAuraRadius || 0;
    if (radius <= 0) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= radius) {
      const slow = enemy.jammerSlowMultiplier || 1.3;
      multiplier *= slow;
    }
  }
  return Math.min(multiplier, JAMMER_SLOW_CAP);
}

/**
 * 更新塔攻擊敵人（生成子弹）。
 * @param {Tower[]} towers
 * @param {Enemy[]} enemies
 * @param {number} now
 * @param {Array} bullets 子弹数组
 * @param {HTMLElement} gameField 战场DOM
 */
function updateTowers(towers, enemies, now, bullets, gameField, dtSeconds = 0) {
  for (const tower of towers) {
    if (!tower.alive) {
      if (tower.beamState?.beamEl) {
        tower.beamState.beamEl.remove();
        tower.beamState.beamEl = null;
      }
      continue;
    }

    // 若被腳本怪禁用，則暫時不能攻擊
    if (tower.disabledUntil && now < tower.disabledUntil) {
      continue;
    } else if (tower.disabledUntil && now >= tower.disabledUntil) {
      tower.disabledUntil = undefined;
      tower.el.style.opacity = "";
    }

    if (tower.percentDamagePerSecond) {
      tower.el.classList.remove("tower-jammed");
      updatePercentileTower(tower, enemies, dtSeconds, now, gameField);
      continue;
    }

    const slowMultiplier = getTowerSlowMultiplier(tower, enemies);
    const effectiveInterval = tower.attackInterval * slowMultiplier;
    if (slowMultiplier > 1.01) {
      tower.el.classList.add("tower-jammed");
    } else {
      tower.el.classList.remove("tower-jammed");
    }

    if (now - tower.lastAttackTime < effectiveInterval) continue;

    const tx = tower.x;
    const ty = tower.y;

    /** @type {Enemy[]} */
    const inRangeEnemies = [];

    // 收集在射程内的敌人
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const ex = enemy.x;
      const ey = enemy.y;

      const dx = ex - tx;
      const dy = ey - ty;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 检查是否在射程内
      if (dist > tower.range) continue;
      
      // 检查是否在最小攻击距离内（如果设置了minRange）
      const minRange = tower.minRange || 0;
      if (dist < minRange) continue;

      inRangeEnemies.push(enemy);
    }

    if (inRangeEnemies.length === 0) continue;

    // 根据目标选择策略选择目标
    let target = null;
    if (tower.targetStrategy === "strongest") {
      // 选择血量最高的敌人
      let maxHp = -1;
      for (const enemy of inRangeEnemies) {
        if (enemy.hp > maxHp) {
          maxHp = enemy.hp;
          target = enemy;
        }
      }
    } else if (tower.targetStrategy === "lowest") {
      let lowestRatio = Infinity;
      for (const enemy of inRangeEnemies) {
        const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          target = enemy;
        }
      }
    } else {
      // 默认选择首个进入射程的敌人（"first"策略）
      // 这里简化为选择最近的敌人
      let nearestDist = Infinity;
      for (const enemy of inRangeEnemies) {
        const ex = enemy.x;
        const ey = enemy.y;
        const dx = ex - tx;
        const dy = ey - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          target = enemy;
        }
      }
    }

    if (!target) continue;

    // 获取目标位置
    const targetX = target.x;
    const targetY = target.y;

    // 创建子弹
    const bulletSpeed = tower.bulletSpeed || 400;
    let bulletStyle = tower.bulletStyle || "fast";
    let damage = tower.damage;
    if (tower.towerType === "executioner") {
      const threshold = tower.executionerThreshold ?? 0.2;
      const multiplier = tower.executionerMultiplier ?? 5;
      const ratio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
      if (ratio <= threshold) {
        damage *= multiplier;
        bulletStyle = "executioner";
      }
    }
    const bullet = createBullet(
      gameField,
      tx,
      ty,
      targetX,
      targetY,
      bulletSpeed,
      damage,
      bulletStyle,
      target,
      tower.aoeRadius || 0,
      tower.aoeDamage || 0
    );
    bullets.push(bullet);

    // 播放塔攻击效果
    playTowerAttackEffects(tower, target, [target]);

    tower.lastAttackTime = now;
  }
}

function selectPercentileTarget(tower, enemies, currentTarget) {
  if (currentTarget && currentTarget.alive) {
    const dx = currentTarget.x - tower.x;
    const dy = currentTarget.y - tower.y;
    if (Math.sqrt(dx * dx + dy * dy) <= tower.range) {
      return currentTarget;
    }
  }
  let selected = null;
  let highestHp = -Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > tower.range) continue;
    if (enemy.hp > highestHp) {
      highestHp = enemy.hp;
      selected = enemy;
    }
  }
  return selected;
}

function updatePercentileTower(tower, enemies, dtSeconds, now, gameField) {
  if (!tower.percentDamagePerSecond || dtSeconds <= 0) {
    if (tower.beamState?.beamEl) {
      tower.beamState.beamEl.remove();
      tower.beamState.beamEl = null;
    }
    return;
  }
  tower.beamState = tower.beamState || { target: null, beamEl: null };
  const state = tower.beamState;
  const target = selectPercentileTarget(tower, enemies, state.target);
  if (!target) {
    if (state.beamEl) {
      state.beamEl.remove();
      state.beamEl = null;
    }
    state.target = null;
    return;
  }
  const slowMultiplier = getTowerSlowMultiplier(tower, enemies);
  if (slowMultiplier > 1.01) {
    tower.el.classList.add("tower-jammed");
  } else {
    tower.el.classList.remove("tower-jammed");
  }
  state.target = target;
  const percent = tower.percentDamagePerSecond;
  const minPerSecond = tower.percentMinDamage || 0;
  const damagePerSecond = Math.max(minPerSecond, target.hp * percent);
  const damage = (damagePerSecond / slowMultiplier) * dtSeconds;
  applyDamageToEnemy(target, damage);
  renderPercentileBeam(tower, target, gameField, state);
  tower.lastAttackTime = now;
}

function renderPercentileBeam(tower, target, gameField, beamState) {
  if (!gameField) return;
  if (!beamState.beamEl) {
    const beam = document.createElement("div");
    beam.className = "percentile-beam";
    gameField.appendChild(beam);
    beamState.beamEl = beam;
  }
  const beam = beamState.beamEl;
  const dx = target.x - tower.x;
  const dy = target.y - tower.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  beam.style.left = `${tower.x}px`;
  beam.style.top = `${tower.y}px`;
  beam.style.width = `${length}px`;
  beam.style.transformOrigin = "0 50%";
  beam.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}

/**
 * 更新子弹位置并处理命中
 * @param {Array} bullets 子弹数组
 * @param {number} dtSeconds 时间差（秒）
 * @param {Enemy[]} enemies 敌人数组
 * @param {HTMLElement} gameField 战场DOM
 */
function updateBullets(bullets, dtSeconds, enemies, gameField) {
  const calculateDamage = (enemy, baseDamage) => {
    const armor = enemy.armor || 0;
    return Math.max(1, Math.floor(baseDamage * (1 - armor)));
  };

  for (const bullet of bullets) {
    if (!bullet.alive) continue;

    // 更新子弹位置
    const reached = updateBullet(bullet, dtSeconds);
    
    if (reached) {
      // 子弹到达目标位置，处理伤害
      if (bullet.style === "explosive" && bullet.aoeRadius > 0) {
        // 爆炸型子弹：对范围内所有敌人造成伤害
        const hitEnemies = [];
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= bullet.aoeRadius) {
            const actualDamage = calculateDamage(enemy, bullet.aoeDamage || bullet.damage);
            applyDamageToEnemy(enemy, actualDamage);
            hitEnemies.push(enemy);
          }
        }
        playBulletHitEffect(gameField, bullet, bullet.x, bullet.y);
      } else {
        // 单体伤害子弹
        if (bullet.target && bullet.target.alive) {
          const actualDamage = calculateDamage(bullet.target, bullet.damage);
          applyDamageToEnemy(bullet.target, actualDamage);
        }
        playBulletHitEffect(gameField, bullet, bullet.x, bullet.y);
      }
      bullet.alive = false;
    } else {
      // 检查是否命中目标（飞行过程中）
      if (bullet.target && bullet.target.alive) {
        if (checkBulletHit(bullet, bullet.target)) {
          // 命中目标
          if (bullet.style === "explosive" && bullet.aoeRadius > 0) {
            // 爆炸型：对范围内所有敌人造成伤害
            const hitEnemies = [];
            for (const enemy of enemies) {
              if (!enemy.alive) continue;
              const dx = bullet.x - enemy.x;
              const dy = bullet.y - enemy.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= bullet.aoeRadius) {
                const actualDamage = calculateDamage(enemy, bullet.aoeDamage || bullet.damage);
                applyDamageToEnemy(enemy, actualDamage);
                hitEnemies.push(enemy);
              }
            }
            playBulletHitEffect(gameField, bullet, bullet.x, bullet.y);
          } else {
            // 单体伤害
            const actualDamage = calculateDamage(bullet.target, bullet.damage);
            applyDamageToEnemy(bullet.target, actualDamage);
            playBulletHitEffect(gameField, bullet, bullet.x, bullet.y);
          }
          bullet.alive = false;
        }
      }
    }
  }

  // 清理死亡的子弹
  cleanupBullets(bullets);
}

/**
 * 塔攻擊時的視覺反饋：塔本體輕微縮放 + 發射子彈 + 目標敵人閃爍。
 * @param {Tower} tower
 * @param {Enemy | null} mainTarget
 * @param {Enemy[]} hitEnemies
 */
function playTowerAttackEffects(tower, mainTarget, hitEnemies) {
  const towerEl = tower.el;
  // 塔本體攻擊閃爍
  towerEl.classList.remove("tower-attacking");
  // @ts-ignore 強制重繪以重新觸發動畫
  void towerEl.offsetWidth;
  towerEl.classList.add("tower-attacking");

  // 子彈效果：從塔中心飛向主目標
  if (mainTarget && uiElements.gameField) {
    const bullet = document.createElement("div");
    bullet.className = "tower-bullet";
    bullet.style.left = `${tower.x}px`;
    bullet.style.top = `${tower.y}px`;
    uiElements.gameField.appendChild(bullet);

    const targetX = mainTarget.x;
    const targetY = mainTarget.y;

    requestAnimationFrame(() => {
      bullet.style.left = `${targetX}px`;
      bullet.style.top = `${targetY}px`;
      bullet.style.opacity = "0";
    });

    window.setTimeout(() => {
      bullet.remove();
    }, 220);
  }

  // 被擊中的敵人短暫閃爍
  for (const enemy of hitEnemies) {
    if (!enemy.alive) continue;
    const el = enemy.el;
    el.classList.remove("enemy-hit");
    // @ts-ignore
    void el.offsetWidth;
    el.classList.add("enemy-hit");
  }
}

/**
 * 切換遊戲速度（1x / 2x），並更新對應按鈕顯示。
 */
function toggleSpeed() {
  if (!state) return;
  state.speedMultiplier = state.speedMultiplier >= 2 ? 1 : 2;
  updateSpeedButton(state.speedMultiplier);
}

/**
 * 勝負判定。
 */
function checkGameEnd() {
  if (!state) return;

  if (state.baseHp <= 0) {
    hideBossStatusBar();
    state.activeBossId = null;
    // 失敗
    const totalWaves = state.currentLevelWaves.length;
    const reachedWave = Math.min(state.currentWaveIndex + 1, totalWaves);
    saveBestRecord(reachedWave);
    const best = loadBestRecord();
    updateBestRecord(best);

    state.running = false;
    showDefeat(best);
    return;
  }

  const totalWaves = state.currentLevelWaves.length;

  if (state.currentWaveIndex >= totalWaves && state.enemies.length === 0) {
    // 當前關卡所有波完成且無存活敵人 -> 關卡完成
    state.running = false;
    hideBossStatusBar();
    state.activeBossId = null;
    
    // 檢查是否還有下一關
    if (state.currentLevelIndex < LEVELS.length - 1) {
      // 還有下一關，顯示關卡完成界面
      const level = LEVELS[state.currentLevelIndex];
      showLevelComplete(level.name, state.enemiesKilledInLevel, state.totalEnemiesInLevel);
    } else {
      // 已是最後一關，顯示最終勝利界面
      const finalWave = totalWaves;
      saveBestRecord(finalWave);
      markEverWon();
      const best = loadBestRecord();
      updateBestRecord(best);
      showVictory(best);
    }
  }
}

/**
 * 處理卡牌點擊（進入對應使用模式）。
 * @param {Card} card
 */
function handleCardClick(card) {
  // 允許在遊戲運行時（包括暫停）選擇卡牌，但放置時需要遊戲運行
  if (!state) return;

  // 能量不足則給卡牌抖動提示
  if (state.energy < card.cost) {
    flashCardInsufficient(card.id);
    return;
  }

  // 再次點擊同一張卡，取消選擇
  if (selectedAction && selectedAction.card.id === card.id) {
    selectedAction = null;
    removeTowerPreview();
    clearTowerPlacementPreview();
    renderHandCards(state.handCards, handleCardClick, null, state.energy);
    updateHandEnergyState(state.energy);
    return;
  }

  // 設置選中的卡牌和模式
  if (card.type === "tower") {
    selectedAction = { card, mode: "place-tower" };
    ensureTowerPreview();
  } else if (card.type === "layout") {
    selectedAction = { card, mode: "layout-field" };
    removeTowerPreview();
  } else if (card.type === "style") {
    selectedAction = { card, mode: "target-tower" };
    removeTowerPreview();
  }

  renderHandCards(state.handCards, handleCardClick, selectedAction.card, state.energy);
  updateHandEnergyState(state.energy);
}

/**
 * 戰場鼠標移動事件，用於更新塔放置預覽位置。
 * 预览位置对齐到网格中心。
 * @param {MouseEvent} ev
 */
function handleFieldMouseMove(ev) {
  if (!selectedAction || selectedAction.mode !== "place-tower") return;

  const { x, y } = clientPointToFieldCoords(ev.clientX, ev.clientY);
  const fieldSize = getFieldDimensions();

  // 对齐到网格中心
  const grid = pixelToGrid(x, y);
  const pixelPos = gridToPixel(grid.row, grid.col);
  
  lastMousePos.x = Math.max(0, Math.min(fieldSize.width, pixelPos.x));
  lastMousePos.y = Math.max(0, Math.min(fieldSize.height, pixelPos.y));

  if (!towerPreviewEl) {
    ensureTowerPreview();
  }
  if (towerPreviewEl) {
    towerPreviewEl.style.left = `${lastMousePos.x}px`;
    towerPreviewEl.style.top = `${lastMousePos.y}px`;
  }
  
  // 【新逻辑】调试模式：显示塔放置预览（路径和可放置性）- 仅在放置塔模式下显示（通过featureFlags.debugOverlay控制）
  if (featureFlags.debugOverlay && getDebugMode() && state && selectedAction && selectedAction.mode === "place-tower") {
    const level = LEVELS[state.currentLevelIndex];
    const mapSize = getMapSize();
    const baseGrid = getBaseGrid(level);
    const spawnPointsGrid = getSpawnPointsGrid(level);
    
    // 创建isWalkable函数用于调试预览
    // 注意：调试预览时不需要允许BASE和入口可走，因为这是用于检查塔放置的
    const debugIsWalkable = (row, col) => {
      return isWalkable(row, col, state.towers, state.enemies, level, null, null, false, state);
    };
    
    updateTowerPlacementPreview(
      x,
      y,
      canPlaceTowerAt,
      level,
      debugIsWalkable,
      baseGrid,
      spawnPointsGrid
    );
  } else {
    clearTowerPlacementPreview();
  }
}

/**
 * 戰場點擊事件，根據當前選中卡牌的模式執行操作。
 * @param {MouseEvent} ev
 */
function handleFieldClick(ev) {
  if (!state) return;
  
  // 检查是否在使用道具
  if (state.itemManager && state.itemManager.usingItem) {
    const { x, y } = clientPointToFieldCoords(ev.clientX, ev.clientY);
    state.itemManager.useItemAtTarget(x, y, state.enemies);
    return;
  }
  
  if (!selectedAction) return;
  
  // 允许在 setup 或 battle 阶段放塔，禁止在 menu 或 paused 阶段放塔
  if (state.phase !== "setup" && state.phase !== "battle") return;

  const card = selectedAction.card;

  // 再次檢查能量是否足夠
  if (state.energy < card.cost) {
    flashCardInsufficient(card.id);
    return;
  }

  if (selectedAction.mode === "place-tower") {
    // 塔卡：在戰場放置塔
    const fieldSize = getFieldDimensions();
    let x = lastMousePos.x || fieldSize.width / 2;
    let y = lastMousePos.y || fieldSize.height / 2;
    
    // 对齐到网格中心
    const grid = pixelToGrid(x, y);
    const pixelPos = gridToPixel(grid.row, grid.col);
    x = pixelPos.x;
    y = pixelPos.y;

    // 使用新的canPlaceTowerAt函数判断是否可以放置
    const placementResult = canPlaceTowerAt(x, y);
    if (!placementResult.canPlace) {
      // 显示明确的错误提示
      showPlacementError(placementResult.reason || "不能放置塔", x, y);
      return; // 不創建塔
    }

    const towerType = card.config.towerType;
    const label = card.config.label || "T";

    // 使用邏輯時間而不是 performance.now()，確保與遊戲循環同步
    const tower = createTower(uiElements.gameField, towerType, x, y, label, state.logicTime || performance.now());
    state.towers.push(tower);
    attachTowerHoverHandlers(tower);
    
    // 如果已有布局卡buff，应用到新创建的塔
    if (activeLayoutBuffs.length > 0) {
      const fieldClass = uiElements.gameField.classList.contains("field-layout-flex") ? "flex" :
                         uiElements.gameField.classList.contains("field-layout-grid") ? "grid" : null;
      if (fieldClass === "flex") {
        // Flex Layout: 攻速+10%
        tower.attackInterval *= 0.9;
      } else if (fieldClass === "grid") {
        // Grid Layout: 伤害+15%
        tower.damage *= 1.15;
      }
    }
    
    // 塔放置成功后，通知所有敌人重新计算路径
    // 这个会在updateEnemies中自动处理（每次移动前重新寻路）

    state.energy -= card.cost;
    updateEnergy(state.energy, state.maxEnergy);
    updateHandEnergyState(state.energy);

    // 【新逻辑】塔放置成功后，为所有活着的敌人重新计算路径（通过featureFlags.newPathfinding控制）
    // 这样避免敌人沿旧路径穿过新放置的塔
    if (featureFlags.newPathfinding) {
      const level = LEVELS[state.currentLevelIndex];
      const mapSize = getMapSize();
      const baseGrid = getBaseGrid(level);
      const enemyIsWalkable = (row, col) => {
        return isWalkable(row, col, state.towers, state.enemies, level, null, null, true, state);
      };
      recalculateAllEnemyPaths(
        state.enemies,
        baseGrid,
        enemyIsWalkable,
        mapSize.width,
        mapSize.height,
        state.towers
      );
    }

    if (featureFlags.debugOverlay && getDebugMode()) {
      renderGridMarkers(state.map, state.towers, state.enemies);
    }

    selectedAction = null;
    removeTowerPreview();
    clearTowerPlacementPreview();
    renderHandCards(state.handCards, handleCardClick, null, state.energy);
  } else if (selectedAction.mode === "layout-field") {
    // 佈局卡：點擊戰場後，對整個戰場應用 CSS 類並給所有塔 buff
    applyLayoutCard(card);
    state.energy -= card.cost;
    updateEnergy(state.energy, state.maxEnergy);
    updateHandEnergyState(state.energy);

    selectedAction = null;
    renderHandCards(state.handCards, handleCardClick, null, state.energy);
  } else if (selectedAction.mode === "target-tower") {
    // 樣式卡：需要點擊具體塔
    const towerEl = /** @type {HTMLElement | null} */ (
      (ev.target instanceof HTMLElement && ev.target.closest(".tower")) || null
    );
    if (!towerEl) {
      return;
    }

    const tower = findTowerByElement(towerEl);
    if (!tower) return;

    applyStyleCardToTower(tower, card);
    state.energy -= card.cost;
    updateEnergy(state.energy, state.maxEnergy);
    updateHandEnergyState(state.energy);

    selectedAction = null;
    renderHandCards(state.handCards, handleCardClick, null, state.energy);
  }
}

/**
 * 為塔綁定鼠標懸停事件，用於顯示/隱藏攻擊範圍圈。
 * @param {Tower} tower
 */
function attachTowerHoverHandlers(tower) {
  tower.el.addEventListener("mouseenter", () => {
    showTowerRange(tower);
  });
  tower.el.addEventListener("mouseleave", () => {
    hideTowerRange();
  });
}

/**
 * 顯示指定塔的攻擊範圍圈。
 * @param {Tower} tower
 */
function showTowerRange(tower) {
  if (!tower.alive) return;
  if (!towerRangeEl) {
    towerRangeEl = document.createElement("div");
    towerRangeEl.className = "tower-range-indicator";
    uiElements.gameField.appendChild(towerRangeEl);
  }
  const diameter = tower.range * 2;
  towerRangeEl.style.width = `${diameter}px`;
  towerRangeEl.style.height = `${diameter}px`;
  towerRangeEl.style.left = `${tower.x}px`;
  towerRangeEl.style.top = `${tower.y}px`;
  towerRangeEl.classList.add("visible");
}

/**
 * 隱藏塔攻擊範圍圈。
 */
function hideTowerRange() {
  if (!towerRangeEl) return;
  towerRangeEl.classList.remove("visible");
}

/**
 * 確保塔放置預覽元素存在。
 */
function ensureTowerPreview() {
  if (!towerPreviewEl) {
    towerPreviewEl = document.createElement("div");
    towerPreviewEl.className = "tower-preview";
    uiElements.gameField.appendChild(towerPreviewEl);
  }
}

/**
 * 移除塔放置預覽元素。
 */
function removeTowerPreview() {
  if (towerPreviewEl && towerPreviewEl.parentElement) {
    towerPreviewEl.parentElement.removeChild(towerPreviewEl);
  }
  towerPreviewEl = null;
}

/**
 * 將佈局卡應用到戰場與所有塔。
 * @param {Card} card
 */
function applyLayoutCard(card) {
  const cfg = card.config || {};
  const fieldClass = cfg.fieldClass;
  const attackIntervalMultiplier =
    typeof cfg.attackIntervalMultiplier === "number" ? cfg.attackIntervalMultiplier : 1;
  const damageMultiplier =
    typeof cfg.damageMultiplier === "number" ? cfg.damageMultiplier : 1;

  if (fieldClass) {
    uiElements.gameField.classList.remove("field-layout-flex", "field-layout-grid");
    uiElements.gameField.classList.add(fieldClass);
  }

  if (!state) return;

  // 应用buff到所有现有塔
  for (const tower of state.towers) {
    tower.attackInterval *= attackIntervalMultiplier;
    tower.damage *= damageMultiplier;
  }
  
  // 记录已激活的布局卡buff
  const buffName = card.name;
  let effectText = "";
  if (attackIntervalMultiplier < 1) {
    const speedBoost = Math.round((1 - attackIntervalMultiplier) * 100);
    effectText = `攻速＋${speedBoost}%`;
  } else if (damageMultiplier > 1) {
    const damageBoost = Math.round((damageMultiplier - 1) * 100);
    effectText = `伤害＋${damageBoost}%`;
  }
  
  // 移除同类型的旧buff（布局卡通常只能有一个生效）
  activeLayoutBuffs = activeLayoutBuffs.filter(b => b.name !== buffName);
  
  if (effectText) {
    activeLayoutBuffs.push({ name: buffName, effect: effectText });
  }
  
  // 更新UI显示
  updateActiveBuffs(activeLayoutBuffs);
}

/**
 * 根據塔元素查找對應的 Tower 對象。
 * @param {HTMLElement} el
 * @returns {Tower | null}
 */
function findTowerByElement(el) {
  if (!state) return null;
  const id = el.dataset.towerId;
  if (!id) return null;
  return state.towers.find((t) => t.id === id) || null;
}

/**
 * 切換暫停 / 繼續。
 * 
 * 暫停時：記錄 pauseStartTime，開始計時
 * 恢復時：清空 pauseStartTime，重置計時
 * 只作用於 battle 階段
 */
function togglePause() {
  if (!state || !state.running) return;
  
  // 只在 battle 或 paused 階段允許切換
  if (state.phase !== "battle" && state.phase !== "paused") return;
  
  const wasPaused = state.paused;
  state.paused = !state.paused;
  
  if (state.paused && !wasPaused) {
    // 剛進入暫停狀態：記錄暫停開始時間，切換 phase 到 paused
    state.pauseStartTime = performance.now();
    state.phase = "paused";
  } else if (!state.paused && wasPaused) {
    // 剛恢復遊戲：清空暫停開始時間，重置計時，切換 phase 回 battle
    state.pauseStartTime = null;
    state.phase = "battle";
  }
  
  updatePauseButton(state.paused);
}

/**
 * 檢查新塔是否與已有塔重疊。
 * @param {Tower[]} towers 已有塔列表
 * @param {number} newX 新塔中心 x 座標（像素）
 * @param {number} newY 新塔中心 y 座標（像素）
 * @param {number} w 新塔寬度（像素）
 * @param {number} h 新塔高度（像素）
 * @returns {boolean} 如果重疊返回 true
 */
function isTowerOverlapping(towers, newX, newY, w, h) {
  // 計算新塔的矩形邊界（塔使用中心點定位，需要轉換為左上角座標）
  const newRect = {
    left: newX - w / 2,
    top: newY - h / 2,
    right: newX + w / 2,
    bottom: newY + h / 2,
  };

  for (const tower of towers) {
    if (!tower.alive) continue;

    // 計算已有塔的矩形邊界（同樣使用中心點轉換）
    const rect = {
      left: tower.x - w / 2,
      top: tower.y - h / 2,
      right: tower.x + w / 2,
      bottom: tower.y + h / 2,
    };

    // 矩形重疊檢測
    if (
      !(newRect.right <= rect.left ||
        newRect.left >= rect.right ||
        newRect.bottom <= rect.top ||
        newRect.top >= rect.bottom)
    ) {
      return true; // 重疊
    }
  }

  return false; // 不重疊
}

/**
 * 檢查塔中心點是否落在障礙物矩形內部。
 * @param {number} towerX 塔中心 x 座標（像素）
 * @param {number} towerY 塔中心 y 座標（像素）
 * @param {typeof LEVELS[0]} level 關卡配置對象
 * @returns {boolean} 如果落在障礙物內部返回 true
 */
function isTowerOnObstacle(towerX, towerY) {
  if (!state?.map) return false;
  const grid = pixelToGrid(towerX, towerY);
  return state.map.gridObstacles.some(
    (obs) => grid.row >= obs.y && grid.row < obs.y + obs.h && grid.col >= obs.x && grid.col < obs.x + obs.w
  );
}

/**
 * 計算點到線段的最短距離。
 * @param {number} px 點的 x 座標
 * @param {number} py 點的 y 座標
 * @param {number} x1 線段起點 x
 * @param {number} y1 線段起點 y
 * @param {number} x2 線段終點 x
 * @param {number} y2 線段終點 y
 * @returns {number} 最短距離（像素）
 */
function pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    // 線段退化為點
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  
  // 計算投影參數 t
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  
  // 計算投影點
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  
  // 返回點到投影點的距離
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * 檢查塔是否過於靠近敵人路徑。
 * @param {number} towerX 塔中心 x 座標（像素）
 * @param {number} towerY 塔中心 y 座標（像素）
 * @param {typeof LEVELS[0]} level 關卡配置對象
 * @param {number} towerRadius 塔的碰撞半徑（像素）
 * @returns {boolean} 如果過於靠近路徑返回 true
 */
function isTowerTooCloseToPath(towerX, towerY, level, towerRadius) {
  const previewPaths = state?.map?.previewPaths && state.map.previewPaths.length > 0
    ? state.map.previewPaths
    : level.previewPaths;
  if (!previewPaths || previewPaths.length === 0) return false;

  const fieldSize = getFieldDimensions();
  const minDistance = towerRadius + 8;

  for (const path of previewPaths) {
    if (!path || path.length < 2) continue;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      const x1 = p1.x * fieldSize.width;
      const y1 = p1.y * fieldSize.height;
      const x2 = p2.x * fieldSize.width;
      const y2 = p2.y * fieldSize.height;
      const dist = pointToLineSegmentDistance(towerX, towerY, x1, y1, x2, y2);
      if (dist < minDistance) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 获取地图尺寸（格子数）
 * @returns {{width: number, height: number}} 地图宽度和高度（格子数）
 */
function getMapSize() {
  if (state?.map) {
    return { width: state.map.width, height: state.map.height };
  }
  const fieldRect = getFieldDimensions();
  return {
    width: Math.max(1, Math.floor(fieldRect.width / GRID_CONFIG.TILE_SIZE)),
    height: Math.max(1, Math.floor(fieldRect.height / GRID_CONFIG.TILE_SIZE)),
  };
}

/**
 * 判断格子是否可走（用于寻路）
 * @param {number} row 行
 * @param {number} col 列
 * @param {Tower[]} towers 塔列表
 * @param {Enemy[]} enemies 敌人列表（用于检查是否有敌人站在该格子）
 * @param {typeof LEVELS[0]} level 关卡配置
 * @param {number} testTowerRow 测试放置的塔所在行（可选，用于判断塔放置）
 * @param {number} testTowerCol 测试放置的塔所在列（可选）
 * @param {boolean} allowBaseAndSpawn 是否允许BASE和入口点可走（用于敌人寻路，默认false）
 * @param {GameState} [gameState] 游戏状态（可选）
 * @returns {boolean} 如果可走返回true
 */
function isWalkable(
  row,
  col,
  towers,
  enemies,
  level,
  testTowerRow = null,
  testTowerCol = null,
  allowBaseAndSpawn = false,
  gameState = null
) {
  const mapState = gameState?.map || state?.map || null;
  const mapSize = mapState ? { width: mapState.width, height: mapState.height } : getMapSize();

  if (row < 0 || row >= mapSize.height || col < 0 || col >= mapSize.width) {
    return false;
  }

  if (testTowerRow !== null && testTowerCol !== null && row === testTowerRow && col === testTowerCol) {
    return false;
  }

  const baseGrid = mapState?.baseGrid || (level ? getBaseGrid(level) : null);
  const spawnGrids = mapState?.spawnGrids || (level ? getSpawnPointsGrid(level) : []);

  let blocked = false;
  if (mapState?.blockedGrid) {
    blocked = mapState.blockedGrid[row]?.[col] ?? false;
  } else if (level) {
    const fallbackObstacles = getConfiguredGridObstacles(level, mapSize.width, mapSize.height);
    blocked = fallbackObstacles.some(
      (obs) => row >= obs.y && row < obs.y + obs.h && col >= obs.x && col < obs.x + obs.w
    );
  }

  if (blocked) {
    const isBaseTile = baseGrid && row === baseGrid.row && col === baseGrid.col;
    const isSpawnTile = spawnGrids.some((spawn) => row === spawn.row && col === spawn.col);
    if (!(allowBaseAndSpawn && (isBaseTile || isSpawnTile))) {
      return false;
    }
  }

  if (!allowBaseAndSpawn) {
    if (baseGrid && row === baseGrid.row && col === baseGrid.col) {
      return false;
    }
    if (spawnGrids.some((spawn) => row === spawn.row && col === spawn.col)) {
      return false;
    }
  }

  const towerList = gameState?.towers ?? towers;
  for (const tower of towerList) {
    if (!tower.alive) continue;
    const towerGrid = pixelToGrid(tower.x, tower.y);
    if (row === towerGrid.row && col === towerGrid.col) {
      return false;
    }
  }

  if (!allowBaseAndSpawn) {
    const enemyList = gameState?.enemies ?? enemies;
    for (const enemy of enemyList) {
      if (!enemy.alive) continue;
      const enemyGrid = pixelToGrid(enemy.x, enemy.y);
      if (row === enemyGrid.row && col === enemyGrid.col) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 获取所有入口点（spawnPoints）的网格坐标
 * @param {typeof LEVELS[0]} level 关卡配置
 * @returns {Array<{row: number, col: number}>} 入口点网格坐标数组
 */
function getSpawnPointsGrid(level) {
  if (state?.map?.spawnGrids) {
    return state.map.spawnGrids;
  }
  if (!level.spawnPoints || level.spawnPoints.length === 0) return [];

  const fieldRect = getFieldDimensions();
  return level.spawnPoints.map((spawn) => {
    const pixelX = spawn.x * fieldRect.width;
    const pixelY = spawn.y * fieldRect.height;
    return pixelToGrid(pixelX, pixelY);
  });
}

/**
 * 获取BASE的网格坐标
 * @param {typeof LEVELS[0]} level 关卡配置
 * @returns {{row: number, col: number} | null} BASE网格坐标
 */
function getBaseGrid(level) {
  if (state?.map?.baseGrid) {
    return state.map.baseGrid;
  }
  if (!level.basePosition) return null;

  const fieldRect = getFieldDimensions();
  const baseX = level.basePosition.x * fieldRect.width;
  const baseY = level.basePosition.y * fieldRect.height;
  return pixelToGrid(baseX, baseY);
}

/**
 * 判断是否可以在指定位置放置塔
 * 使用寻路算法判断放置后是否仍有从入口到BASE的路径
 * @param {number} tileX 塔的像素X坐标
 * @param {number} tileY 塔的像素Y坐标
 * @returns {{canPlace: boolean, reason?: string}} 如果可以放置返回{canPlace: true}，否则返回{canPlace: false, reason: string}
 */
function canPlaceTowerAt(tileX, tileY) {
  if (!state) {
    return { canPlace: false, reason: "游戏未开始" };
  }

  const level = LEVELS[state.currentLevelIndex];
  const mapState = state.map;
  const mapSize = getMapSize();
  const towerGrid = pixelToGrid(tileX, tileY);

  if (towerGrid.row < 0 || towerGrid.row >= mapSize.height || towerGrid.col < 0 || towerGrid.col >= mapSize.width) {
    return { canPlace: false, reason: "超出地图范围" };
  }

  const spawnPoints = getSpawnPointsGrid(level);
  const baseGrid = getBaseGrid(level);

  if (baseGrid && towerGrid.row === baseGrid.row && towerGrid.col === baseGrid.col) {
    return { canPlace: false, reason: "不能覆盖基地" };
  }

  for (const spawn of spawnPoints) {
    if (towerGrid.row === spawn.row && towerGrid.col === spawn.col) {
      return { canPlace: false, reason: "不能覆盖入口" };
    }
  }

  for (const tower of state.towers) {
    if (!tower.alive) continue;
    const existingTowerGrid = pixelToGrid(tower.x, tower.y);
    if (towerGrid.row === existingTowerGrid.row && towerGrid.col === existingTowerGrid.col) {
      return { canPlace: false, reason: "该位置已有塔" };
    }
  }

  const isBlocked = mapState?.blockedGrid
    ? mapState.blockedGrid[towerGrid.row]?.[towerGrid.col]
    : !isWalkable(towerGrid.row, towerGrid.col, state.towers, state.enemies, level, null, null, false, state);
  if (isBlocked) {
    return { canPlace: false, reason: "不能覆盖障碍物" };
  }

  if (!featureFlags.newTowerBlockCheck || !mapState || !baseGrid || spawnPoints.length === 0) {
    return { canPlace: true };
  }

  const testObstacle = { x: towerGrid.col, y: towerGrid.row, w: 1, h: 1 };
  const testLayout = [...mapState.gridObstacles, testObstacle];
  const pathOk = pathsRemain(spawnPoints, baseGrid, testLayout, mapState.width, mapState.height);
  if (!pathOk) {
    return { canPlace: false, reason: "不能完全堵死道路" };
  }

  return { canPlace: true };
}

/**
 * 显示塔放置错误提示
 * @param {string} reason 错误原因
 * @param {number} x 像素X坐标
 * @param {number} y 像素Y坐标
 */
function showPlacementError(reason, x, y) {
  // 创建错误提示元素
  let errorTip = document.getElementById("tower-placement-error-tip");
  
  if (!errorTip) {
    errorTip = document.createElement("div");
    errorTip.id = "tower-placement-error-tip";
    errorTip.className = "tower-placement-error-tip";
    uiElements.gameField.appendChild(errorTip);
  }
  
  errorTip.textContent = reason;
  errorTip.style.left = `${x}px`;
  errorTip.style.top = `${y - 40}px`;
  errorTip.style.transform = "translate(-50%, 0)";
  
  // 显示提示
  errorTip.classList.remove("tower-placement-error-tip--visible");
  // 强制重绘
  // @ts-ignore
  void errorTip.offsetWidth;
  errorTip.classList.add("tower-placement-error-tip--visible");
  
  // 1.5秒后隐藏
  setTimeout(() => {
    if (errorTip) {
      errorTip.classList.remove("tower-placement-error-tip--visible");
    }
  }, 1500);
}


