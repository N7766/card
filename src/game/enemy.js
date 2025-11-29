/**
 * 敵人模組：負責生成敵人 DOM 與更新其在戰場中的移動與狀態。
 * 使用网格坐标和动态寻路，避免穿墙问题。
 * 支持多种特殊敌人类型：冲刺型、吞噬型、智能绕路型、治疗型等。
 */

import { ENEMY_CONFIGS, ENEMY_STATS, ENEMY_DAMAGE_TO_BASE, BASE_RADIUS } from "./config.js";
import { pixelToGrid, gridToPixel, findPath, GRID_CONFIG } from "./pathfinding.js";

/**
 * 兜底模式开关：当寻路失败时，是否使用简单的直线移动逻辑
 * 
 * 说明：
 * - 这是为了调试阶段保底，确保即使寻路逻辑有问题，小怪也能至少动起来
 * - 当设置为 true 时：寻路失败会使用简单的朝BASE方向的直线移动（有基本碰撞检测）
 * - 当设置为 false 时：完全依赖新的寻路逻辑，寻路失败时小怪会停在原地
 * 
 * 未来逻辑正常后，可以删掉这个开关或默认设置为 false
 */
const USE_FALLBACK_MOVEMENT_WHEN_NO_PATH = true;

/**
 * @typedef {Object} Enemy
 * @property {string} id
 * @property {HTMLElement} el
 * @property {number} x 像素X坐标
 * @property {number} y 像素Y坐标
 * @property {number} row 网格行坐标
 * @property {number} col 网格列坐标
 * @property {number} speed 像素/秒（当前实际速度，可能被特殊行为修改）
 * @property {number} hp
 * @property {number} maxHp
 * @property {"normal"|"sprinter"|"devourer"|"smart"|"healer"|"ad"|"banner"|"script"} enemyType
 * @property {boolean} alive
 * @property {Array<{row: number, col: number}>} path 网格坐标路径数组（当前路径，别名currentPath）
 * @property {number} pathIndex 当前路径点索引
 * @property {number} lastPathUpdateTime 上次更新路径的时间戳（用于性能优化）
 * @property {boolean} needsPathRecalculation 是否需要强制重新计算路径（由外部设置，如塔放置后）
 * 
 * // 冲刺型（Sprinter）专用属性
 * @property {number} [sprintCooldownTimer] 冲刺冷却计时器（毫秒）
 * @property {number} [sprintDurationTimer] 冲刺持续时间计时器（毫秒）
 * @property {boolean} [isSprinting] 是否正在冲刺
 * 
 * // 吞噬型（Devourer）专用属性
 * @property {number} [devourCount] 已吞噬次数
 * @property {number} [sizeScale] 体型缩放比例（1.0为基础大小）
 * 
 * // 治疗型（Healer）专用属性
 * @property {number} [healCooldownTimer] 治疗冷却计时器（毫秒）
 * 
 * // 通用特殊行为属性
 * @property {number} [armor] 伤害减免（0-1之间）
 */

let enemyIdCounter = 1;

/** 
 * 死亡敌人位置记录数组，用于吞噬型敌人检测
 * 格式: [{x: number, y: number, enemyType: string, timestamp: number}]
 */
let deadEnemyPositions = [];

/**
 * 兜底移动函数：当寻路失败时，使用简单的直线移动逻辑
 * 
 * 说明：
 * - 这是调试阶段的保底逻辑，确保即使寻路失败，小怪也能至少朝BASE方向移动
 * - 使用简单的曼哈顿距离移动：在row和col上朝BASE方向各走一步（如果可以）
 * - 仍然做基本的碰撞检测，避免明显穿墙
 * 
 * 未来逻辑正常后，可以删除此函数或仅在紧急情况下使用
 * 
 * @param {Enemy} enemy 敌人对象
 * @param {{row: number, col: number}} baseGrid BASE的网格坐标
 * @param {function(row: number, col: number): boolean} isWalkable 判断格子是否可走的函数
 * @param {number} dtSeconds 时间差（秒）
 * @returns {boolean} 是否成功移动
 */
