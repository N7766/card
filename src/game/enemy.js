/**
 * 敵人模組：負責生成敵人 DOM 與更新其在戰場中的移動與狀態。
 * 使用网格坐标和动态寻路，避免穿墙问题。
 * 支持多种特殊敌人类型：冲刺型、吞噬型、智能绕路型、治疗型等。
 */

import { ENEMY_CONFIGS, ENEMY_STATS, ENEMY_DAMAGE_TO_BASE, BASE_RADIUS, BOSS_CONFIG, getEnemyVisualSpec } from "./config.js";
import { pixelToGrid, gridToPixel, findPath, GRID_CONFIG } from "./pathfinding.js";
import { featureFlags } from "./featureFlags.js";
import { getDebugMode } from "./debug.js";

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
 * 判断是否需要输出敌人移动调试日志
 * @returns {boolean}
 */
function shouldLogEnemyMovement() {
  return featureFlags.debugOverlay && getDebugMode();
}

/**
 * 输出敌人移动调试日志
 * @param {"log"|"warn"|"error"} level
 * @param {string} message
 */
function logEnemyDebug(level, message) {
  if (!shouldLogEnemyMovement()) return;
  console[level](message);
}

/**
 * 当敌人尝试进入墙或塔时输出调试信息
 * @param {Enemy} enemy
 * @param {number} targetRow
 * @param {number} targetCol
 * @param {string} context
 */
