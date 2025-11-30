/**
 * 调试模块：提供调试模式下的可视化功能
 * - 显示敌人路径
 * - 标记障碍、塔、base、入口格子
 * - 检测穿墙问题
 * - 塔放置检查可视化
 * 
 * 性能说明：
 * - 路径渲染：每个敌人每帧都需要更新路径线条，当敌人数量多时（>50）可能影响性能
 * - 格子标记：只在调试模式开启或关闭时渲染一次，性能影响可忽略
 * - 穿墙检测：每个敌人每帧检查一次，对性能影响很小
 */

import { pixelToGrid, gridToPixel, GRID_CONFIG, findPath } from "./pathfinding.js";

/**
 * 调试模式状态
 */
let isDebugMode = false;

/**
 * 路径可视化容器
 */
let pathContainer = null;

/**
 * 格子标记容器
 */
let gridMarkerContainer = null;

/**
 * 塔放置预览路径容器
 */
let towerPlacementPathContainer = null;

/**
 * 敌人路径线条缓存（enemyId -> SVG路径元素）
 */
const enemyPathLines = new Map();

/**
 * 当前悬停的格子位置（用于塔放置预览）
 */
let hoveredGridPos = null;

/**
 * 从URL参数或localStorage初始化调试模式
 * @returns {boolean} 是否为调试模式
 */
export function initDebugMode() {
  // 检查URL参数
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("debug") === "1" || urlParams.get("debug") === "true") {
    isDebugMode = true;
  }
  
  // 检查localStorage
  const stored = localStorage.getItem("debugMode");
  if (stored === "true") {
    isDebugMode = true;
  }
  
  return isDebugMode;
}

/**
 * 切换调试模式
 * @returns {boolean} 新的调试模式状态
 */
export function toggleDebugMode() {
  isDebugMode = !isDebugMode;
  localStorage.setItem("debugMode", String(isDebugMode));
  
  if (isDebugMode) {
    createDebugContainers();
    renderGridMarkers();
  } else {
    clearDebugContainers();
  }
  
  return isDebugMode;
}

/**
 * 获取当前调试模式状态
 * @returns {boolean}
 */
export function getDebugMode() {
  return isDebugMode;
}

/**
 * 设置调试模式状态
 * @param {boolean} enabled
 */
export function setDebugMode(enabled) {
  if (isDebugMode === enabled) return;
  
  isDebugMode = enabled;
  localStorage.setItem("debugMode", String(isDebugMode));
  
  if (isDebugMode) {
    createDebugContainers();
    renderGridMarkers();
  } else {
    clearDebugContainers();
  }
}

/**
 * 创建调试可视化容器
 */
function createDebugContainers() {
  const gameField = document.getElementById("game-field");
  if (!gameField) return;
  
  // 创建路径容器（SVG用于绘制线条）
  if (!pathContainer) {
    pathContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    pathContainer.id = "debug-path-container";
    pathContainer.style.position = "absolute";
    pathContainer.style.top = "0";
    pathContainer.style.left = "0";
    pathContainer.style.width = "100%";
    pathContainer.style.height = "100%";
    pathContainer.style.pointerEvents = "none";
    pathContainer.style.zIndex = "3";
    gameField.appendChild(pathContainer);
  }
  
  // 创建格子标记容器
  if (!gridMarkerContainer) {
    gridMarkerContainer = document.createElement("div");
    gridMarkerContainer.id = "debug-grid-markers";
    gridMarkerContainer.style.position = "absolute";
    gridMarkerContainer.style.top = "0";
    gridMarkerContainer.style.left = "0";
    gridMarkerContainer.style.width = "100%";
    gridMarkerContainer.style.height = "100%";
    gridMarkerContainer.style.pointerEvents = "none";
    gridMarkerContainer.style.zIndex = "1";
    gameField.appendChild(gridMarkerContainer);
  }
  
  // 创建塔放置预览路径容器
  if (!towerPlacementPathContainer) {
    towerPlacementPathContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    towerPlacementPathContainer.id = "debug-tower-placement-path";
    towerPlacementPathContainer.style.position = "absolute";
    towerPlacementPathContainer.style.top = "0";
    towerPlacementPathContainer.style.left = "0";
    towerPlacementPathContainer.style.width = "100%";
    towerPlacementPathContainer.style.height = "100%";
    towerPlacementPathContainer.style.pointerEvents = "none";
    towerPlacementPathContainer.style.zIndex = "25";
    gameField.appendChild(towerPlacementPathContainer);
  }
}

/**
 * 清除调试可视化容器
 */