function fallbackMovement(enemy, baseGrid, isWalkable, dtSeconds) {
  if (!enemy.alive || !baseGrid) {
    return false;
  }
  
  // 计算朝BASE的方向（曼哈顿距离，优先走更远的方向）
  const dRow = baseGrid.row - enemy.row;
  const dCol = baseGrid.col - enemy.col;
  
  // 如果已经在BASE位置，不需要移动
  if (dRow === 0 && dCol === 0) {
    console.log(`[fallbackMovement] 敌人 ${enemy.id} 已在BASE位置(${baseGrid.row},${baseGrid.col})，无需移动`);
    return true;
  }
  
  console.log(
    `[fallbackMovement] 敌人 ${enemy.id} 使用兜底移动: 当前位置(${enemy.row},${enemy.col}) -> BASE(${baseGrid.row},${baseGrid.col}), 距离=(${dRow},${dCol})`
  );
  
  // 确定下一步要走的格子（优先减少距离更大的维度）
  let nextRow = enemy.row;
  let nextCol = enemy.col;
  let moveDirection = null; // 记录移动方向："row" 或 "col"
  
  if (Math.abs(dRow) > Math.abs(dCol)) {
    // 优先在row方向移动
    nextRow = enemy.row + (dRow > 0 ? 1 : -1);
    moveDirection = "row";
  } else if (Math.abs(dCol) > 0) {
    // 在col方向移动
    nextCol = enemy.col + (dCol > 0 ? 1 : -1);
    moveDirection = "col";
  } else {
    // 这种情况不应该发生（已在前面检查），但保留作为保险
    console.log(`[fallbackMovement] 敌人 ${enemy.id} 已到达BASE位置`);
    return true;
  }
  
  // 检查下一步格子是否可走（基本的碰撞检测）
  if (isWalkable && !isWalkable(nextRow, nextCol)) {
    // 尝试另一个方向
    if (moveDirection === "row") {
      // 尝试col方向
      nextRow = enemy.row;
      nextCol = enemy.col + (dCol > 0 ? 1 : -1);
      if (Math.abs(dCol) === 0) {
        // 两个方向都不可走，停在原地
        console.warn(`[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走（已尝试row和col），停在原地`);
        return false;
      }
      if (isWalkable && !isWalkable(nextRow, nextCol)) {
        // col方向也不可走，停在原地
        console.warn(`[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走，停在原地`);
        return false;
      }
    } else {
      // 尝试row方向
      nextCol = enemy.col;
      nextRow = enemy.row + (dRow > 0 ? 1 : -1);
      if (Math.abs(dRow) === 0) {
        // 两个方向都不可走，停在原地
        console.warn(`[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走（已尝试col和row），停在原地`);
        return false;
      }
      if (isWalkable && !isWalkable(nextRow, nextCol)) {
        // row方向也不可走，停在原地
        console.warn(`[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走，停在原地`);
        return false;
      }
    }
  }
  
  // 移动到下一个格子
  const nextPixel = gridToPixel(nextRow, nextCol);
  const dx = nextPixel.x - enemy.x;
  const dy = nextPixel.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = enemy.speed * dtSeconds;
  
  if (dist < 2 || step >= dist) {
    // 直接移动到目标格子
    enemy.x = nextPixel.x;
    enemy.y = nextPixel.y;
    enemy.row = nextRow;
    enemy.col = nextCol;
  } else {
    // 按方向移动
    const dirX = dx / dist;
    const dirY = dy / dist;
    enemy.x += dirX * step;
    enemy.y += dirY * step;
    
    // 更新网格坐标
    const newGrid = pixelToGrid(enemy.x, enemy.y);
    enemy.row = newGrid.row;
    enemy.col = newGrid.col;
  }
  
  console.log(`[fallbackMovement] 敌人 ${enemy.id} 移动到(${enemy.row},${enemy.col})`);
  return true;
}

/**
 * 更新冲刺型敌人的冲刺状态
 * @param {Enemy} enemy 
 * @param {number} deltaTime 时间差（毫秒）
 */