function logEnemyCollisionAttempt(enemy, targetRow, targetCol, context) {
  logEnemyDebug(
    "warn",
    `[enemy-move-blocked] ${enemy.id} (${enemy.enemyType}) ${context} -> 目标格子(${targetRow}, ${targetCol})`
  );
}

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
 * @property {number} rewardEnergy 击杀后提供的能量奖励
 * @property {string} [specialTag] 特殊标签（fast, tank等）
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
 * @property {number} [hitRadius] 命中判定半径
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
    logEnemyDebug(
      "log",
      `[fallbackMovement] 敌人 ${enemy.id} 已在BASE位置(${baseGrid.row},${baseGrid.col})，无需移动`
    );
    return true;
  }
  
  logEnemyDebug(
    "log",
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
    logEnemyCollisionAttempt(enemy, nextRow, nextCol, "兜底移动主方向被阻挡");
    // 尝试另一个方向
    if (moveDirection === "row") {
      // 尝试col方向
      nextRow = enemy.row;
      nextCol = enemy.col + (dCol > 0 ? 1 : -1);
      if (Math.abs(dCol) === 0) {
        // 两个方向都不可走，停在原地
        logEnemyDebug(
          "warn",
          `[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走（已尝试row和col），停在原地`
        );
        return false;
      }
      if (isWalkable && !isWalkable(nextRow, nextCol)) {
        // col方向也不可走，停在原地
        logEnemyCollisionAttempt(enemy, nextRow, nextCol, "兜底移动备选方向被阻挡");
        logEnemyDebug("warn", `[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走，停在原地`);
        return false;
      }
    } else {
      // 尝试row方向
      nextCol = enemy.col;
      nextRow = enemy.row + (dRow > 0 ? 1 : -1);
      if (Math.abs(dRow) === 0) {
        // 两个方向都不可走，停在原地
        logEnemyDebug(
          "warn",
          `[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走（已尝试col和row），停在原地`
        );
        return false;
      }
      if (isWalkable && !isWalkable(nextRow, nextCol)) {
        // row方向也不可走，停在原地
        logEnemyCollisionAttempt(enemy, nextRow, nextCol, "兜底移动备选方向被阻挡");
        logEnemyDebug("warn", `[fallbackMovement] 敌人 ${enemy.id} 所有方向都不可走，停在原地`);
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
  
  logEnemyDebug("log", `[fallbackMovement] 敌人 ${enemy.id} 移动到(${enemy.row},${enemy.col})`);
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
  const speedMultiplier = enemy.speedMultiplier !== undefined ? enemy.speedMultiplier : 1.0;
  const baseSpeed = behavior.baseSpeed ?? config.baseSpeed ?? enemy.speed;
  const sprintMultiplier = behavior.sprintSpeedMultiplier ?? 2.5;
  const sprintDuration = behavior.sprintDuration ?? 800;
  const sprintCooldown = behavior.sprintCooldown ?? behavior.sprintInterval ?? 3000;

  if (typeof enemy.sprintCooldownTimer !== "number") {
    enemy.sprintCooldownTimer = 0;
  }
  if (typeof enemy.sprintDurationTimer !== "number") {
    enemy.sprintDurationTimer = 0;
  }
  
  if (enemy.isSprinting) {
    enemy.sprintDurationTimer -= deltaTime;
    if (enemy.sprintDurationTimer <= 0) {
      enemy.isSprinting = false;
      enemy.speed = baseSpeed * speedMultiplier;
      enemy.sprintCooldownTimer = sprintCooldown;
      enemy.el.classList.remove("enemy-sprinting");
    }
  } else {
    enemy.sprintCooldownTimer -= deltaTime;
    if (enemy.sprintCooldownTimer <= 0) {
      enemy.isSprinting = true;
      enemy.speed = baseSpeed * sprintMultiplier * speedMultiplier;
      enemy.sprintDurationTimer = sprintDuration;
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
  const maxDevours = behavior.maxDevours ?? Infinity;
  if (devourer.devourCount >= maxDevours) return; // 已达到最大吞噬次数
  const devourRadius = behavior.devourRadius ?? 0;
  
  // 检查死亡敌人位置
  for (let i = deadEnemies.length - 1; i >= 0; i--) {
    const deadPos = deadEnemies[i];
    const dx = deadPos.x - devourer.x;
    const dy = deadPos.y - devourer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= devourRadius) {
      // 可以吞噬
      devourer.devourCount++;

      const hpGain = behavior.devourHpGain ?? 0;
      if (hpGain > 0) {
        devourer.maxHp += hpGain;
        devourer.hp = Math.min(devourer.maxHp, devourer.hp + hpGain);
      }

      const speedPenalty = behavior.speedDecayPerDevour ?? behavior.devourSpeedLoss ?? 0;
      if (speedPenalty > 0) {
        devourer.speed = Math.max(10, devourer.speed - speedPenalty);
      }
      
      const sizeGain = behavior.devourSizeGain ?? 0;
      devourer.sizeScale = 1.0 + devourer.devourCount * sizeGain;
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
 * Boss 技能相關輔助函數
 */
function randomPick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function triggerBossCastingFx(enemy, duration = 600) {
  if (!enemy?.el) return;
  enemy.el.classList.add("enemy-boss-casting");
  setTimeout(() => {
    if (enemy.alive) {
      enemy.el.classList.remove("enemy-boss-casting");
    }
  }, duration);
}

function createBossSummonEffect(gameField, x, y) {
  if (!gameField) return;
  const ring = document.createElement("div");
  ring.className = "boss-summon-effect";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  gameField.appendChild(ring);
  setTimeout(() => ring.remove(), 600);
}

function createTowerDestructionFx(gameField, x, y) {
  if (!gameField) return;
  const shockwave = document.createElement("div");
  shockwave.className = "boss-tower-shockwave";
  shockwave.style.left = `${x}px`;
  shockwave.style.top = `${y}px`;
  gameField.appendChild(shockwave);
  setTimeout(() => shockwave.remove(), 600);

  const sparks = document.createElement("div");
  sparks.className = "boss-tower-sparks";
  sparks.style.left = `${x}px`;
  sparks.style.top = `${y}px`;
  gameField.appendChild(sparks);
  setTimeout(() => sparks.remove(), 500);
}

function isTileOccupiedByEnemy(enemies, row, col) {
  return enemies.some((enemy) => enemy.alive && enemy.row === row && enemy.col === col);
}

function getTowerGridPositions(towers) {
  return towers
    .filter((tower) => tower.alive)
    .map((tower) => ({ tower, grid: pixelToGrid(tower.x, tower.y) }));
}

function collectSummonTiles(enemy, behavior, mapWidth, mapHeight, baseGrid, towers, enemies, isWalkable) {
  const radius = behavior?.summonRadius ?? 2;
  const tiles = [];
  if (radius <= 0) return tiles;
  const towerGrids = getTowerGridPositions(towers);

  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const row = enemy.row + dr;
      const col = enemy.col + dc;
      if (row < 0 || row >= mapHeight || col < 0 || col >= mapWidth) continue;
      if (dr === 0 && dc === 0) continue;

      const dist = Math.sqrt(dr * dr + dc * dc);
      if (dist > radius) continue;

      if (baseGrid && row === baseGrid.row && col === baseGrid.col) continue;
      if (isTileOccupiedByEnemy(enemies, row, col)) continue;

      const hasTower = towerGrids.some(({ grid }) => grid.row === row && grid.col === col);
      if (hasTower) continue;

      if (typeof isWalkable === "function" && !isWalkable(row, col)) continue;

      tiles.push({ row, col, dist });
    }
  }

  tiles.sort((a, b) => a.dist - b.dist);
  return tiles;
}

function attemptBossSummon(enemy, behavior, context, pendingSpawns) {
  if (!behavior || !context.gameField) return false;
  const desiredCount = behavior.summonCountEachTime ?? 3;
  if (desiredCount <= 0) return false;

  const summonTiles = collectSummonTiles(
    enemy,
    behavior,
    context.mapWidth,
    context.mapHeight,
    context.baseGrid,
    context.towers,
    context.enemies,
    context.walkableChecker
  );
  if (summonTiles.length === 0) {
    return false;
  }

  triggerBossCastingFx(enemy);
  let spawned = 0;
  for (const tile of summonTiles) {
    if (spawned >= desiredCount) break;
    const type = randomPick(behavior.summonTypes) || "normal";
    const newEnemy = spawnEnemy(
      context.gameField,
      type,
      context.spawnPoints,
      null,
      context.basePosition,
      behavior.summonHpMultiplier ?? 1,
      behavior.summonSpeedMultiplier ?? 1,
      {
        forcedGridPosition: tile,
        spawnedByBoss: true,
      }
    );
    if (newEnemy) {
      newEnemy.spawnedByBoss = true;
      newEnemy.needsPathRecalculation = true;
      pendingSpawns.push(newEnemy);
      const pixelPos = gridToPixel(tile.row, tile.col);
      createBossSummonEffect(context.gameField, pixelPos.x, pixelPos.y);
      spawned++;
    }
  }

  return spawned > 0;
}

function scheduleTowerDestruction(tower, context, behavior) {
  if (!tower || !tower.alive || tower.pendingBossDestroy) return false;
  tower.pendingBossDestroy = true;
  const warningDuration = behavior?.towerDestroyWarningDuration ?? 800;

  if (context.gameField) {
    const warning = document.createElement("div");
    warning.className = "boss-tower-warning";
    warning.style.left = `${tower.x}px`;
    warning.style.top = `${tower.y}px`;
    context.gameField.appendChild(warning);
    setTimeout(() => warning.remove(), warningDuration + 200);
  }

  setTimeout(() => {
    if (!tower.alive) {
      tower.pendingBossDestroy = false;
      return;
    }
    createTowerDestructionFx(context.gameField, tower.x, tower.y);
    tower.alive = false;
    tower.el.classList.add("tower-destroyed");
    tower.el.style.opacity = "0";
    setTimeout(() => {
      tower.el.remove();
    }, 400);
    tower.pendingBossDestroy = false;
    if (typeof context.onTowerDestroyed === "function") {
      context.onTowerDestroyed(tower);
    }
  }, warningDuration);

  return true;
}

function attemptBossTowerDestruction(enemy, behavior, context) {
  if (!behavior || !context || !Array.isArray(context.towers)) return false;
  const range = behavior.towerDestroyRange ?? 3;
  const maxCount = behavior.towerDestroyCount ?? 1;
  const targets = [];

  for (const tower of context.towers) {
    if (!tower.alive) continue;
    const gridPos = pixelToGrid(tower.x, tower.y);
    const dr = gridPos.row - enemy.row;
    const dc = gridPos.col - enemy.col;
    const dist = Math.sqrt(dr * dr + dc * dc);
    if (dist <= range) {
      targets.push({ tower, priority: tower.damage || 0, dist });
    }
  }

  if (targets.length === 0) return false;

  targets.sort((a, b) => {
    if (b.priority === a.priority) {
      return a.dist - b.dist;
    }
    return b.priority - a.priority;
  });

  triggerBossCastingFx(enemy, 800);
  let destroyed = 0;
  for (const target of targets) {
    if (destroyed >= maxCount) break;
    const success = scheduleTowerDestruction(target.tower, context, behavior);
    if (success) {
      destroyed++;
    }
  }
  return destroyed > 0;
}

function notifyBossDefeated(options, enemy) {
  if (!enemy?.isBoss || enemy._bossDefeatNotified) return;
  enemy._bossDefeatNotified = true;
  if (options && typeof options.onBossDefeated === "function") {
    options.onBossDefeated(enemy);
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
 * @param {number} [hpMultiplier=1.0] 血量係數，用於波次難度調整
 * @param {number} [speedMultiplier=1.0] 速度係數，用於波次難度調整
 * @param {{ forcedGridPosition?: {row:number,col:number}, forcedPixelPosition?: {x:number,y:number}, spawnedByBoss?: boolean }} [options]
 * @returns {Enemy}
 */
export function spawnEnemy(
  gameField,
  type,
  spawnPoints = null,
  previewPaths = null,
  basePosition = null,
  hpMultiplier = 1.0,
  speedMultiplier = 1.0,
  options = null
) {
  // 【兜底模式】如果多种敌人类型功能关闭，强制使用普通敌人
  let actualType = type;
  if (!featureFlags.multiEnemyTypes && type !== "normal" && type !== "boss") {
    console.log(`[enemy.js] 多种敌人类型功能已关闭，将 ${type} 转换为 normal`);
    actualType = "normal";
  }
  
  // 优先使用新配置系统，如果不存在则使用旧系统（兼容性）
  const config = ENEMY_CONFIGS[actualType] || null;
  const stats = config ? null : ENEMY_STATS[actualType];
  const visualSpec = getEnemyVisualSpec(actualType);
  
  if (!config && !stats) {
    console.warn(`[enemy.js] 未知的敌人类型: ${actualType}，使用默认配置`);
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
  
  // 转换为网格坐标并对齐到网格中心（允许外部覆写出生位置）
  let grid = pixelToGrid(pixelX, pixelY);
  if (options?.forcedGridPosition) {
    grid = {
      row: options.forcedGridPosition.row,
      col: options.forcedGridPosition.col,
    };
    const forcedPixel = gridToPixel(grid.row, grid.col);
    pixelX = forcedPixel.x;
    pixelY = forcedPixel.y;
  } else if (options?.forcedPixelPosition) {
    pixelX = options.forcedPixelPosition.x;
    pixelY = options.forcedPixelPosition.y;
    grid = pixelToGrid(pixelX, pixelY);
  } else {
    const alignedPixel = gridToPixel(grid.row, grid.col);
    pixelX = alignedPixel.x;
    pixelY = alignedPixel.y;
  }

  const id = `enemy-${enemyIdCounter++}`;

  const el = document.createElement("div");
  el.classList.add("enemy");
  
  // 根据敌人类型添加样式类和文本（使用actualType）
  if (actualType === "normal") {
    el.classList.add("enemy-normal");
    el.textContent = "普通";
  } else if (actualType === "sprinter") {
    el.classList.add("enemy-sprinter");
    el.textContent = "冲刺";
  } else if (actualType === "devourer") {
    el.classList.add("enemy-devourer");
    el.textContent = "吞噬";
  } else if (actualType === "smart") {
    el.classList.add("enemy-smart");
    el.textContent = "智能";
  } else if (actualType === "healer") {
    el.classList.add("enemy-healer");
    el.textContent = "治疗";
  } else if (actualType === "ad") {
    el.classList.add("enemy-ad");
    el.textContent = "AD";
  } else if (actualType === "banner") {
    el.classList.add("enemy-banner");
    el.textContent = "BANNER";
  } else if (actualType === "script") {
    el.classList.add("enemy-script");
    el.textContent = "SCRIPT";
  } else if (actualType === "boss") {
    el.classList.add("enemy-boss");
    el.textContent = "BOSS";
  }
  el.dataset.enemyId = id;
  if (Number.isFinite(visualSpec?.width)) {
    el.style.width = `${visualSpec.width}px`;
  }
  if (Number.isFinite(visualSpec?.height)) {
    el.style.height = `${visualSpec.height}px`;
  }
  if (Number.isFinite(visualSpec?.highlightRadius)) {
    el.style.setProperty("--enemy-highlight-radius", `${visualSpec.highlightRadius}px`);
  } else {
    el.style.removeProperty("--enemy-highlight-radius");
  }

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
  let baseMaxHp = config ? config.maxHp : stats.hp;
  let baseMoveSpeed = config ? (config.baseSpeed ?? config.moveSpeed) : stats.speed;
  const armor = config ? (config.armor || 0) : 0;
  const specialBehavior = config ? config.specialBehavior : null;
  
  // 应用波次配置中的血量和速度系数
  const maxHp = Math.floor(baseMaxHp * hpMultiplier);
  const moveSpeed = baseMoveSpeed * speedMultiplier;
  
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
    enemyType: actualType,
    alive: true,
    path: [], // 网格坐标路径，将在第一次更新时计算（别名currentPath）
    pathIndex: 0,
    lastPathUpdateTime: 0,
    needsPathRecalculation: false, // 是否需要强制重新计算路径
    armor: armor,
    rewardEnergy: config && typeof config.rewardEnergy === "number" ? config.rewardEnergy : 1,
    isBoss: actualType === "boss",
    displayName: (config && config.displayName) || actualType.toUpperCase(),
    hitRadius: visualSpec?.hitRadius ?? 20,
  };
  
  if (options?.spawnedByBoss) {
    enemy.spawnedByBoss = true;
    el.classList.add("enemy-summoned-by-boss");
  }

  // 【新逻辑】根据敌人类型初始化特殊行为属性（通过featureFlags.multiEnemyTypes控制）
  if (featureFlags.multiEnemyTypes) {
    if (actualType === "sprinter" && specialBehavior) {
      enemy.sprintCooldownTimer = 0;
      enemy.sprintDurationTimer = 0;
      enemy.isSprinting = false;
      // 存储速度系数，用于冲刺时正确计算速度
      enemy.speedMultiplier = speedMultiplier;
      // 初始速度为基础速度（应用速度系数）
      const baseSpeed = specialBehavior.baseSpeed || baseMoveSpeed;
      enemy.speed = baseSpeed * speedMultiplier;
    } else if (actualType === "devourer" && specialBehavior) {
      enemy.devourCount = 0;
      enemy.sizeScale = 1.0;
      // 设置初始大小
      el.style.transform = "translate(-50%, -50%) scale(1.0)";
    } else if (actualType === "healer" && specialBehavior) {
      enemy.healCooldownTimer = 0;
      // 添加治疗型标记（用于后续渲染治疗范围）
      el.classList.add("enemy-healer-type");
    }
  }

  if (actualType === "boss") {
    const behavior = config?.specialBehavior || BOSS_CONFIG.specialBehavior || {};
    enemy.bossBehavior = behavior;
    const summonInterval = behavior.summonInterval ?? 5000;
    const destroyInterval = behavior.towerDestroyInterval ?? 8000;
    enemy.summonCooldownTimer = summonInterval * (0.5 + Math.random() * 0.5);
    enemy.towerDestroyCooldownTimer = destroyInterval * (0.5 + Math.random() * 0.5);
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
  
  // 【新逻辑】为智能敌人创建危险度计算函数（通过featureFlags.multiEnemyTypes控制）
  let dangerCostFunc = null;
  if (featureFlags.multiEnemyTypes && enemy.enemyType === "smart") {
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
  towers = [],
  extraOptions = {}
) {
  const dtSeconds = deltaTime / 1000;
  const epsilon = 2; // 到達目標點的距離閾值（像素）
  const PATH_UPDATE_INTERVAL = 200; // 路径更新间隔（毫秒），用于性能优化
  const bossOptions = extraOptions || {};
  const pendingSummons = [];
  const bossContext = {
    gameField: bossOptions.gameField || null,
    spawnPoints: bossOptions.spawnPoints || null,
    basePosition: bossOptions.basePosition || null,
    mapWidth,
    mapHeight,
    baseGrid,
    towers,
    enemies,
    walkableChecker: isWalkable,
    onTowerDestroyed: bossOptions.onTowerDestroyed,
  };

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    // 【新逻辑】更新特殊行为（在移动之前，通过featureFlags.multiEnemyTypes控制）
    if (featureFlags.multiEnemyTypes) {
      if (enemy.enemyType === "sprinter") {
        updateSprinterBehavior(enemy, deltaTime);
      } else if (enemy.enemyType === "devourer") {
        checkDevourerConsumption(enemy, enemies, deadEnemyPositions);
      } else if (enemy.enemyType === "healer") {
        updateHealerBehavior(enemy, enemies, deltaTime);
      }
    }

    if (enemy.isBoss) {
      // Boss 主動技能：同時管理召喚冷卻與拆塔冷卻，確保玩法節奏可控
      const behavior = enemy.bossBehavior || BOSS_CONFIG.specialBehavior || {};
      const summonInterval = behavior.summonInterval ?? 5000;
      const summonRetry = behavior.summonRetryDelay ?? 1500;
      const destroyInterval = behavior.towerDestroyInterval ?? 8000;
      const destroyRetry = behavior.towerDestroyRetryDelay ?? 2000;

      enemy.summonCooldownTimer =
        (typeof enemy.summonCooldownTimer === "number" ? enemy.summonCooldownTimer : summonInterval) - deltaTime;
      if (enemy.summonCooldownTimer <= 0) {
        const summoned = attemptBossSummon(enemy, behavior, bossContext, pendingSummons);
        enemy.summonCooldownTimer = summoned ? summonInterval : summonRetry;
      }

      enemy.towerDestroyCooldownTimer =
        (typeof enemy.towerDestroyCooldownTimer === "number" ? enemy.towerDestroyCooldownTimer : destroyInterval) - deltaTime;
      if (enemy.towerDestroyCooldownTimer <= 0) {
        const destroyedTower = attemptBossTowerDestruction(enemy, behavior, bossContext);
        enemy.towerDestroyCooldownTimer = destroyedTower ? destroyInterval : destroyRetry;
      }
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
      if (enemy.isBoss) {
        notifyBossDefeated(bossOptions, enemy);
      }
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
      if (enemy.isBoss) {
        notifyBossDefeated(bossOptions, enemy);
      }
      continue;
    }

    // 【新逻辑】优化后的寻路策略（通过featureFlags.newPathfinding控制）
    // 【兜底模式】如果新寻路功能关闭，使用简单的直线移动逻辑
    if (!featureFlags.newPathfinding) {
      // 旧逻辑：简单直线移动（朝向BASE）
      const dx = basePos.x - enemy.x;
      const dy = basePos.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > epsilon) {
        const step = enemy.speed * dtSeconds;
        const moveDistance = Math.min(step, dist);
        const dirX = dx / dist;
        const dirY = dy / dist;
        const nextX = enemy.x + dirX * moveDistance;
        const nextY = enemy.y + dirY * moveDistance;
        const nextGrid = pixelToGrid(nextX, nextY);

        if (isWalkable && !isWalkable(nextGrid.row, nextGrid.col)) {
          logEnemyCollisionAttempt(enemy, nextGrid.row, nextGrid.col, "旧移动逻辑检测到障碍");
          if (baseGrid && isWalkable) {
            fallbackMovement(enemy, baseGrid, isWalkable, dtSeconds);
          }
        } else {
          enemy.x = nextX;
          enemy.y = nextY;
          enemy.row = nextGrid.row;
          enemy.col = nextGrid.col;
        }
      }
    } else {
      // 【新逻辑】动态寻路系统
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

    // 【新逻辑】移动逻辑：如果有有效路径，继续移动（通过featureFlags.newPathfinding控制）
    if (featureFlags.newPathfinding && enemy.path && enemy.path.length > 0 && enemy.pathIndex < enemy.path.length) {
      const targetGrid = enemy.path[enemy.pathIndex];
      
      // 安全检查：如果目标格子不可走，可能是路径过期了，尝试重新寻路
      if (isWalkable && !isWalkable(targetGrid.row, targetGrid.col)) {
        logEnemyCollisionAttempt(
          enemy,
          targetGrid.row,
          targetGrid.col,
          "路径目标格子不可走，强制重新寻路"
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
          logEnemyCollisionAttempt(
            enemy,
            newGrid.row,
            newGrid.col,
            "路径终点非法，强制重新寻路"
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
            logEnemyCollisionAttempt(
              enemy,
              newGrid.row,
              newGrid.col,
              "插值移动检测到非法格子，回退"
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
    } // 结束 newPathfinding 分支

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

    if (enemy.isBoss && typeof bossOptions.onBossHpChanged === "function") {
      bossOptions.onBossHpChanged(enemy.hp, enemy.maxHp, enemy);
    }

    // 如果血量歸零，則移除敵人（被擊殺）
    if (enemy.hp <= 0 && enemy.alive) {
      // 记录死亡位置（供吞噬型敌人使用）
      recordEnemyDeath(enemy);
      if (enemy.isBoss) {
        notifyBossDefeated(bossOptions, enemy);
      }
      
      enemy.alive = false;
      enemy.el.remove();
      // 通知擊殺統計
      if (onEnemyKilled) {
        onEnemyKilled(enemy);
      }
    }
  }

  if (pendingSummons.length > 0) {
    enemies.push(...pendingSummons);
    if (typeof bossOptions.onExtraEnemySpawned === "function") {
      bossOptions.onExtraEnemySpawned(pendingSummons);
    }
  }
}


