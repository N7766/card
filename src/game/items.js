/**
 * 道具系统：随机地图道具 + 道具栏
 * 负责道具生成、拾取、使用逻辑
 */

/**
 * 道具配置常量
 */
export const ITEM_CONFIG = {
  // 生成间隔（秒）
  SPAWN_INTERVAL_MIN: 10,
  SPAWN_INTERVAL_MAX: 15,
  // 地图上最多同时存在的道具数量
  MAX_MAP_ITEMS: 3,
  // 道具栏容量
  INVENTORY_SIZE: 5,
};

/**
 * 道具类型配置
 * @typedef {Object} ItemType
 * @property {string} id - 道具ID
 * @property {string} name - 道具名称
 * @property {string} icon - 道具图标（emoji或字符）
 * @property {string} description - 道具描述
 * @property {boolean} targetRequired - 是否需要玩家选择目标位置
 * @property {function} onPickup - 拾取时立即生效的效果（可选）
 * @property {function} onUse - 使用时的效果函数
 */
export const ITEM_TYPES = {
  energyPack: {
    id: "energyPack",
    name: "能量包",
    icon: "⚡",
    description: "立即获得1-3点能量",
    targetRequired: false,
    onPickup: (gameState) => {
      // 随机获得1-3点能量
      const energyGain = Math.floor(Math.random() * 3) + 1; // 1-3
      gameState.energy = Math.min(
        gameState.maxEnergy,
        gameState.energy + energyGain
      );
      return { energyGain };
    },
    onUse: null, // 拾取即使用，无需额外使用
  },
  blockItem: {
    id: "blockItem",
    name: "临时障碍",
    icon: "🛡️",
    description: "在指定位置生成临时障碍物，持续10秒，影响敌人寻路",
    targetRequired: true,
    onPickup: null,
    onUse: (gameState, targetX, targetY, gameField) => {
      // 在目标位置生成临时障碍物
      return createTemporaryBlock(gameField, targetX, targetY, 10000); // 10秒
    },
  },
  bombItem: {
    id: "bombItem",
    name: "炸弹",
    icon: "💣",
    description: "对指定位置范围内的敌人造成范围伤害",
    targetRequired: true,
    onPickup: null,
    onUse: (gameState, targetX, targetY, gameField, enemies) => {
      // 对范围内敌人造成伤害
      const radius = 120; // 爆炸范围
      const damage = 60; // 伤害值
      return triggerBomb(gameField, targetX, targetY, radius, damage, enemies);
    },
  },
  slowField: {
    id: "slowField",
    name: "减速区域",
    icon: "❄️",
    description: "在指定位置生成减速区域，持续8秒，范围内敌人移动速度降低40%",
    targetRequired: true,
    onPickup: null,
    onUse: (gameState, targetX, targetY, gameField) => {
      // 在目标位置生成减速区域
      return createSlowField(gameField, targetX, targetY, 8000, 0.6); // 8秒，速度变为60%（降低40%）
    },
  },
};

/**
 * 创建临时障碍物
 * @param {HTMLElement} gameField 战场DOM
 * @param {number} x 位置x（像素）
 * @param {number} y 位置y（像素）
 * @param {number} duration 持续时间（毫秒）
 * @returns {Object} 障碍物对象
 */
function createTemporaryBlock(gameField, x, y, duration) {
  const block = document.createElement("div");
  block.className = "temporary-block obstacle";
  block.style.position = "absolute";
  block.style.left = `${x}px`;
  block.style.top = `${y}px`;
  block.style.width = "40px";
  block.style.height = "40px";
  block.style.transform = "translate(-50%, -50%)";
  block.style.borderRadius = "6px";
  block.style.background = "linear-gradient(145deg, #424242, #212121)";
  block.style.border = "2px solid rgba(255, 200, 0, 0.4)"; // 黄色边框区分临时障碍物
  block.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5), 0 0 8px rgba(255, 200, 0, 0.3)";
  block.style.zIndex = "10";
  block.style.pointerEvents = "none";
  
  gameField.appendChild(block);
  
  // 持续时间后移除
  setTimeout(() => {
    if (block.parentElement) {
      block.parentElement.removeChild(block);
    }
  }, duration);
  
  return {
    element: block,
    x,
    y,
    width: 40,
    height: 40,
    remove: () => {
      if (block.parentElement) {
        block.parentElement.removeChild(block);
      }
    },
  };
}