function updateSprinterBehavior(enemy, deltaTime) {
  const config = ENEMY_CONFIGS[enemy.enemyType];
  if (!config || !config.specialBehavior) return;
  
  const behavior = config.specialBehavior;
  
  if (enemy.isSprinting) {
    // 正在冲刺中
    enemy.sprintDurationTimer -= deltaTime;
    if (enemy.sprintDurationTimer <= 0) {
      // 冲刺结束
      enemy.isSprinting = false;
      enemy.speed = behavior.baseSpeed;
      enemy.sprintCooldownTimer = behavior.sprintCooldown;
      enemy.el.classList.remove("enemy-sprinting");
    }
  } else {
    // 冷却中
    enemy.sprintCooldownTimer -= deltaTime;
    if (enemy.sprintCooldownTimer <= 0) {
      // 冷却完成，开始冲刺
      enemy.isSprinting = true;
      enemy.speed = behavior.baseSpeed * behavior.sprintSpeedMultiplier;
      enemy.sprintDurationTimer = behavior.sprintDuration;
      enemy.el.classList.add("enemy-sprinting");
    }
  }
}

/**
 * 检查吞噬型敌人是否可以吞噬附近的死亡敌人
 * @param {Enemy} devourer 吞噬型敌人
 * @param {Enemy[]} allEnemies 所有敌人列表
 * @param {Array<{x: number, y: number, enemyType: string}>} deadEnemies 死亡敌人位置记录
 */
function checkDevourerConsumption(devourer, allEnemies, deadEnemies) {
  const config = ENEMY_CONFIGS[devourer.enemyType];
  if (!config || !config.specialBehavior) return;
  
  const behavior = config.specialBehavior;
  if (devourer.devourCount >= behavior.maxDevours) return; // 已达到最大吞噬次数
  
  // 检查死亡敌人位置
  for (let i = deadEnemies.length - 1; i >= 0; i--) {
    const deadPos = deadEnemies[i];
    const dx = deadPos.x - devourer.x;
    const dy = deadPos.y - devourer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= behavior.devourRadius) {
      // 可以吞噬
      devourer.devourCount++;
      
      // 增加血量
      devourer.hp = Math.min(devourer.maxHp + devourer.devourCount * behavior.devourHpGain, 
                            devourer.maxHp + behavior.maxDevours * behavior.devourHpGain);
      const oldMaxHp = devourer.maxHp;
      devourer.maxHp = devourer.maxHp + behavior.devourHpGain;
      devourer.hp = devourer.hp + behavior.devourHpGain;
      
      // 降低速度
      devourer.speed = Math.max(10, devourer.speed - behavior.devourSpeedLoss);
      
      // 增加体型
      devourer.sizeScale = 1.0 + devourer.devourCount * behavior.devourSizeGain;
      devourer.el.style.transform = `translate(-50%, -50%) scale(${devourer.sizeScale})`;
      devourer.el.classList.add("enemy-devouring");
      
      // 移除已吞噬的死亡记录
      deadEnemies.splice(i, 1);
      
      // 播放吞噬效果（视觉反馈）
      setTimeout(() => {
        if (devourer.alive) {
          devourer.el.classList.remove("enemy-devouring");
        }
      }, 300);
      
      // 只吞噬一个
      break;
    }
  }
}

/**
 * 记录敌人死亡位置（供吞噬型敌人使用）
 * @param {Enemy} enemy 
 */
export function recordEnemyDeath(enemy) {
  deadEnemyPositions.push({
    x: enemy.x,
    y: enemy.y,
    enemyType: enemy.enemyType,
    timestamp: performance.now(),
  });
  
  // 清理5秒前的死亡记录（避免数组过大）
  const now = performance.now();
  deadEnemyPositions = deadEnemyPositions.filter(
    record => now - record.timestamp < 5000
  );
}

/**
 * 创建智能敌人的危险度计算函数
 * @param {Array} towers 塔列表
 * @param {number} dangerWeight 危险度权重
 * @param {number} dangerRadius 危险度计算半径（格子数）
 * @param {number} mapWidth 地图宽度
 * @param {number} mapHeight 地图高度
 * @returns {function(row: number, col: number): number} 危险度计算函数
 */
function createDangerCostFunction(towers, dangerWeight, dangerRadius, mapWidth, mapHeight) {
  return (row, col) => {
    let danger = 0;
    
    // 检查该格子周围dangerRadius x dangerRadius区域内的塔数量
    for (let dr = -dangerRadius; dr <= dangerRadius; dr++) {
      for (let dc = -dangerRadius; dc <= dangerRadius; dc++) {
        const checkRow = row + dr;
        const checkCol = col + dc;
        
        // 检查边界
        if (checkRow < 0 || checkRow >= mapHeight || checkCol < 0 || checkCol >= mapWidth) {
          continue;
        }
        
        // 检查该格子是否有塔
        const checkPixel = gridToPixel(checkRow, checkCol);
        for (const tower of towers) {
          if (!tower.alive) continue;
          
          // 检查塔是否在这个格子（允许一定误差）
          const towerGrid = pixelToGrid(tower.x, tower.y);
          if (towerGrid.row === checkRow && towerGrid.col === checkCol) {
            danger += dangerWeight;
            break; // 每个格子只计算一次
          }
        }
      }
    }
    
    return danger;
  };
}

