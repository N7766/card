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
  getTotalEnemiesForLevel,
  AUTO_BACK_TO_MENU_MS,
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
  updateDebugButton,
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
} from "./ui.js";
import { createTower, applyStyleCardToTower } from "./tower.js";
import { spawnEnemy, updateEnemies, recalculateAllEnemyPaths } from "./enemy.js";
import { loadBestRecord, saveBestRecord, markEverWon } from "./storage.js";
import { TOWER_WIDTH, TOWER_HEIGHT } from "./config.js";
import { pixelToGrid, gridToPixel, findPath, hasPath, GRID_CONFIG } from "./pathfinding.js";
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
 * @property {number} waveIndex 當前波索引（0 開始）
 * @property {boolean} running 是否正在運行
 * @property {boolean} paused 是否暫停
 * @property {"menu"|"setup"|"battle"|"paused"} phase 遊戲階段：menu=主菜單，setup=布置階段，battle=戰鬥階段，paused=暫停
 * @property {Card[]} handCards
 * @property {number} lastFrameTime 上一幀時間戳（毫秒）
 * @property {boolean} waveFinishedSpawning 當前波是否已全部生成
 * @property {number} spawnCursor 當前波中正在處理的敵人組索引
 * @property {number} spawnedInCurrentGroup 當前敵人組已生成數量
 * @property {number} timeSinceLastSpawn 當前組距上一個敵人生成的時間
 * @property {number} timeSinceWaveCleared 當前波敵人全部清除後經過的時間
 * @property {number} logicTime 遊戲邏輯時間（毫秒，用於與可調速度掛鉤）
 * @property {number} speedMultiplier 遊戲速度倍率（1 表示正常，2 表示 2 倍速）
 * @property {number} currentLevelIndex 當前關卡索引（0 開始）
 * @property {number} enemiesKilledInLevel 本關已擊殺敵人數
 * @property {number} totalEnemiesInLevel 本關總敵人數
 * @property {Array} currentLevelWaves 當前關卡的波次配置
 * @property {number | null} pauseStartTime 暫停開始的時間戳（毫秒），null 表示未暫停或已恢復
 */

/** @type {GameState | null} */
let state = null;

/** @type {number | null} */
let animationFrameId = null;

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
  }

  // 重置选中状态
  selectedAction = null;
  removeTowerPreview();

  // 隐藏所有覆盖层
  hideResultOverlays();
  hideLevelComplete();
  
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
 * 调试函数：在控制台暴露，方便测试寻路和塔放置
 */
export function debugPathfinding() {
  if (!state) {
    console.log("[调试] 游戏未开始");
    return;
  }
  
  const level = LEVELS[state.currentLevelIndex];
  const mapSize = getMapSize();
  const spawnPoints = getSpawnPointsGrid(level);
  const baseGrid = getBaseGrid(level);
  
  console.log("[调试] 地图信息:", {
    mapSize,
    spawnPoints,
    baseGrid,
    towersCount: state.towers.length,
    enemiesCount: state.enemies.length,
  });
  
  // 测试从每个入口到BASE的路径
  if (baseGrid && spawnPoints.length > 0) {
    const isWalkableFunc = (row, col) => {
      // 调试寻路时应该允许BASE和入口点可走
      return isWalkable(row, col, state.towers, state.enemies, level, null, null, true);
    };
    
    spawnPoints.forEach((spawn, index) => {
      const hasPath = findPath(
        spawn.row,
        spawn.col,
        baseGrid.row,
        baseGrid.col,
        isWalkableFunc,
        mapSize.width,
        mapSize.height
      );
      console.log(`[调试] 入口${index + 1} (${spawn.row}, ${spawn.col}) 到 BASE:`, 
        hasPath ? `有路径 (${hasPath.length}步)` : "无路径");
    });
  }
}

// 在控制台暴露调试函数
if (typeof window !== 'undefined') {
  window.debugPathfinding = debugPathfinding;
}

/**
 * 初始化遊戲，綁定 UI 事件並顯示開始界面。
 */