/**
 * 触发炸弹爆炸
 * @param {HTMLElement} gameField 战场DOM
 * @param {number} x 爆炸中心x
 * @param {number} y 爆炸中心y
 * @param {number} radius 爆炸范围
 * @param {number} damage 伤害值
 * @param {Array} enemies 敌人数组
 * @returns {Object} 爆炸效果对象
 */
function triggerBomb(gameField, x, y, radius, damage, enemies) {
  // 创建爆炸视觉效果
  const explosion = document.createElement("div");
  explosion.className = "bomb-explosion";
  explosion.style.position = "absolute";
  explosion.style.left = `${x}px`;
  explosion.style.top = `${y}px`;
  explosion.style.width = `${radius * 2}px`;
  explosion.style.height = `${radius * 2}px`;
  explosion.style.borderRadius = "50%";
  explosion.style.transform = "translate(-50%, -50%)";
  explosion.style.background = "radial-gradient(circle, rgba(255, 100, 0, 0.8), rgba(255, 0, 0, 0.4), transparent)";
  explosion.style.boxShadow = "0 0 40px #ff6600, 0 0 20px #ff3300";
  explosion.style.zIndex = "200";
  explosion.style.pointerEvents = "none";
  explosion.style.animation = "bomb-explosion-anim 0.5s ease-out forwards";
  
  gameField.appendChild(explosion);
  
  // 对范围内敌人造成伤害
  const hitEnemies = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= radius) {
      const actualDamage = Math.max(1, Math.floor(damage * (1 - (enemy.armor || 0))));
      enemy.hp -= actualDamage;
      hitEnemies.push(enemy);
    }
  }
  
  // 移除爆炸效果
  setTimeout(() => {
    if (explosion.parentElement) {
      explosion.parentElement.removeChild(explosion);
    }
  }, 500);
  
  return { hitCount: hitEnemies.length };
}

/**
 * 创建减速区域
 * @param {HTMLElement} gameField 战场DOM
 * @param {number} x 位置x
 * @param {number} y 位置y
 * @param {number} duration 持续时间（毫秒）
 * @param {number} speedMultiplier 速度倍率（0.6表示速度变为60%）
 * @returns {Object} 减速区域对象
 */
function createSlowField(gameField, x, y, duration, speedMultiplier) {
  const radius = 100; // 减速区域半径
  
  const field = document.createElement("div");
  field.className = "slow-field";
  field.style.position = "absolute";
  field.style.left = `${x}px`;
  field.style.top = `${y}px`;
  field.style.width = `${radius * 2}px`;
  field.style.height = `${radius * 2}px`;
  field.style.borderRadius = "50%";
  field.style.transform = "translate(-50%, -50%)";
  field.style.background = "radial-gradient(circle, rgba(100, 200, 255, 0.3), rgba(50, 150, 255, 0.1), transparent)";
  field.style.border = "2px dashed rgba(100, 200, 255, 0.6)";
  field.style.zIndex = "5";
  field.style.pointerEvents = "none";
  field.style.animation = "slow-field-pulse 1s ease-in-out infinite";
  
  gameField.appendChild(field);
  
  // 存储减速区域信息，用于更新敌人速度
  const slowFieldData = {
    element: field,
    x,
    y,
    radius,
    speedMultiplier,
    startTime: performance.now(),
    duration,
    active: true,
  };
  
  // 持续时间后移除
  setTimeout(() => {
    slowFieldData.active = false;
    if (field.parentElement) {
      field.parentElement.removeChild(field);
    }
  }, duration);
  
  return slowFieldData;
}

/**
 * 道具管理器
 */
export class ItemManager {
  constructor(gameField, gameState) {
    this.gameField = gameField;
    this.gameState = gameState;
    this.mapItems = []; // 地图上的道具
    this.inventory = []; // 道具栏
    this.nextSpawnTime = 0; // 下次生成时间
    this.slowFields = []; // 活跃的减速区域
    this.usingItem = null; // 当前正在使用的道具
  }

  /**
   * 更新道具系统
   * @param {number} now 当前时间戳
   * @param {Array} enemies 敌人数组（用于减速区域效果）
   */
  update(now, enemies) {
    // 更新减速区域对敌人的影响
    this.updateSlowFields(enemies);
    
    // 清理过期的减速区域
    this.slowFields = this.slowFields.filter(field => field.active);
    
    // 检查是否需要生成新道具
    if (this.mapItems.length < ITEM_CONFIG.MAX_MAP_ITEMS) {
      if (now >= this.nextSpawnTime) {
        this.spawnItem();
        // 设置下次生成时间（随机间隔）
        const interval = (ITEM_CONFIG.SPAWN_INTERVAL_MIN + 
          Math.random() * (ITEM_CONFIG.SPAWN_INTERVAL_MAX - ITEM_CONFIG.SPAWN_INTERVAL_MIN)) * 1000;
        this.nextSpawnTime = now + interval;
      }
    }
  }