/**
 * 更新治疗型敌人的治疗行为
 * @param {Enemy} healer 治疗型敌人
 * @param {Enemy[]} allEnemies 所有敌人列表
 * @param {number} deltaTime 时间差（毫秒）
 */
function updateHealerBehavior(healer, allEnemies, deltaTime) {
  const config = ENEMY_CONFIGS[healer.enemyType];
  if (!config || !config.specialBehavior) return;
  
  const behavior = config.specialBehavior;
  
  healer.healCooldownTimer -= deltaTime;
  
  if (healer.healCooldownTimer <= 0) {
    // 冷却完成，开始治疗
    const healedEnemies = [];
    
    for (const enemy of allEnemies) {
      if (!enemy.alive || enemy === healer) continue;
      if (enemy.enemyType === "healer") continue; // 不治疗其他治疗者
      
      const dx = enemy.x - healer.x;
      const dy = enemy.y - healer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= behavior.healRadius) {
        // 在治疗范围内
        const oldHp = enemy.hp;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + behavior.healAmount);
        if (enemy.hp > oldHp) {
          healedEnemies.push(enemy);
        }
      }
    }
    
    if (healedEnemies.length > 0) {
      // 播放治疗效果
      healer.el.classList.add("enemy-healing");
      setTimeout(() => {
        if (healer.alive) {
          healer.el.classList.remove("enemy-healing");
        }
      }, 500);
    }
    
    // 重置冷却
    healer.healCooldownTimer = behavior.healInterval;
  }
}

/**
 * 在戰場邊界隨機生成一個敵人，並向基地移動。
 * 使用网格坐标系统，初始位置对齐到网格。
 * @param {HTMLElement} gameField
 * @param {"normal"|"sprinter"|"devourer"|"smart"|"healer"|"ad"|"banner"|"script"} type
 * @param {Array<{x: number, y: number}>} [spawnPoints] 關卡出生點數組（0~1 相對座標），若提供則從中隨機選擇
 * @param {Array<Array<{x: number, y: number}>>} [previewPaths] 關卡預覽路徑數組（已废弃，保留兼容性）
 * @param {{x: number, y: number}} [basePosition] 基地位置（0~1 相對座標）
 * @returns {Enemy}
 */