function clearDebugContainers() {
  if (pathContainer && pathContainer.parentElement) {
    pathContainer.parentElement.removeChild(pathContainer);
    pathContainer = null;
  }
  
  if (gridMarkerContainer && gridMarkerContainer.parentElement) {
    gridMarkerContainer.parentElement.removeChild(gridMarkerContainer);
    gridMarkerContainer = null;
  }
  
  if (towerPlacementPathContainer && towerPlacementPathContainer.parentElement) {
    towerPlacementPathContainer.parentElement.removeChild(towerPlacementPathContainer);
    towerPlacementPathContainer = null;
  }
  
  enemyPathLines.clear();
  hoveredGridPos = null;
}

/**
 * 获取敌人类型的路径颜色
 * @param {string} enemyType
 * @returns {string}
 */
function getEnemyPathColor(enemyType) {
  const colors = {
    normal: "#78909c",
    sprinter: "#ab47bc",
    devourer: "#d32f2f",
    smart: "#1976d2",
    healer: "#388e3c",
    ad: "#ff4081",
    banner: "#ffb74d",
    script: "#66bb6a",
  };
  return colors[enemyType] || "#ffffff";
}

/**
 * 渲染单个敌人的路径
 * @param {Object} enemy 敌人对象
 * @param {Object} baseGrid BASE的网格坐标
 */
function renderEnemyPath(enemy, baseGrid) {
  if (!pathContainer || !enemy.alive || !enemy.path || enemy.path.length === 0) {
    // 如果敌人没有路径，移除已存在的路径线条
    const existingLine = enemyPathLines.get(enemy.id);
    if (existingLine && existingLine.parentElement) {
      existingLine.parentElement.removeChild(existingLine);
      enemyPathLines.delete(enemy.id);
    }
    return;
  }
  
  // 构建路径字符串（从当前位置到base）
  const pathPoints = [];
  
  // 从当前位置开始
  pathPoints.push(`${enemy.x},${enemy.y}`);
  
  // 添加路径上的所有点
  for (let i = enemy.pathIndex; i < enemy.path.length; i++) {
    const grid = enemy.path[i];
    const pixel = gridToPixel(grid.row, grid.col);
    pathPoints.push(`${pixel.x},${pixel.y}`);
  }
  
  // 如果还有剩余的路径点，连接到base
  if (baseGrid) {
    const basePixel = gridToPixel(baseGrid.row, baseGrid.col);
    pathPoints.push(`${basePixel.x},${basePixel.y}`);
  }
  
  const pathData = `M ${pathPoints.join(" L ")}`;
  
  // 查找或创建路径线条
  let pathLine = enemyPathLines.get(enemy.id);
  if (!pathLine) {
    pathLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathLine.setAttribute("stroke", getEnemyPathColor(enemy.enemyType));
    pathLine.setAttribute("stroke-width", "2");
    pathLine.setAttribute("fill", "none");
    pathLine.setAttribute("opacity", "0.6");
    pathLine.setAttribute("stroke-dasharray", "4,4");
    pathContainer.appendChild(pathLine);
    enemyPathLines.set(enemy.id, pathLine);
  }
  
  // 更新路径数据
  pathLine.setAttribute("d", pathData);
}

/**
 * 更新所有敌人的路径可视化
 * @param {Array} enemies 敌人数组
 * @param {Object} baseGrid BASE的网格坐标
 */
export function updateEnemyPaths(enemies, baseGrid) {
  if (!isDebugMode || !pathContainer) return;
  
  // 清除已死亡敌人的路径
  const activeEnemyIds = new Set(enemies.filter(e => e.alive).map(e => e.id));
  for (const [enemyId, pathLine] of enemyPathLines.entries()) {
    if (!activeEnemyIds.has(enemyId)) {
      if (pathLine.parentElement) {
        pathLine.parentElement.removeChild(pathLine);
      }
      enemyPathLines.delete(enemyId);
    }
  }
  
  // 渲染所有存活敌人的路径
  for (const enemy of enemies) {
    if (enemy.alive) {
      renderEnemyPath(enemy, baseGrid);
    }
  }
}

/**
 * 渲染格子标记（障碍、塔、base、入口）
 * 性能说明：只在调试模式开启/关闭或关卡切换时调用，不影响游戏循环性能
 * @param {Object} level 关卡配置
 * @param {Array} towers 塔数组
 * @param {Array} enemies 敌人数组（用于检测当前站位）
 */
