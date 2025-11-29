/**
 * 寻路模块：提供网格地图和A*寻路算法
 * 用于动态计算敌人路径和判断塔放置是否合法
 */

/**
 * 网格地图配置
 */
export const GRID_CONFIG = {
  TILE_SIZE: 32, // 每个格子的像素大小（与CSS中的网格背景一致）
};

/**
 * 将像素坐标转换为网格坐标
 * @param {number} pixelX 像素X坐标
 * @param {number} pixelY 像素Y坐标
 * @returns {{row: number, col: number}} 网格坐标
 */
export function pixelToGrid(pixelX, pixelY) {
  return {
    row: Math.floor(pixelY / GRID_CONFIG.TILE_SIZE),
    col: Math.floor(pixelX / GRID_CONFIG.TILE_SIZE),
  };
}

/**
 * 将网格坐标转换为像素坐标（格子中心点）
 * @param {number} row 行
 * @param {number} col 列
 * @returns {{x: number, y: number}} 像素坐标
 */
export function gridToPixel(row, col) {
  return {
    x: col * GRID_CONFIG.TILE_SIZE + GRID_CONFIG.TILE_SIZE / 2,
    y: row * GRID_CONFIG.TILE_SIZE + GRID_CONFIG.TILE_SIZE / 2,
  };
}

/**
 * 检查网格坐标是否在地图范围内
 * @param {number} row 行
 * @param {number} col 列
 * @param {number} mapWidth 地图宽度（格子数）
 * @param {number} mapHeight 地图高度（格子数）
 * @returns {boolean}
 */
export function isInBounds(row, col, mapWidth, mapHeight) {
  return row >= 0 && row < mapHeight && col >= 0 && col < mapWidth;
}

/**
 * 获取相邻的8个方向（包括对角线）
 * @returns {Array<{row: number, col: number}>}
 */
function getNeighbors8() {
  return [
    { row: -1, col: -1 }, // 左上
    { row: -1, col: 0 },  // 上
    { row: -1, col: 1 },  // 右上
    { row: 0, col: -1 },  // 左
    { row: 0, col: 1 },   // 右
    { row: 1, col: -1 },  // 左下
    { row: 1, col: 0 },   // 下
    { row: 1, col: 1 },   // 右下
  ];
}

/**
 * 获取相邻的4个方向（仅上下左右）
 * @returns {Array<{row: number, col: number}>}
 */
function getNeighbors4() {
  return [
    { row: -1, col: 0 }, // 上
    { row: 1, col: 0 },  // 下
    { row: 0, col: -1 }, // 左
    { row: 0, col: 1 },  // 右
  ];
}

/**
 * 计算两点之间的曼哈顿距离（用于A*启发式）
 * @param {number} row1
 * @param {number} col1
 * @param {number} row2
 * @param {number} col2
 * @returns {number}
 */
function manhattanDistance(row1, col1, row2, col2) {
  return Math.abs(row1 - row2) + Math.abs(col1 - col2);
}

/**
 * 使用A*算法寻路
 * @param {number} startRow 起点行
 * @param {number} startCol 起点列
 * @param {number} endRow 终点行
 * @param {number} endCol 终点列
 * @param {function(row: number, col: number): boolean} isWalkable 判断格子是否可走
 * @param {number} mapWidth 地图宽度（格子数）
 * @param {number} mapHeight 地图高度（格子数）
 * @param {boolean} allowDiagonal 是否允许对角线移动（默认false，只允许4方向）
 * @param {function(row: number, col: number): number} [dangerCost] 可选的危险度成本函数，返回该格子的额外成本（用于智能敌人绕路）
 * @returns {Array<{row: number, col: number}> | null} 路径数组，如果无路径返回null
 */
export function findPath(
  startRow,
  startCol,
  endRow,
  endCol,
  isWalkable,
  mapWidth,
  mapHeight,
  allowDiagonal = false,
  dangerCost = null
) {
  // 检查起点和终点是否可走
  if (!isWalkable(startRow, startCol) || !isWalkable(endRow, endCol)) {
    return null;
  }

  // 如果起点就是终点
  if (startRow === endRow && startCol === endCol) {
    return [{ row: startRow, col: startCol }];
  }

  const neighbors = allowDiagonal ? getNeighbors8() : getNeighbors4();
  
  // A*算法数据结构
  const openSet = [{ row: startRow, col: startCol, g: 0, h: 0, f: 0 }];
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  // 初始化起点
  const startKey = `${startRow},${startCol}`;
  gScore.set(startKey, 0);
  fScore.set(startKey, manhattanDistance(startRow, startCol, endRow, endCol));

  while (openSet.length > 0) {
    // 找到f值最小的节点
    let currentIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i;
      }
    }

    const current = openSet.splice(currentIndex, 1)[0];
    const currentKey = `${current.row},${current.col}`;

    // 到达终点，重构路径
    if (current.row === endRow && current.col === endCol) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ row: node.row, col: node.col });
        const nodeKey = `${node.row},${node.col}`;
        node = cameFrom.get(nodeKey);
      }
      return path;
    }

    closedSet.add(currentKey);

    // 检查所有邻居
    for (const neighbor of neighbors) {
      const newRow = current.row + neighbor.row;
      const newCol = current.col + neighbor.col;
      const neighborKey = `${newRow},${newCol}`;

      // 检查边界和是否可走
      if (!isInBounds(newRow, newCol, mapWidth, mapHeight)) continue;
      if (!isWalkable(newRow, newCol)) continue;
      if (closedSet.has(neighborKey)) continue;

      // 计算移动代价（对角线移动代价更高）
      let moveCost = Math.abs(neighbor.row) + Math.abs(neighbor.col) > 1 ? 1.414 : 1;
      
      // 如果提供了危险度成本函数，添加额外成本（用于智能敌人绕路）
      if (dangerCost) {
        const danger = dangerCost(newRow, newCol);
        moveCost += danger;
      }
      
      const tentativeG = gScore.get(currentKey) + moveCost;

      // 如果这个邻居不在开放集中，或者找到更短的路径
      const existingG = gScore.get(neighborKey);
      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        const h = manhattanDistance(newRow, newCol, endRow, endCol);
        const f = tentativeG + h;
        fScore.set(neighborKey, f);

        // 如果不在开放集中，添加进去
        if (existingG === undefined) {
          openSet.push({ row: newRow, col: newCol, g: tentativeG, h, f });
        }
      }
    }
  }

  // 没有找到路径
  return null;
}

/**
 * 检查是否存在从起点到终点的路径
 * @param {number} startRow 起点行
 * @param {number} startCol 起点列
 * @param {number} endRow 终点行
 * @param {number} endCol 终点列
 * @param {function(row: number, col: number): boolean} isWalkable 判断格子是否可走
 * @param {number} mapWidth 地图宽度（格子数）
 * @param {number} mapHeight 地图高度（格子数）
 * @returns {boolean}
 */
export function hasPath(startRow, startCol, endRow, endCol, isWalkable, mapWidth, mapHeight) {
  const path = findPath(startRow, startCol, endRow, endCol, isWalkable, mapWidth, mapHeight);
  return path !== null;
}