export function spawnEnemy(gameField, type, spawnPoints = null, previewPaths = null, basePosition = null) {
  // 优先使用新配置系统，如果不存在则使用旧系统（兼容性）
  const config = ENEMY_CONFIGS[type] || null;
  const stats = config ? null : ENEMY_STATS[type];
  
  if (!config && !stats) {
    console.warn(`[enemy.js] 未知的敌人类型: ${type}，使用默认配置`);
    return null;
  }
  
  const rect = gameField.getBoundingClientRect();

  let pixelX = 0;
  let pixelY = 0;
  
  // 确定出生点（像素坐标）
  if (spawnPoints && spawnPoints.length > 0) {
    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    pixelX = spawn.x * rect.width;
    pixelY = spawn.y * rect.height;
  } else {
    // 默認行為：隨機選擇一個邊界生成：0 上 1 右 2 下 3 左
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) {
      pixelX = Math.random() * rect.width;
      pixelY = 0;
    } else if (edge === 1) {
      pixelX = rect.width;
      pixelY = Math.random() * rect.height;
    } else if (edge === 2) {
      pixelX = Math.random() * rect.width;
      pixelY = rect.height;
    } else {
      pixelX = 0;
      pixelY = Math.random() * rect.height;
    }
  }
  
  // 转换为网格坐标并对齐到网格中心
  const grid = pixelToGrid(pixelX, pixelY);
  const alignedPixel = gridToPixel(grid.row, grid.col);
  pixelX = alignedPixel.x;
  pixelY = alignedPixel.y;

  const id = `enemy-${enemyIdCounter++}`;

  const el = document.createElement("div");
  el.classList.add("enemy");
  
  // 根据敌人类型添加样式类和文本
  if (type === "normal") {
    el.classList.add("enemy-normal");
    el.textContent = "普通";
  } else if (type === "sprinter") {
    el.classList.add("enemy-sprinter");
    el.textContent = "冲刺";
  } else if (type === "devourer") {
    el.classList.add("enemy-devourer");
    el.textContent = "吞噬";
  } else if (type === "smart") {
    el.classList.add("enemy-smart");
    el.textContent = "智能";
  } else if (type === "healer") {
    el.classList.add("enemy-healer");
    el.textContent = "治疗";
  } else if (type === "ad") {
    el.classList.add("enemy-ad");
    el.textContent = "AD";
  } else if (type === "banner") {
    el.classList.add("enemy-banner");
    el.textContent = "BANNER";
  } else if (type === "script") {
    el.classList.add("enemy-script");
    el.textContent = "SCRIPT";
  }
  el.dataset.enemyId = id;

  // 血量條
  const hpBar = document.createElement("div");
  hpBar.className = "enemy-hp-bar";
  const hpFill = document.createElement("div");
  hpFill.className = "enemy-hp-fill";
  hpBar.appendChild(hpFill);
  el.appendChild(hpBar);

  el.style.left = `${pixelX}px`;
  el.style.top = `${pixelY}px`;

  gameField.appendChild(el);

  // 使用新配置系统或旧系统
  const maxHp = config ? config.maxHp : stats.hp;
  const moveSpeed = config ? config.moveSpeed : stats.speed;
  const armor = config ? (config.armor || 0) : 0;
  const specialBehavior = config ? config.specialBehavior : null;
  
  /** @type {Enemy} */
  const enemy = {
    id,
    el,
    x: pixelX,
    y: pixelY,
    row: grid.row,
    col: grid.col,
    speed: moveSpeed,
    hp: maxHp,
    maxHp: maxHp,
    enemyType: type,
    alive: true,
    path: [], // 网格坐标路径，将在第一次更新时计算（别名currentPath）
    pathIndex: 0,
    lastPathUpdateTime: 0,
    needsPathRecalculation: false, // 是否需要强制重新计算路径
    armor: armor,
  };
  
  // 根据敌人类型初始化特殊行为属性
  if (type === "sprinter" && specialBehavior) {
    enemy.sprintCooldownTimer = 0;
    enemy.sprintDurationTimer = 0;
    enemy.isSprinting = false;
    // 初始速度为基础速度
    enemy.speed = specialBehavior.baseSpeed || moveSpeed;
  } else if (type === "devourer" && specialBehavior) {
    enemy.devourCount = 0;
    enemy.sizeScale = 1.0;
    // 设置初始大小
    el.style.transform = "translate(-50%, -50%) scale(1.0)";
  } else if (type === "healer" && specialBehavior) {
    enemy.healCooldownTimer = 0;
    // 添加治疗型标记（用于后续渲染治疗范围）
    el.classList.add("enemy-healer-type");
  }

  return enemy;
}

/**
 * 为单个敌人重新计算路径
 * @param {Enemy} enemy 敌人对象
 * @param {{row: number, col: number}} baseGrid BASE的网格坐标
 * @param {function(row: number, col: number): boolean} isWalkable 判断格子是否可走的函数
 * @param {number} mapWidth 地图宽度
 * @param {number} mapHeight 地图高度
 * @param {Array} towers 塔列表
 * @returns {boolean} 是否成功找到路径
 */