export function renderGridMarkers(level = null, towers = [], enemies = []) {
  if (!isDebugMode || !gridMarkerContainer) return;
  
  // 清空现有标记
  gridMarkerContainer.innerHTML = "";
  
  if (!level) return;
  
  const fieldRect = gridMarkerContainer.getBoundingClientRect();
  const mapSize = {
    width: Math.floor(fieldRect.width / GRID_CONFIG.TILE_SIZE),
    height: Math.floor(fieldRect.height / GRID_CONFIG.TILE_SIZE),
  };
  
  const tileSize = GRID_CONFIG.TILE_SIZE;
  
  // 标记障碍格子
  if (level.obstacles && level.obstacles.length > 0) {
    for (const obs of level.obstacles) {
      const obsX = obs.x * fieldRect.width;
      const obsY = obs.y * fieldRect.height;
      const obsWidth = obs.width * fieldRect.width;
      const obsHeight = obs.height * fieldRect.height;
      
      const marker = document.createElement("div");
      marker.className = "debug-grid-marker debug-grid-marker-obstacle";
      marker.style.left = `${obsX}px`;
      marker.style.top = `${obsY}px`;
      marker.style.width = `${obsWidth}px`;
      marker.style.height = `${obsHeight}px`;
      gridMarkerContainer.appendChild(marker);
    }
  }
  
  // 标记塔格子
  for (const tower of towers) {
    if (!tower.alive) continue;
    const grid = pixelToGrid(tower.x, tower.y);
    const pixel = gridToPixel(grid.row, grid.col);
    
    const marker = document.createElement("div");
    marker.className = "debug-grid-marker debug-grid-marker-tower";
    marker.style.left = `${pixel.x - tileSize / 2}px`;
    marker.style.top = `${pixel.y - tileSize / 2}px`;
    marker.style.width = `${tileSize}px`;
    marker.style.height = `${tileSize}px`;
    gridMarkerContainer.appendChild(marker);
  }
  
  // 标记BASE格子
  if (level.basePosition) {
    const baseX = level.basePosition.x * fieldRect.width;
    const baseY = level.basePosition.y * fieldRect.height;
    const baseGrid = pixelToGrid(baseX, baseY);
    const basePixel = gridToPixel(baseGrid.row, baseGrid.col);
    
    const marker = document.createElement("div");
    marker.className = "debug-grid-marker debug-grid-marker-base";
    marker.style.left = `${basePixel.x - tileSize / 2}px`;
    marker.style.top = `${basePixel.y - tileSize / 2}px`;
    marker.style.width = `${tileSize}px`;
    marker.style.height = `${tileSize}px`;
    gridMarkerContainer.appendChild(marker);
  }
  
  // 标记入口格子
  if (level.spawnPoints && level.spawnPoints.length > 0) {
    for (const spawn of level.spawnPoints) {
      const spawnX = spawn.x * fieldRect.width;
      const spawnY = spawn.y * fieldRect.height;
      const spawnGrid = pixelToGrid(spawnX, spawnY);
      const spawnPixel = gridToPixel(spawnGrid.row, spawnGrid.col);
      
      const marker = document.createElement("div");
      marker.className = "debug-grid-marker debug-grid-marker-spawn";
      marker.style.left = `${spawnPixel.x - tileSize / 2}px`;
      marker.style.top = `${spawnPixel.y - tileSize / 2}px`;
      marker.style.width = `${tileSize}px`;
      marker.style.height = `${tileSize}px`;
      gridMarkerContainer.appendChild(marker);
    }
  }
  
  // 标记敌人当前站位（用不同颜色）
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const grid = pixelToGrid(enemy.x, enemy.y);
    const pixel = gridToPixel(grid.row, grid.col);
    
    const marker = document.createElement("div");
    marker.className = "debug-grid-marker debug-grid-marker-enemy";
    marker.style.left = `${pixel.x - tileSize / 2}px`;
    marker.style.top = `${pixel.y - tileSize / 2}px`;
    marker.style.width = `${tileSize}px`;
    marker.style.height = `${tileSize}px`;
    marker.style.borderColor = getEnemyPathColor(enemy.enemyType);
    gridMarkerContainer.appendChild(marker);
  }
}

/**
 * 检测敌人是否在非法格子上（穿墙检测）
 * @param {Object} enemy 敌人对象
 * @param {function} isWalkable 判断格子是否可走的函数
 * @param {Object} level 关卡配置
 * @returns {boolean} 如果检测到穿墙返回true
 */
export function checkEnemyCollision(enemy, isWalkable, level) {
  if (!isDebugMode || !enemy.alive) return false;
  
  const grid = pixelToGrid(enemy.x, enemy.y);
  
  // 检查是否在非法格子上
  if (!isWalkable(grid.row, grid.col)) {
    console.warn(
      `[调试] 检测到穿墙：敌人 ${enemy.id} (${enemy.enemyType}) 位于非法格子 (${grid.row}, ${grid.col})`
    );
    
    // 在调试模式下高亮该敌人
    if (!enemy.el.classList.contains("debug-collision-highlight")) {
      enemy.el.classList.add("debug-collision-highlight");
    }
    
    return true;
  } else {
    // 正常位置，移除高亮
    enemy.el.classList.remove("debug-collision-highlight");
  }
  
  return false;
}