export function initGame() {
  const best = loadBestRecord();
  updateBestRecord(best);

  // 初始化调试模式
  const isDebug = initDebugMode();
  updateDebugButton(isDebug);

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
    onToggleDebug: () => {
      const isDebug = toggleDebugMode();
      updateDebugButton(isDebug);
      // 如果开启调试模式，重新渲染格子标记
      if (isDebug && state) {
        const level = LEVELS[state.currentLevelIndex];
        renderGridMarkers(level, state.towers, state.enemies);
      }
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
}

/**
 * 創建新的遊戲狀態。
 * @param {number} levelIndex 關卡索引
 * @returns {GameState}
 */
function createInitialState(levelIndex) {
  const level = LEVELS[levelIndex];
  const totalEnemies = getTotalEnemiesForLevel(level);
  
  /** @type {GameState} */
  const s = {
    towers: [],
    enemies: [],
    baseHp: INITIAL_BASE_HP,
    maxBaseHp: INITIAL_BASE_HP,
    energy: INITIAL_ENERGY,
    maxEnergy: MAX_ENERGY,
    waveIndex: 0,
    running: false,
    paused: false,
    phase: "menu", // 初始為菜單階段
    handCards: getInitialHand(),
    lastFrameTime: performance.now(),
    waveFinishedSpawning: false,
    spawnCursor: 0,
    spawnedInCurrentGroup: 0,
    timeSinceLastSpawn: 0,
    timeSinceWaveCleared: 0,
    logicTime: 0,
    speedMultiplier: 1,
    currentLevelIndex: levelIndex,
    enemiesKilledInLevel: 0,
    totalEnemiesInLevel: totalEnemies,
    currentLevelWaves: level.waves,
    pauseStartTime: null, // 暫停開始時間，null 表示未暫停
  };
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

  // 設置當前關卡的出生點
  currentSpawnPoints = level.spawnPoints || [];

  // 更新 BASE 位置
  updateBasePosition(level.basePosition);

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

  // 渲染障礙物
  renderObstacles(level);

  // 重置布局卡buff
  activeLayoutBuffs = [];
  updateActiveBuffs([]);
  
  // 移除所有布局类
  field.classList.remove("field-layout-flex", "field-layout-grid");

  // 初始化UI状态（在显示气泡前）
  const bestRecord = loadBestRecord();
  updateBestRecord(bestRecord);
  updateHp(state.baseHp, state.maxBaseHp);
  updateEnergy(state.energy, state.maxEnergy);
  // 使用新的整合函数更新战局进度
  updateBattleProgress(
    levelIndex,
    level.name,
    state.waveIndex,
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
  
  // 检查 BASE 与障碍物的碰撞
  checkBaseObstacleCollision(level);
  
  // 确保 previewPaths 末点接近 basePosition
  ensurePathsEndAtBase(level);
  
  // 显示关卡开始气泡
  const prepTime = level.setupTimeSeconds || 10; // 从关卡配置获取布置时间
  // 根据关卡生成描述
  let description = "准备防御，敌人即将来袭！";
  if (levelIndex === 0) {
    description = "敌人从顶部两侧进攻，尝试用 DIV 塔守住正面。";
  } else if (levelIndex === 1) {
    description = "敌人从四个方向进攻，BASE 位于中央，需要全方位防御。";
  } else if (levelIndex === 2) {
    description = "终极挑战！敌人从多个方向同时进攻，合理使用布局卡和样式卡。";
  }
  
  // 构建关卡信息对象
  const levelInfo = {
    difficulty: level.difficulty || 1,
    enemyTypes: level.enemyTypes || [],
    recommended: level.recommended || "",
  };
  
  // 显示路径预览和障碍物高亮（布置阶段）
  showPathPreview(level);
  highlightObstacles();
  
  // 初始化调试模式（如果开启）
  if (getDebugMode()) {
    renderGridMarkers(level, state.towers, state.enemies);
  }
  
  // 验证初始状态：确保在没有塔的情况下，入口到BASE有路径
  const spawnPointsGrid = getSpawnPointsGrid(level);
  const baseGrid = getBaseGrid(level);
  if (baseGrid && spawnPointsGrid.length > 0) {
    const testIsWalkable = (row, col) => {
      return isWalkable(row, col, state.towers, state.enemies, level, null, null, true);
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
      showWaveToast(`第 ${state.waveIndex + 1} 波開始`, "start");
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
 * 根據關卡配置渲染障礙物 DOM。
 * @param {typeof LEVELS[0]} level 關卡配置對象
 */
function renderObstacles(level) {
  const field = uiElements.gameField;
  
  // 先清除舊的障礙物
  const oldObstacles = field.querySelectorAll(".obstacle");
  oldObstacles.forEach(obs => obs.remove());
  
  // 如果關卡沒有障礙物配置，直接返回
  if (!level.obstacles || level.obstacles.length === 0) {
    return;
  }
  
  // 使用 requestAnimationFrame 確保 DOM 已渲染後再計算位置
  requestAnimationFrame(() => {
    const fieldRect = field.getBoundingClientRect();
    
    // 創建障礙物 DOM
    for (const obs of level.obstacles) {
      const obstacleEl = document.createElement("div");
      obstacleEl.className = "obstacle";
      
      // 將相對座標（0~1）轉換為絕對像素位置
      const x = obs.x * fieldRect.width;
      const y = obs.y * fieldRect.height;
      const width = obs.width * fieldRect.width;
      const height = obs.height * fieldRect.height;
      
      obstacleEl.style.left = `${x}px`;
      obstacleEl.style.top = `${y}px`;
      obstacleEl.style.width = `${width}px`;
      obstacleEl.style.height = `${height}px`;
      
      // 將障礙物插入到基地之前，確保基地在最上層
      field.insertBefore(obstacleEl, uiElements.baseEl);
    }
  });
}

/**
 * 檢查 BASE 與障礙物的碰撞，如果重疊或距離過近則在控制台警告。
 * @param {typeof LEVELS[0]} level 關卡配置對象
 */
function checkBaseObstacleCollision(level) {
  if (!level.obstacles || level.obstacles.length === 0) return;
  if (!level.basePosition) return;
  
  requestAnimationFrame(() => {
    const fieldRect = uiElements.gameField.getBoundingClientRect();
    const baseRect = uiElements.baseEl.getBoundingClientRect();
    
    // 計算 BASE 中心的世界座標
    const baseX = level.basePosition.x * fieldRect.width;
    const baseY = level.basePosition.y * fieldRect.height;
    
    // BASE 的矩形（假設 BASE 是圓形，使用半徑作為碰撞盒）
    const BASE_RADIUS_PX = BASE_RADIUS;
    const baseRectWorld = {
      left: baseX - BASE_RADIUS_PX,
      top: baseY - BASE_RADIUS_PX,
      right: baseX + BASE_RADIUS_PX,
      bottom: baseY + BASE_RADIUS_PX,
    };
    
    // 檢查每個障礙物
    for (const obs of level.obstacles) {
      const obsX = obs.x * fieldRect.width;
      const obsY = obs.y * fieldRect.height;
      const obsWidth = obs.width * fieldRect.width;
      const obsHeight = obs.height * fieldRect.height;
      
      const obsRect = {
        left: obsX,
        top: obsY,
        right: obsX + obsWidth,
        bottom: obsY + obsHeight,
      };
      
      // 檢查矩形重疊
      const overlaps = !(
        baseRectWorld.right <= obsRect.left ||
        baseRectWorld.left >= obsRect.right ||
        baseRectWorld.bottom <= obsRect.top ||
        baseRectWorld.top >= obsRect.bottom
      );
      
      if (overlaps) {
        console.warn(
          `[DOM 塔防卡] 警告：關卡 ${level.id} (${level.name}) 的 BASE 位置與障礙物重疊！`,
          `BASE: (${level.basePosition.x.toFixed(2)}, ${level.basePosition.y.toFixed(2)})`,
          `障礙物: (${obs.x.toFixed(2)}, ${obs.y.toFixed(2)}, ${obs.width.toFixed(2)}, ${obs.height.toFixed(2)})`
        );
      }
    }
  });
}

/**
 * 確保 previewPaths 的末點接近 basePosition。
 * 如果末點離基地超過 30 像素，自動在路徑末尾追加基地中心點。
 * @param {typeof LEVELS[0]} level 關卡配置對象
 */
function ensurePathsEndAtBase(level) {
  if (!level.previewPaths || level.previewPaths.length === 0) return;
  if (!level.basePosition) return;
  
  requestAnimationFrame(() => {
    const fieldRect = uiElements.gameField.getBoundingClientRect();
    const baseX = level.basePosition.x * fieldRect.width;
    const baseY = level.basePosition.y * fieldRect.height;
    const threshold = 30; // 30 像素閾值
    
    let modified = false;
    
    for (const path of level.previewPaths) {
      if (!path || path.length === 0) continue;
      
      const lastPoint = path[path.length - 1];
      const lastX = lastPoint.x * fieldRect.width;
      const lastY = lastPoint.y * fieldRect.height;
      
      const distToBase = Math.sqrt(
        (lastX - baseX) ** 2 + (lastY - baseY) ** 2
      );
      
      if (distToBase > threshold) {
        // 追加基地中心點
        path.push({ x: level.basePosition.x, y: level.basePosition.y });
        modified = true;
      }
    }
    
    if (modified) {
      console.log(
        `[DOM 塔防卡] 已自動調整關卡 ${level.id} 的路徑，確保末點接近基地`
      );
    }
  });
}

/**
 * 遊戲主循環。
 * @param {number} timestamp
 */
function gameLoop(timestamp) {
  if (!state || !state.running) return;

  const delta = timestamp - state.lastFrameTime;
  state.lastFrameTime = timestamp;

  // 檢查長時間暫停自動返回主菜單
  checkAutoBackToMenu(timestamp);

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

  // 能量恢復：受到遊戲速度倍率影響
  state.energy = Math.min(
    state.maxEnergy,
    state.energy + ENERGY_REGEN_PER_SECOND * dtSeconds
  );
  updateEnergy(state.energy, state.maxEnergy);
  updateHandEnergyState(state.energy);

  // 波次與敵人生成
  updateWaveSpawning(scaledDelta);

  // 基地位置（每幀計算一次，避免視口調整問題）
  const basePos = getBasePosition();

  // 更新敵人位置與與基地碰撞
  const level = LEVELS[state.currentLevelIndex];
  const mapSize = getMapSize();
  const baseGrid = getBaseGrid(level);
  
  // 创建isWalkable函数，用于敌人寻路
  // 注意：敌人寻路时应该允许到达BASE和入口点（allowBaseAndSpawn = true）
  const enemyIsWalkable = (row, col) => {
    return isWalkable(row, col, state.towers, state.enemies, level, null, null, true);
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
    state.towers // 传递塔列表，用于智能敌人的危险度计算
  );

  // 调试模式：更新敌人路径可视化和穿墙检测
  if (getDebugMode()) {
    updateEnemyPaths(state.enemies, baseGrid);
    
    // 检测所有敌人的穿墙问题
    for (const enemy of state.enemies) {
      if (enemy.alive) {
        checkEnemyCollision(enemy, enemyIsWalkable, level);
      }
    }
    
    // 更新格子标记（显示敌人当前位置）
    renderGridMarkers(level, state.towers, state.enemies);
  }

  // 腳本注入怪干擾塔：靠近塔時可能暫時禁用塔
  applyScriptDisruption(state.towers, state.enemies, logicNow);

  // 塔攻擊敵人
  updateTowers(state.towers, state.enemies, logicNow);

  // 清理死亡敵人與無效塔
  state.enemies = state.enemies.filter((e) => e.alive);
  state.towers = state.towers.filter((t) => t.alive);

  // 勝負判定
  checkGameEnd();
}

/**
 * 更新波次生成與切換。
 * @param {number} delta
 */
function updateWaveSpawning(delta) {
  if (!state) return;
  const totalWaves = state.currentLevelWaves.length;
  if (state.waveIndex >= totalWaves) {
    // 所有波配置已完成，不再生成新的敵人
    return;
  }

  const wave = state.currentLevelWaves[state.waveIndex];

  if (!state.waveFinishedSpawning) {
    const group = wave.enemies[state.spawnCursor];
    if (!group) {
      state.waveFinishedSpawning = true;
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
        null, // previewPaths已废弃，保留兼容性
        level.basePosition || null
      );
      state.enemies.push(enemy);
      
      // 敌人生成时标记需要立即计算路径（路径为空，在updateEnemies中会自动计算）
      // 这样可以确保敌人生成后第一次更新时就能获得路径并开始移动
      enemy.needsPathRecalculation = true;
      console.log(`[updateWaveSpawning] 敌人 ${enemy.id} 生成，位置(${enemy.row},${enemy.col})，等待计算路径`);
      
      state.spawnedInCurrentGroup++;
    }

    if (state.spawnedInCurrentGroup >= group.count) {
      state.spawnCursor++;
      state.spawnedInCurrentGroup = 0;
      state.timeSinceLastSpawn = 0;
      if (state.spawnCursor >= wave.enemies.length) {
        state.waveFinishedSpawning = true;
      }
    }
  } else {
    // 當前波所有敵人生成完畢，等待全部被消滅後，延遲一段時間進入下一波
    const aliveEnemies = state.enemies.some((e) => e.alive);
    if (!aliveEnemies) {
      // 第一次清空該波敵人時給出提示
      if (state.timeSinceWaveCleared === 0) {
        showWaveToast(`第 ${wave.id} 波已清除`, "clear");
      }
      state.timeSinceWaveCleared += delta;
      if (state.timeSinceWaveCleared >= wave.delayAfter) {
        state.waveIndex++;
        if (state.waveIndex < totalWaves) {
          // 初始化下一波
          state.waveFinishedSpawning = false;
          state.spawnCursor = 0;
          state.spawnedInCurrentGroup = 0;
          state.timeSinceLastSpawn = 0;
          state.timeSinceWaveCleared = 0;
          updateWave(state.waveIndex, totalWaves);
          showWaveToast(`第 ${state.waveIndex + 1} 波開始`, "start");
        }
      }
    } else {
      state.timeSinceWaveCleared = 0;
    }
  }
}

/**
 * 獲取基地中心在戰場中的座標。
 * @returns {{ x: number, y: number }}
 */
function getBasePosition() {
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  const baseRect = uiElements.baseEl.getBoundingClientRect();
  return {
    x: baseRect.left - fieldRect.left + baseRect.width / 2,
    y: baseRect.top - fieldRect.top + baseRect.height / 2,
  };
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
    const er = enemy.el.getBoundingClientRect();
    const ex = er.left + er.width / 2;
    const ey = er.top + er.height / 2;

    for (const tower of towers) {
      if (!tower.alive) continue;
      const tr = tower.el.getBoundingClientRect();
      const tx = tr.left + tr.width / 2;
      const ty = tr.top + tr.height / 2;
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

/**
 * 更新塔攻擊敵人。
 * @param {Tower[]} towers
 * @param {Enemy[]} enemies
 * @param {number} now
 */
function updateTowers(towers, enemies, now) {
  for (const tower of towers) {
    if (!tower.alive) continue;

    // 若被腳本怪禁用，則暫時不能攻擊
    if (tower.disabledUntil && now < tower.disabledUntil) {
      continue;
    } else if (tower.disabledUntil && now >= tower.disabledUntil) {
      tower.disabledUntil = undefined;
      tower.el.style.opacity = "";
    }

    if (now - tower.lastAttackTime < tower.attackInterval) continue;

    const tr = tower.el.getBoundingClientRect();
    const tx = tr.left + tr.width / 2;
    const ty = tr.top + tr.height / 2;

    /** @type {Enemy | null} */
    let nearestEnemy = null;
    let nearestDist = Infinity;

    /** @type {Enemy[]} */
    const inRangeEnemies = [];

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const er = enemy.el.getBoundingClientRect();
      const ex = er.left + er.width / 2;
      const ey = er.top + er.height / 2;

      const dx = ex - tx;
      const dy = ey - ty;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= tower.range) {
        inRangeEnemies.push(enemy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }
    }

    if (!nearestEnemy) continue;

    // 計算實際傷害（考慮敵人護甲）
    const calculateDamage = (enemy, baseDamage) => {
      const armor = enemy.armor || 0;
      return Math.max(1, Math.floor(baseDamage * (1 - armor))); // 至少造成1點傷害
    };

    // 產生一次攻擊（邏輯扣血 + 視覺反饋）
    if (tower.aoe) {
      // 範圍攻擊：所有在射程內的敵人都受到傷害
      for (const enemy of inRangeEnemies) {
        const actualDamage = calculateDamage(enemy, tower.damage);
        enemy.hp -= actualDamage;
      }
      playTowerAttackEffects(tower, nearestEnemy, inRangeEnemies);
    } else {
      const actualDamage = calculateDamage(nearestEnemy, tower.damage);
      nearestEnemy.hp -= actualDamage;
      playTowerAttackEffects(tower, nearestEnemy, nearestEnemy ? [nearestEnemy] : []);
    }

    tower.lastAttackTime = now;
  }
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
    // 失敗
    const reachedWave = state.waveIndex + 1;
    saveBestRecord(reachedWave);
    const best = loadBestRecord();
    updateBestRecord(best);

    state.running = false;
    showDefeat(best);
    return;
  }

  const totalWaves = state.currentLevelWaves.length;

  if (state.waveIndex >= totalWaves && state.enemies.length === 0) {
    // 當前關卡所有波完成且無存活敵人 -> 關卡完成
    state.running = false;
    
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

  const rect = uiElements.gameField.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;

  // 对齐到网格中心
  const grid = pixelToGrid(x, y);
  const pixelPos = gridToPixel(grid.row, grid.col);
  
  lastMousePos.x = Math.max(0, Math.min(rect.width, pixelPos.x));
  lastMousePos.y = Math.max(0, Math.min(rect.height, pixelPos.y));

  if (!towerPreviewEl) {
    ensureTowerPreview();
  }
  if (towerPreviewEl) {
    towerPreviewEl.style.left = `${lastMousePos.x}px`;
    towerPreviewEl.style.top = `${lastMousePos.y}px`;
  }
  
  // 调试模式：显示塔放置预览（路径和可放置性）- 仅在放置塔模式下显示
  if (getDebugMode() && state && selectedAction && selectedAction.mode === "place-tower") {
    const level = LEVELS[state.currentLevelIndex];
    const mapSize = getMapSize();
    const baseGrid = getBaseGrid(level);
    const spawnPointsGrid = getSpawnPointsGrid(level);
    
    // 创建isWalkable函数用于调试预览
    // 注意：调试预览时不需要允许BASE和入口可走，因为这是用于检查塔放置的
    const debugIsWalkable = (row, col) => {
      return isWalkable(row, col, state.towers, state.enemies, level, null, null, false);
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
  if (!state || !selectedAction) return;
  
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
    const rect = uiElements.gameField.getBoundingClientRect();
    let x = lastMousePos.x || rect.width / 2;
    let y = lastMousePos.y || rect.height / 2;
    
    // 对齐到网格中心
    const grid = pixelToGrid(x, y);
    const pixelPos = gridToPixel(grid.row, grid.col);
    x = pixelPos.x;
    y = pixelPos.y;

    // 使用新的canPlaceTowerAt函数判断是否可以放置
    if (!canPlaceTowerAt(x, y)) {
      showWaveToast("不能完全堵死道路", "info");
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

    // 塔放置成功后，为所有活着的敌人重新计算路径
    // 这样避免敌人沿旧路径穿过新放置的塔
    console.log(`[handleFieldClick] 塔放置成功，为所有敌人重新计算路径`);
    const level = LEVELS[state.currentLevelIndex];
    const mapSize = getMapSize();
    const baseGrid = getBaseGrid(level);
    const enemyIsWalkable = (row, col) => {
      return isWalkable(row, col, state.towers, state.enemies, level, null, null, true);
    };
    recalculateAllEnemyPaths(
      state.enemies,
      baseGrid,
      enemyIsWalkable,
      mapSize.width,
      mapSize.height,
      state.towers
    );

    // 调试模式：更新格子标记
    if (getDebugMode()) {
      renderGridMarkers(level, state.towers, state.enemies);
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
 * 檢查長時間暫停是否應該自動返回主菜單。
 * 只有在 paused === true 且持續超過 AUTO_BACK_TO_MENU_MS 時才觸發。
 * 不影響 setup 階段。
 * @param {number} now 當前時間戳（毫秒）
 */
function checkAutoBackToMenu(now) {
  if (!state || !state.running) return;
  
  // 只在 battle 或 paused 階段檢查，不影響 setup 階段
  if (state.phase === "setup") return;

  if (state.paused && state.pauseStartTime !== null) {
    // 計算暫停持續時間
    const pauseDuration = now - state.pauseStartTime;
    if (pauseDuration >= AUTO_BACK_TO_MENU_MS) {
      // 長時間暫停，自動返回主菜單
      console.log(`[DOM 塔防卡] 暫停時間超過 ${AUTO_BACK_TO_MENU_MS}ms，自動返回主菜單`);
      backToMainMenu();
    }
  }
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
  
  // 只在 battle 階段允許暫停
  if (state.phase !== "battle") return;
  
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
function isTowerOnObstacle(towerX, towerY, level) {
  if (!level.obstacles || level.obstacles.length === 0) return false;
  
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  
  for (const obs of level.obstacles) {
    const obsX = obs.x * fieldRect.width;
    const obsY = obs.y * fieldRect.height;
    const obsWidth = obs.width * fieldRect.width;
    const obsHeight = obs.height * fieldRect.height;
    
    // 檢查塔中心點是否在障礙物矩形內
    if (
      towerX >= obsX &&
      towerX <= obsX + obsWidth &&
      towerY >= obsY &&
      towerY <= obsY + obsHeight
    ) {
      return true;
    }
  }
  
  return false;
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
  if (!level.previewPaths || level.previewPaths.length === 0) return false;
  
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  const minDistance = towerRadius + 8; // 塔半徑 + 8 像素緩衝
  
  for (const path of level.previewPaths) {
    if (!path || path.length < 2) continue;
    
    // 檢查塔與路徑每一段線段的距離
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      
      const x1 = p1.x * fieldRect.width;
      const y1 = p1.y * fieldRect.height;
      const x2 = p2.x * fieldRect.width;
      const y2 = p2.y * fieldRect.height;
      
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
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  return {
    width: Math.floor(fieldRect.width / GRID_CONFIG.TILE_SIZE),
    height: Math.floor(fieldRect.height / GRID_CONFIG.TILE_SIZE),
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
 * @returns {boolean} 如果可走返回true
 */
function isWalkable(row, col, towers, enemies, level, testTowerRow = null, testTowerCol = null, allowBaseAndSpawn = false) {
  const mapSize = getMapSize();
  
  // 检查边界
  if (row < 0 || row >= mapSize.height || col < 0 || col >= mapSize.width) {
    return false;
  }
  
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  const pixelPos = gridToPixel(row, col);
  
  // 检查是否是测试放置的塔位置（如果是，暂时视为障碍）
  if (testTowerRow !== null && testTowerCol !== null && row === testTowerRow && col === testTowerCol) {
    return false;
  }
  
  // 如果允许BASE和入口点可走（用于敌人寻路），先检查是否是这些位置
  if (allowBaseAndSpawn) {
    // 检查是否是BASE（敌人可以到达BASE）
    if (level.basePosition) {
      const baseX = level.basePosition.x * fieldRect.width;
      const baseY = level.basePosition.y * fieldRect.height;
      const baseGrid = pixelToGrid(baseX, baseY);
      if (row === baseGrid.row && col === baseGrid.col) {
        return true; // BASE是可到达的
      }
    }
    
    // 检查是否是入口点（敌人可以从入口点出发）
    if (level.spawnPoints && level.spawnPoints.length > 0) {
      for (const spawn of level.spawnPoints) {
        const spawnX = spawn.x * fieldRect.width;
        const spawnY = spawn.y * fieldRect.height;
        const spawnGrid = pixelToGrid(spawnX, spawnY);
        if (row === spawnGrid.row && col === spawnGrid.col) {
          return true; // 入口点是可走的
        }
      }
    }
  }
  
  // 检查是否在障碍物上
  if (level.obstacles && level.obstacles.length > 0) {
    for (const obs of level.obstacles) {
      const obsX = obs.x * fieldRect.width;
      const obsY = obs.y * fieldRect.height;
      const obsWidth = obs.width * fieldRect.width;
      const obsHeight = obs.height * fieldRect.height;
      
      // 检查格子中心是否在障碍物矩形内
      if (
        pixelPos.x >= obsX &&
        pixelPos.x <= obsX + obsWidth &&
        pixelPos.y >= obsY &&
        pixelPos.y <= obsY + obsHeight
      ) {
        return false;
      }
    }
  }
  
  // 检查是否在BASE上（仅当不允许BASE可走时）
  if (!allowBaseAndSpawn && level.basePosition) {
    const baseX = level.basePosition.x * fieldRect.width;
    const baseY = level.basePosition.y * fieldRect.height;
    const baseGrid = pixelToGrid(baseX, baseY);
    if (row === baseGrid.row && col === baseGrid.col) {
      return false;
    }
  }
  
  // 检查是否有塔在该格子
  for (const tower of towers) {
    if (!tower.alive) continue;
    const towerGrid = pixelToGrid(tower.x, tower.y);
    if (row === towerGrid.row && col === towerGrid.col) {
      return false;
    }
  }
  
  // 检查是否有敌人站在该格子（不能直接盖在小怪头上，但对于寻路来说敌人位置应该是可走的）
  // 注意：对于敌人寻路，不应该检查其他敌人的位置，因为敌人可以互相重叠通过
  if (!allowBaseAndSpawn) {
    for (const enemy of enemies) {
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
  if (!level.spawnPoints || level.spawnPoints.length === 0) return [];
  
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  return level.spawnPoints.map(spawn => {
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
  if (!level.basePosition) return null;
  
  const fieldRect = uiElements.gameField.getBoundingClientRect();
  const baseX = level.basePosition.x * fieldRect.width;
  const baseY = level.basePosition.y * fieldRect.height;
  return pixelToGrid(baseX, baseY);
}

/**
 * 判断是否可以在指定位置放置塔
 * 使用寻路算法判断放置后是否仍有从入口到BASE的路径
 * @param {number} tileX 塔的像素X坐标
 * @param {number} tileY 塔的像素Y坐标
 * @returns {boolean} 如果可以放置返回true
 */
function canPlaceTowerAt(tileX, tileY) {
  if (!state) {
    console.log("[canPlaceTowerAt] state 为空，返回 false");
    return false;
  }
  
  const level = LEVELS[state.currentLevelIndex];
  const mapSize = getMapSize();
  
  // 转换为网格坐标
  const towerGrid = pixelToGrid(tileX, tileY);
  
  console.log(`[canPlaceTowerAt] 检查位置: 像素(${tileX}, ${tileY}) -> 网格(${towerGrid.row}, ${towerGrid.col})`);
  
  // 检查是否在地图范围内
  if (towerGrid.row < 0 || towerGrid.row >= mapSize.height || 
      towerGrid.col < 0 || towerGrid.col >= mapSize.width) {
    console.log(`[canPlaceTowerAt] 超出地图范围: 地图大小=${mapSize.width}x${mapSize.height}`);
    return false;
  }
  
  // 获取入口点和BASE
  const spawnPoints = getSpawnPointsGrid(level);
  const baseGrid = getBaseGrid(level);
  
  console.log(`[canPlaceTowerAt] 入口点数量: ${spawnPoints.length}, BASE: ${baseGrid ? `(${baseGrid.row}, ${baseGrid.col})` : 'null'}`);
  
  // 首先明确检查：不能在入口或BASE上放塔
  if (baseGrid && towerGrid.row === baseGrid.row && towerGrid.col === baseGrid.col) {
    console.log(`[canPlaceTowerAt] 不能在BASE上放塔: BASE位于(${baseGrid.row}, ${baseGrid.col})`);
    return false;
  }
  
  for (const spawn of spawnPoints) {
    if (towerGrid.row === spawn.row && towerGrid.col === spawn.col) {
      console.log(`[canPlaceTowerAt] 不能在入口上放塔: 入口位于(${spawn.row}, ${spawn.col})`);
      return false;
    }
  }
  
  if (!baseGrid || spawnPoints.length === 0) {
    console.log(`[canPlaceTowerAt] 没有BASE或入口，允许放置（兼容旧关卡）`);
    return true;
  }
  
  // 检查是否为空地且不是base/障碍（用于塔放置检查）
  const isWalkableNow = isWalkable(
    towerGrid.row, 
    towerGrid.col, 
    state.towers, 
    state.enemies, 
    level
  );
  
  if (!isWalkableNow) {
    console.log(`[canPlaceTowerAt] 该位置不可走（已有障碍物、塔或敌人）`);
    return false;
  }
  
  // 临时调试开关：跳过寻路检查
  const DEBUG_IGNORE_BLOCK_CHECK = false; // 改为 true 可以临时跳过寻路检查
  
  if (DEBUG_IGNORE_BLOCK_CHECK) {
    console.log(`[canPlaceTowerAt] 调试模式：跳过寻路检查，允许放置`);
    return true;
  }
  
  // 创建一个特殊的isWalkable函数，用于寻路时：
  // 1. BASE和入口点应该可走（因为要寻路到那里）
  // 2. 测试的塔位置不可走
  const isWalkableForPathfinding = (row, col) => {
    // 检查是否是BASE或入口点（这些应该可走，用于寻路）
    if (baseGrid && row === baseGrid.row && col === baseGrid.col) {
      return true; // BASE是可到达的
    }
    
    for (const spawn of spawnPoints) {
      if (row === spawn.row && col === spawn.col) {
        return true; // 入口点是可走的
      }
    }
    
    // 检查是否是测试放置的塔位置（如果是，暂时视为障碍）
    if (row === towerGrid.row && col === towerGrid.col) {
      return false;
    }
    
    // 其他情况使用正常的isWalkable检查，但允许BASE和入口点可走（用于寻路）
    // 注意：不需要传递testTowerRow/testTowerCol，因为我们已经在这里检查过了
    return isWalkable(row, col, state.towers, state.enemies, level, null, null, true);
  };
  
  // 检查是否至少有一个入口到BASE有路径
  let foundPath = false;
  for (let i = 0; i < spawnPoints.length; i++) {
    const spawn = spawnPoints[i];
    
    // 使用findPath而不是hasPath，这样可以获取更多信息
    const path = findPath(
      spawn.row,
      spawn.col,
      baseGrid.row,
      baseGrid.col,
      isWalkableForPathfinding,
      mapSize.width,
      mapSize.height,
      false // 不允许对角线
    );
    
    if (path && path.length > 0) {
      console.log(`[canPlaceTowerAt] 入口${i}(${spawn.row},${spawn.col}) -> BASE(${baseGrid.row},${baseGrid.col}): 找到路径，长度=${path.length}`);
      foundPath = true;
      break;
    } else {
      console.log(`[canPlaceTowerAt] 入口${i}(${spawn.row},${spawn.col}) -> BASE(${baseGrid.row},${baseGrid.col}): 无路径`);
    }
  }
  
  if (foundPath) {
    console.log(`[canPlaceTowerAt] 至少有一个入口到BASE有路径，允许放置`);
    return true;
  }
  
  console.log(`[canPlaceTowerAt] 所有入口到BASE都无路径，禁止放置`);
  return false;
}