function recalculateEnemyPath(enemy, baseGrid, isWalkable, mapWidth, mapHeight, towers) {
  if (!enemy.alive || !baseGrid) {
    return false;
  }
  
  console.log(`[recalculateEnemyPath] 为敌人 ${enemy.id} 重新计算路径: 从(${enemy.row},${enemy.col}) 到BASE(${baseGrid.row},${baseGrid.col})`);
  
  // 为智能敌人创建危险度计算函数
  let dangerCostFunc = null;
  if (enemy.enemyType === "smart") {
    const config = ENEMY_CONFIGS[enemy.enemyType];
    if (config && config.specialBehavior) {
      dangerCostFunc = createDangerCostFunction(
        towers,
        config.specialBehavior.dangerWeight,
        config.specialBehavior.dangerRadius,
        mapWidth,
        mapHeight
      );
    }
  }
  
  // 计算新路径
  const newPath = findPath(
    enemy.row,
    enemy.col,
    baseGrid.row,
    baseGrid.col,
    isWalkable,
    mapWidth,
    mapHeight,
    false, // 不允许对角线移动
    dangerCostFunc
  );
  
  if (newPath && newPath.length > 0) {
    // 成功找到路径
    console.log(`[recalculateEnemyPath] 敌人 ${enemy.id} 找到新路径，长度=${newPath.length}`);
    enemy.path = newPath;
    enemy.pathIndex = 0; // 从路径起点开始
    enemy.lastPathUpdateTime = performance.now();
    enemy.needsPathRecalculation = false;
    return true;
  } else {
    // 无法找到路径
    console.warn(
      `[recalculateEnemyPath] 敌人 ${enemy.id} 无法找到路径: ` +
      `从(${enemy.row},${enemy.col}) 到BASE(${baseGrid.row},${baseGrid.col})`
    );
    // 不更新路径，保留旧的路径（如果存在）继续走
    enemy.needsPathRecalculation = false;
    return false;
  }
}

/**
 * 为所有活着的敌人重新计算路径（用于塔放置后）
 * @param {Enemy[]} enemies 敌人数组
 * @param {{row: number, col: number}} baseGrid BASE的网格坐标
 * @param {function(row: number, col: number): boolean} isWalkable 判断格子是否可走的函数
 * @param {number} mapWidth 地图宽度
 * @param {number} mapHeight 地图高度
 * @param {Array} towers 塔列表
 */
export function recalculateAllEnemyPaths(enemies, baseGrid, isWalkable, mapWidth, mapHeight, towers) {
  console.log(`[recalculateAllEnemyPaths] 开始为所有敌人重新计算路径，敌人数量=${enemies.filter(e => e.alive).length}`);
  
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    
    // 标记需要重新计算路径
    enemy.needsPathRecalculation = true;
    
    // 立即重新计算
    recalculateEnemyPath(enemy, baseGrid, isWalkable, mapWidth, mapHeight, towers);
  }
  
  console.log(`[recalculateAllEnemyPaths] 完成路径重新计算`);
}

/**
 * 更新所有敵人位置與狀態。
 * 优化后的寻路策略：
 * - 只在生成时、路径走完时、或标记需要重新计算时更新路径
 * - 寻路失败时保留旧路径继续移动，避免卡死
 * @param {Enemy[]} enemies
 * @param {number} deltaTime 本幀與上一幀的時間差，毫秒
 * @param {{ x: number, y: number }} basePos 基地中心在戰場中的座標（像素）
 * @param {(enemy: Enemy, damageToBase: number) => void} onHitBase 當敵人到達基地時調用
 * @param {(enemy: Enemy) => void} [onEnemyKilled] 當敵人被擊殺時調用（hp <= 0）
 * @param {function(row: number, col: number): boolean} isWalkable 判断格子是否可走的函数
 * @param {number} mapWidth 地图宽度（格子数）
 * @param {number} mapHeight 地图高度（格子数）
 * @param {{row: number, col: number}} baseGrid BASE的网格坐标
 * @param {Array} [towers] 塔列表（用于智能敌人的危险度计算）
 */