/**
 * 更新塔放置预览（悬停时的可视化）
 * @param {number} pixelX 像素X坐标
 * @param {number} pixelY 像素Y坐标
 * @param {function} canPlaceTowerAt 判断是否可以放置塔的函数
 * @param {Object} level 关卡配置
 * @param {function} isWalkable 判断格子是否可走的函数
 * @param {Object} baseGrid BASE的网格坐标
 * @param {Array} spawnPointsGrid 入口点的网格坐标数组
 */
export function updateTowerPlacementPreview(
  pixelX,
  pixelY,
  canPlaceTowerAt,
  level,
  isWalkable,
  baseGrid,
  spawnPointsGrid
) {
  if (!isDebugMode || !towerPlacementPathContainer) {
    hoveredGridPos = null;
    return;
  }
  
  // 转换为网格坐标
  const grid = pixelToGrid(pixelX, pixelY);
  const pixel = gridToPixel(grid.row, grid.col);
  
  // 检查是否和上次是同一个格子（避免重复计算）
  if (
    hoveredGridPos &&
    hoveredGridPos.row === grid.row &&
    hoveredGridPos.col === grid.col
  ) {
    return;
  }
  
  hoveredGridPos = { row: grid.row, col: grid.col, pixelX: pixel.x, pixelY: pixel.y };
  
  // 清空预览路径
  towerPlacementPathContainer.innerHTML = "";
  
  // 检查是否可以放置
  const placementResult = canPlaceTowerAt(pixel.x, pixel.y);
  const canPlace = placementResult.canPlace || placementResult === true; // 兼容旧版本返回布尔值的情况
  
  // 创建预览格子标记
  const previewMarker = document.createElement("div");
  previewMarker.className = `debug-tower-preview-marker ${
    canPlace ? "debug-tower-preview-valid" : "debug-tower-preview-invalid"
  }`;
  previewMarker.style.position = "absolute";
  previewMarker.style.left = `${pixel.x - GRID_CONFIG.TILE_SIZE / 2}px`;
  previewMarker.style.top = `${pixel.y - GRID_CONFIG.TILE_SIZE / 2}px`;
  previewMarker.style.width = `${GRID_CONFIG.TILE_SIZE}px`;
  previewMarker.style.height = `${GRID_CONFIG.TILE_SIZE}px`;
  previewMarker.style.pointerEvents = "none";
  towerPlacementPathContainer.appendChild(previewMarker);
  
  // 如果可以放置，显示从各个入口到BASE的预期路径
  if (canPlace && baseGrid && spawnPointsGrid && spawnPointsGrid.length > 0) {
    const gameField = document.getElementById("game-field");
    if (!gameField) return;
    
    const fieldRect = gameField.getBoundingClientRect();
    const mapWidth = Math.floor(fieldRect.width / GRID_CONFIG.TILE_SIZE);
    const mapHeight = Math.floor(fieldRect.height / GRID_CONFIG.TILE_SIZE);
    
    // 暂时将该格子视为障碍，计算路径
    const tempIsWalkable = (row, col) => {
      if (row === grid.row && col === grid.col) return false;
      return isWalkable(row, col);
    };
    
    for (const spawn of spawnPointsGrid) {
      const path = findPath(
        spawn.row,
        spawn.col,
        baseGrid.row,
        baseGrid.col,
        tempIsWalkable,
        mapWidth,
        mapHeight
      );
      
      if (path && path.length > 0) {
        // 绘制路径
        const pathPoints = [];
        for (const p of path) {
          const pixel = gridToPixel(p.row, p.col);
          pathPoints.push(`${pixel.x},${pixel.y}`);
        }
        const pathData = `M ${pathPoints.join(" L ")}`;
        
        const pathLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathLine.setAttribute("d", pathData);
        pathLine.setAttribute("stroke", "#4caf50");
        pathLine.setAttribute("stroke-width", "3");
        pathLine.setAttribute("fill", "none");
        pathLine.setAttribute("opacity", "0.7");
        pathLine.setAttribute("stroke-dasharray", "6,3");
        towerPlacementPathContainer.appendChild(pathLine);
      }
    }
  } else if (!canPlace) {
    // 如果不可放置，显示提示文本
    const hintText = document.createElement("div");
    hintText.className = "debug-tower-preview-hint";
    hintText.textContent = "不能完全堵死道路";
    hintText.style.position = "absolute";
    hintText.style.left = `${pixel.x}px`;
    hintText.style.top = `${pixel.y - 30}px`;
    hintText.style.pointerEvents = "none";
    hintText.style.transform = "translateX(-50%)";
    towerPlacementPathContainer.appendChild(hintText);
  }
}

/**
 * 清除塔放置预览
 */
export function clearTowerPlacementPreview() {
  if (!towerPlacementPathContainer) return;
  towerPlacementPathContainer.innerHTML = "";
  hoveredGridPos = null;
}