  /**
   * 在地图上生成道具
   */
  spawnItem() {
    const fieldRect = this.gameField.getBoundingClientRect();
    
    // 随机选择一个道具类型
    const itemTypeIds = Object.keys(ITEM_TYPES);
    const randomTypeId = itemTypeIds[Math.floor(Math.random() * itemTypeIds.length)];
    const itemType = ITEM_TYPES[randomTypeId];
    
    // 随机生成位置（避开边缘和中心区域）
    const margin = 60;
    const x = margin + Math.random() * (fieldRect.width - margin * 2);
    const y = margin + Math.random() * (fieldRect.height - margin * 2);
    
    // 创建道具元素
    const itemEl = document.createElement("div");
    itemEl.className = "map-item";
    itemEl.dataset.itemId = itemType.id;
    itemEl.style.position = "absolute";
    itemEl.style.left = `${x}px`;
    itemEl.style.top = `${y}px`;
    itemEl.style.transform = "translate(-50%, -50%)";
    itemEl.style.width = "32px";
    itemEl.style.height = "32px";
    itemEl.style.borderRadius = "50%";
    itemEl.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))";
    itemEl.style.border = "2px solid rgba(255, 255, 255, 0.4)";
    itemEl.style.boxShadow = "0 0 20px rgba(255, 255, 255, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.1)";
    itemEl.style.display = "flex";
    itemEl.style.alignItems = "center";
    itemEl.style.justifyContent = "center";
    itemEl.style.fontSize = "20px";
    itemEl.style.cursor = "pointer";
    itemEl.style.zIndex = "50";
    itemEl.style.animation = "item-float 2s ease-in-out infinite";
    itemEl.textContent = itemType.icon;
    itemEl.title = itemType.name;
    
    // 点击拾取
    itemEl.addEventListener("click", () => {
      this.pickupItem(itemEl, itemType);
    });
    
    this.gameField.appendChild(itemEl);
    
    this.mapItems.push({
      element: itemEl,
      type: itemType,
      x,
      y,
    });
  }

  /**
   * 拾取道具
   * @param {HTMLElement} itemEl 道具元素
   * @param {ItemType} itemType 道具类型
   */
  pickupItem(itemEl, itemType) {
    // 如果拾取即使用（如能量包）
    if (itemType.onPickup && !itemType.targetRequired) {
      const result = itemType.onPickup(this.gameState);
      const energyGain = result ? (result.energyGain || 0) : 0;
      this.showMessage(`获得${itemType.name}！+${energyGain}能量`, "success");
    } else {
      // 检查道具栏是否已满
      if (this.inventory.length >= ITEM_CONFIG.INVENTORY_SIZE) {
        this.showMessage("道具栏已满！", "warning");
        return;
      }
      // 加入道具栏
      this.inventory.push(itemType);
      this.updateInventoryUI();
      this.showMessage(`拾取${itemType.name}`, "info");
    }
    
    // 从地图上移除
    this.mapItems = this.mapItems.filter(item => item.element !== itemEl);
    if (itemEl.parentElement) {
      itemEl.parentElement.removeChild(itemEl);
    }
  }

  /**
   * 使用道具
   * @param {number} itemIndex 道具栏索引
   */
  useItem(itemIndex) {
    if (itemIndex < 0 || itemIndex >= this.inventory.length) return;
    
    const itemType = this.inventory[itemIndex];
    
    // 如果不需要目标位置，直接使用
    if (!itemType.targetRequired) {
      if (itemType.onPickup) {
        itemType.onPickup(this.gameState);
      }
      this.inventory.splice(itemIndex, 1);
      this.updateInventoryUI();
      return;
    }
    
    // 需要目标位置，进入使用模式
    this.usingItem = { itemType, itemIndex };
    this.gameField.style.cursor = "crosshair";
    this.showMessage(`点击地图使用${itemType.name}`, "info");
  }

  /**
   * 在目标位置使用道具
   * @param {number} x 目标x坐标
   * @param {number} y 目标y坐标
   * @param {Array} enemies 敌人数组
   */
  useItemAtTarget(x, y, enemies) {
    if (!this.usingItem) return;
    
    const { itemType, itemIndex } = this.usingItem;
    
    // 执行使用效果
    if (itemType.onUse) {
      const result = itemType.onUse(this.gameState, x, y, this.gameField, enemies);
      
      // 如果是减速区域，保存到列表
      if (itemType.id === "slowField" && result) {
        this.slowFields.push(result);
      }
      
      this.showMessage(`使用${itemType.name}成功！`, "success");
    }
    
    // 从道具栏移除
    this.inventory.splice(itemIndex, 1);
    this.updateInventoryUI();
    
    // 退出使用模式
    this.usingItem = null;
    this.gameField.style.cursor = "";
  }

  /**
   * 取消使用道具
   */
  cancelUsingItem() {
    this.usingItem = null;
    this.gameField.style.cursor = "";
  }

  /**
   * 更新减速区域对敌人的影响
   * @param {Array} enemies 敌人数组
   */
  updateSlowFields(enemies) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      
      // 检查是否在减速区域内
      let inSlowField = false;
      for (const field of this.slowFields) {
        if (!field.active) continue;
        
        const dx = enemy.x - field.x;
        const dy = enemy.y - field.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= field.radius) {
          inSlowField = true;
          // 应用减速效果（如果还没有应用）
          if (!enemy.slowFieldApplied) {
            enemy.originalSpeed = enemy.speed;
            enemy.slowFieldApplied = true;
          }
          enemy.speed = enemy.originalSpeed * field.speedMultiplier;
          break;
        }
      }
      
      // 如果不在减速区域内，恢复原始速度
      if (!inSlowField && enemy.slowFieldApplied) {
        enemy.speed = enemy.originalSpeed || enemy.speed;
        enemy.slowFieldApplied = false;
      }
    }
  }

  /**
   * 更新道具栏UI
   */
  updateInventoryUI() {
    const inventoryEl = document.getElementById("item-inventory");
    if (!inventoryEl) return;
    
    inventoryEl.innerHTML = "";
    
    for (let i = 0; i < ITEM_CONFIG.INVENTORY_SIZE; i++) {
      const slot = document.createElement("div");
      slot.className = "item-slot";
      slot.dataset.slotIndex = i;
      
      if (i < this.inventory.length) {
        const item = this.inventory[i];
        slot.classList.add("item-slot--filled");
        slot.textContent = item.icon;
        slot.title = `${item.name}\n${item.description}`;
        slot.addEventListener("click", () => {
          this.useItem(i);
        });
      } else {
        slot.classList.add("item-slot--empty");
      }
      
      inventoryEl.appendChild(slot);
    }
  }

  /**
   * 显示消息提示
   * @param {string} message 消息内容
   * @param {string} type 消息类型（success, warning, info）
   */
  showMessage(message, type = "info") {
    // 创建临时提示元素
    const tip = document.createElement("div");
    tip.className = `item-message item-message--${type}`;
    tip.textContent = message;
    tip.style.position = "fixed";
    tip.style.top = "50%";
    tip.style.left = "50%";
    tip.style.transform = "translate(-50%, -50%)";
    tip.style.padding = "12px 24px";
    tip.style.borderRadius = "8px";
    tip.style.background = type === "success" ? "rgba(76, 175, 80, 0.9)" :
                           type === "warning" ? "rgba(255, 152, 0, 0.9)" :
                           "rgba(33, 150, 243, 0.9)";
    tip.style.color = "#fff";
    tip.style.fontSize = "14px";
    tip.style.fontWeight = "600";
    tip.style.zIndex = "10000";
    tip.style.pointerEvents = "none";
    tip.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    
    document.body.appendChild(tip);
    
    setTimeout(() => {
      tip.style.opacity = "0";
      tip.style.transition = "opacity 0.3s";
      setTimeout(() => {
        if (tip.parentElement) {
          tip.parentElement.removeChild(tip);
        }
      }, 300);
    }, 2000);
  }

  /**
   * 清理所有道具
   */
  cleanup() {
    // 清理地图道具
    for (const item of this.mapItems) {
      if (item.element.parentElement) {
        item.element.parentElement.removeChild(item.element);
      }
    }
    this.mapItems = [];
    
    // 清理减速区域
    for (const field of this.slowFields) {
      if (field.element && field.element.parentElement) {
        field.element.parentElement.removeChild(field.element);
      }
    }
    this.slowFields = [];
    
    // 重置状态
    this.inventory = [];
    this.usingItem = null;
    this.nextSpawnTime = 0;
  }
}