export function updateEnemies(
  enemies, 
  deltaTime, 
  basePos, 
  onHitBase, 
  onEnemyKilled = null,
  isWalkable = null,
  mapWidth = 0,
  mapHeight = 0,
  baseGrid = null,
  towers = []
) {
  const dtSeconds = deltaTime / 1000;
  const epsilon = 2; // 到達目標點的距離閾值（像素）
  const PATH_UPDATE_INTERVAL = 200; // 路径更新间隔（毫秒），用于性能优化

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    // 更新特殊行为（在移动之前）
    if (enemy.enemyType === "sprinter") {
      updateSprinterBehavior(enemy, deltaTime);
    } else if (enemy.enemyType === "devourer") {
      checkDevourerConsumption(enemy, enemies, deadEnemyPositions);
    } else if (enemy.enemyType === "healer") {
      updateHealerBehavior(enemy, enemies, deltaTime);
    }

    // 更新当前网格坐标
    const currentGrid = pixelToGrid(enemy.x, enemy.y);
    enemy.row = currentGrid.row;
    enemy.col = currentGrid.col;

    // 检查是否到达基地
    if (baseGrid && enemy.row === baseGrid.row && enemy.col === baseGrid.col) {
      enemy.alive = false;
      enemy.el.remove();
      const damageToBase = ENEMY_DAMAGE_TO_BASE[enemy.enemyType] || 1;
      onHitBase(enemy, damageToBase);
      continue;
    }

    // 如果距离基地很近（像素距离），也视为到达
    const distToBase = Math.sqrt(
      (enemy.x - basePos.x) ** 2 + (enemy.y - basePos.y) ** 2
    );
    if (distToBase <= BASE_RADIUS) {
      enemy.alive = false;
      enemy.el.remove();
      const damageToBase = ENEMY_DAMAGE_TO_BASE[enemy.enemyType] || 1;
      onHitBase(enemy, damageToBase);
      continue;
    }

    // 优化后的寻路策略：只在以下情况更新路径：
    // 1. 路径为空或未初始化（生成时）
    // 2. 路径索引超出范围（路径走完）
    // 3. 标记需要强制重新计算（塔放置后）
    const needsPathUpdate = 
      !enemy.path || 
      enemy.path.length === 0 || 
      enemy.pathIndex >= enemy.path.length ||
      enemy.needsPathRecalculation;

    if (needsPathUpdate && isWalkable && baseGrid) {
      // 尝试重新计算路径
      const pathFound = recalculateEnemyPath(
        enemy,
        baseGrid,
        isWalkable,
        mapWidth,
        mapHeight,
        towers || []
      );
      
      if (!pathFound) {
        // 寻路失败，但不要立即卡死
        // 如果还有旧路径，继续按旧路径走（可能会遇到障碍，但至少能移动）
        if (!enemy.path || enemy.path.length === 0) {
          // 完全没有路径
          if (USE_FALLBACK_MOVEMENT_WHEN_NO_PATH) {
            // 兜底模式：使用简单的直线移动逻辑
            console.warn(
              `[updateEnemies] 敌人 ${enemy.id} 寻路失败且无旧路径，启用兜底移动模式。位置: (${enemy.row},${enemy.col})`
            );
            // 使用兜底移动，这样至少小怪还能动起来，方便调试
            fallbackMovement(enemy, baseGrid, isWalkable, dtSeconds);
          } else {
            // 完全依赖寻路逻辑，停在原地并记录详细日志
            console.error(
              `[updateEnemies] 敌人 ${enemy.id} 完全没有路径且兜底模式关闭，停在原地。` +
              `位置: (${enemy.row},${enemy.col}), BASE: (${baseGrid.row},${baseGrid.col})`
            );
          }
        } else {
          // 保留旧路径继续走
          console.log(
            `[updateEnemies] 敌人 ${enemy.id} 寻路失败，保留旧路径继续移动。路径长度=${enemy.path.length}`
          );
        }
      }
    }

    // 移动逻辑：如果有有效路径，继续移动
    if (enemy.path && enemy.path.length > 0 && enemy.pathIndex < enemy.path.length) {
      const targetGrid = enemy.path[enemy.pathIndex];
      
      // 安全检查：如果目标格子不可走，可能是路径过期了，尝试重新寻路
      if (isWalkable && !isWalkable(targetGrid.row, targetGrid.col)) {
        console.warn(
          `[updateEnemies] 敌人 ${enemy.id} 的路径目标格子(${targetGrid.row},${targetGrid.col})不可走，` +
          `当前位置(${enemy.row},${enemy.col})，强制重新寻路`
        );
        // 强制重新寻路
        enemy.needsPathRecalculation = true;
        // 如果重新寻路失败，继续按当前路径移动（至少不会卡在原地）
        if (baseGrid) {
          recalculateEnemyPath(enemy, baseGrid, isWalkable, mapWidth, mapHeight, towers || []);
        }
      }
      
      const targetPixel = gridToPixel(targetGrid.row, targetGrid.col);
      
      const dx = targetPixel.x - enemy.x;
      const dy = targetPixel.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = enemy.speed * dtSeconds;

      // 如果距离很小或步长超过距离，直接设置为目标点并移动到下一个路径点
      if (dist < epsilon || step >= dist) {
        // 到达目标点，检查是否在合法位置
        const newGrid = targetGrid;
        
        // 安全检查：确保目标格子可走
        if (isWalkable && !isWalkable(newGrid.row, newGrid.col)) {
          console.error(
            `[updateEnemies] 错误：敌人 ${enemy.id} 移动到非法格子(${newGrid.row},${newGrid.col})！` +
            `当前位置(${enemy.row},${enemy.col})，强制重新寻路`
          );
          // 不移动，保持当前位置
          enemy.needsPathRecalculation = true;
          if (baseGrid) {
            recalculateEnemyPath(enemy, baseGrid, isWalkable, mapWidth, mapHeight, towers || []);
          }
        } else {
          // 正常移动到目标点
          enemy.x = targetPixel.x;
          enemy.y = targetPixel.y;
          enemy.row = newGrid.row;
          enemy.col = newGrid.col;
          enemy.pathIndex++;
        }
      } else {
        // 按方向增量移动
        const dirX = dx / dist;
        const dirY = dy / dist;
        enemy.x += dirX * step;
        enemy.y += dirY * step;
        
        // 确保不会越界（基于网格边界）
        const newGrid = pixelToGrid(enemy.x, enemy.y);
        if (newGrid.row !== enemy.row || newGrid.col !== enemy.col) {
          // 如果跨过了网格边界，检查新格子是否可走
          if (isWalkable && !isWalkable(newGrid.row, newGrid.col)) {
            // 新格子不可走，回退到上一个合法位置
            console.warn(
              `[updateEnemies] 敌人 ${enemy.id} 尝试移动到非法格子(${newGrid.row},${newGrid.col})，回退`
            );
            enemy.x = gridToPixel(enemy.row, enemy.col).x;
            enemy.y = gridToPixel(enemy.row, enemy.col).y;
            // 标记需要重新寻路
            enemy.needsPathRecalculation = true;
          } else {
            // 更新网格坐标
            enemy.row = newGrid.row;
            enemy.col = newGrid.col;
          }
        }
      }
    } else {
      // 没有有效路径
      if (!enemy.path || enemy.path.length === 0) {
        // 完全没有路径
        if (USE_FALLBACK_MOVEMENT_WHEN_NO_PATH) {
          // 兜底模式：使用简单的直线移动逻辑
          console.warn(
            `[updateEnemies] 敌人 ${enemy.id} 没有有效路径，启用兜底移动模式。位置: (${enemy.row},${enemy.col})`
          );
          if (baseGrid && isWalkable) {
            fallbackMovement(enemy, baseGrid, isWalkable, dtSeconds);
          }
        } else {
          // 完全依赖寻路逻辑
          if (baseGrid && isWalkable) {
            console.log(`[updateEnemies] 敌人 ${enemy.id} 没有路径，尝试重新寻路`);
            const pathFound = recalculateEnemyPath(enemy, baseGrid, isWalkable, mapWidth, mapHeight, towers || []);
            if (!pathFound) {
              console.error(
                `[updateEnemies] 敌人 ${enemy.id} 重新寻路失败，停在原地。` +
                `位置: (${enemy.row},${enemy.col}), BASE: (${baseGrid.row},${baseGrid.col})`
              );
            }
          }
        }
      } else if (enemy.pathIndex >= enemy.path.length) {
        // 路径走完，应该已经到达BASE（由前面的检查处理）
        console.warn(`[updateEnemies] 敌人 ${enemy.id} 路径走完但未到达BASE，可能有问题`);
      }
    }

    // 更新 DOM 位置
    enemy.el.style.left = `${enemy.x}px`;
    enemy.el.style.top = `${enemy.y}px`;

    // 更新血量條可視比例
    const hpBar = /** @type {HTMLElement | null} */ (
      enemy.el.querySelector(".enemy-hp-fill")
    );
    if (hpBar) {
      const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
      hpBar.style.transform = `scaleX(${ratio})`;
    }

    // 如果血量歸零，則移除敵人（被擊殺）
    if (enemy.hp <= 0 && enemy.alive) {
      // 记录死亡位置（供吞噬型敌人使用）
      recordEnemyDeath(enemy);
      
      enemy.alive = false;
      enemy.el.remove();
      // 通知擊殺統計
      if (onEnemyKilled) {
        onEnemyKilled(enemy);
      }
    }
  }
}


