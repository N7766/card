/**
 * 子弹模块：负责创建、更新和渲染子弹
 * 支持3种不同风格的子弹：快速直线型、爆炸型、重型能量球
 */

/** @typedef {import("./enemy.js").Enemy} Enemy */

/**
 * @typedef {Object} Bullet
 * @property {string} id
 * @property {HTMLElement} el
 * @property {number} x 当前位置x（像素）
 * @property {number} y 当前位置y（像素）
 * @property {number} targetX 目标位置x（像素）
 * @property {number} targetY 目标位置y（像素）
 * @property {number} speed 子弹速度（像素/秒）
 * @property {number} damage 伤害值
 * @property {string} style 子弹样式类型
 * @property {Enemy | null} target 目标敌人（如果存在）
 * @property {boolean} alive 是否存活
 * @property {number} [aoeRadius] 范围伤害半径（仅爆炸型子弹）
 * @property {number} [aoeDamage] 范围伤害值（仅爆炸型子弹）
 * @property {number} startX 起始位置x
 * @property {number} startY 起始位置y
 * @property {number} distance 总距离
 * @property {number} traveled 已飞行距离
 */

let bulletIdCounter = 1;

/**
 * 创建子弹元素
 * @param {HTMLElement} gameField 战场DOM
 * @param {string} style 子弹样式类型
 * @param {number} x 起始x坐标
 * @param {number} y 起始y坐标
 * @returns {HTMLElement}
 */
function createBulletElement(gameField, style, x, y) {
  const el = document.createElement("div");
  el.className = `bullet bullet-${style}`;
  
  // 根据样式设置不同的视觉效果
  if (style === "fast") {
    // Tower1: 细长直线型子弹，颜色偏亮
    el.style.width = "4px";
    el.style.height = "20px";
    el.style.background = "linear-gradient(to bottom, #00ffff, #0088ff)";
    el.style.boxShadow = "0 0 8px #00ffff, 0 0 4px #0088ff";
    el.style.borderRadius = "2px";
  } else if (style === "explosive") {
    // Tower2: 圆形爆炸波纹，带有渐变
    el.style.width = "16px";
    el.style.height = "16px";
    el.style.background = "radial-gradient(circle, #ff6600, #ff3300)";
    el.style.boxShadow = "0 0 12px #ff6600, 0 0 6px #ff3300";
    el.style.borderRadius = "50%";
  } else if (style === "heavy") {
    // Tower3: 粗能量球/激光束
    el.style.width = "24px";
    el.style.height = "24px";
    el.style.background = "radial-gradient(circle, #ff00ff, #9900ff)";
    el.style.boxShadow = "0 0 20px #ff00ff, 0 0 10px #9900ff, inset 0 0 10px rgba(255, 0, 255, 0.5)";
    el.style.borderRadius = "50%";
  }
  
  el.style.position = "absolute";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.transform = "translate(-50%, -50%)";
  el.style.pointerEvents = "none";
  el.style.zIndex = "100";
  
  gameField.appendChild(el);
  return el;
}

/**
 * 创建子弹
 * @param {HTMLElement} gameField 战场DOM
 * @param {number} startX 起始x坐标
 * @param {number} startY 起始y坐标
 * @param {number} targetX 目标x坐标
 * @param {number} targetY 目标y坐标
 * @param {number} speed 子弹速度（像素/秒）
 * @param {number} damage 伤害值
 * @param {string} style 子弹样式类型
 * @param {Enemy | null} target 目标敌人
 * @param {number} [aoeRadius] 范围伤害半径
 * @param {number} [aoeDamage] 范围伤害值
 * @returns {Bullet}
 */
export function createBullet(
  gameField,
  startX,
  startY,
  targetX,
  targetY,
  speed,
  damage,
  style,
  target = null,
  aoeRadius = 0,
  aoeDamage = 0
) {
  const id = `bullet-${bulletIdCounter++}`;
  const el = createBulletElement(gameField, style, startX, startY);
  
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  /** @type {Bullet} */
  const bullet = {
    id,
    el,
    x: startX,
    y: startY,
    targetX,
    targetY,
    speed,
    damage,
    style,
    target,
    alive: true,
    aoeRadius,
    aoeDamage,
    startX,
    startY,
    distance,
    traveled: 0,
  };
  
  // 设置子弹旋转角度（指向目标）
  if (distance > 0) {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
  }
  
  return bullet;
}

/**
 * 更新子弹位置
 * @param {Bullet} bullet 子弹对象
 * @param {number} dtSeconds 时间差（秒）
 * @returns {boolean} 是否已到达目标或超出范围
 */
export function updateBullet(bullet, dtSeconds) {
  if (!bullet.alive) return true;
  
  const dx = bullet.targetX - bullet.startX;
  const dy = bullet.targetY - bullet.startY;
  const distance = bullet.distance;
  
  if (distance <= 0) {
    bullet.alive = false;
    return true;
  }
  
  // 计算移动步长
  const step = bullet.speed * dtSeconds;
  bullet.traveled += step;
  
  // 如果已到达目标或超出范围
  if (bullet.traveled >= distance) {
    bullet.x = bullet.targetX;
    bullet.y = bullet.targetY;
    bullet.alive = false;
    return true;
  }
  
  // 更新位置
  const ratio = bullet.traveled / distance;
  bullet.x = bullet.startX + dx * ratio;
  bullet.y = bullet.startY + dy * ratio;
  
  // 更新DOM位置
  bullet.el.style.left = `${bullet.x}px`;
  bullet.el.style.top = `${bullet.y}px`;
  
  return false;
}

/**
 * 检查子弹是否命中目标
 * @param {Bullet} bullet 子弹对象
 * @param {Enemy} enemy 敌人对象
 * @returns {boolean} 是否命中
 */
export function checkBulletHit(bullet, enemy) {
  if (!bullet.alive || !enemy.alive) return false;
  
  const dx = bullet.x - enemy.x;
  const dy = bullet.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // 命中判定：距离小于敌人半径（假设敌人半径为20像素）
  const hitRadius = 20;
  return dist <= hitRadius;
}

/**
 * 播放子弹命中效果
 * @param {HTMLElement} gameField 战场DOM
 * @param {Bullet} bullet 子弹对象
 * @param {number} x 命中位置x
 * @param {number} y 命中位置y
 */
export function playBulletHitEffect(gameField, bullet, x, y) {
  if (bullet.style === "explosive") {
    // 爆炸型子弹：显示范围圈和爆炸效果
    const explosion = document.createElement("div");
    explosion.className = "bullet-explosion";
    explosion.style.position = "absolute";
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    explosion.style.width = `${bullet.aoeRadius * 2}px`;
    explosion.style.height = `${bullet.aoeRadius * 2}px`;
    explosion.style.borderRadius = "50%";
    explosion.style.border = "2px solid #ff6600";
    explosion.style.background = "radial-gradient(circle, rgba(255, 102, 0, 0.3), transparent)";
    explosion.style.transform = "translate(-50%, -50%)";
    explosion.style.pointerEvents = "none";
    explosion.style.zIndex = "99";
    explosion.style.animation = "explosion-fade 0.4s ease-out forwards";
    gameField.appendChild(explosion);
    
    setTimeout(() => {
      if (explosion.parentElement) {
        explosion.parentElement.removeChild(explosion);
      }
    }, 400);
  } else if (bullet.style === "heavy") {
    // 重型子弹：显示高伤害反馈
    const hitEffect = document.createElement("div");
    hitEffect.className = "bullet-hit-heavy";
    hitEffect.style.position = "absolute";
    hitEffect.style.left = `${x}px`;
    hitEffect.style.top = `${y}px`;
    hitEffect.style.width = "40px";
    hitEffect.style.height = "40px";
    hitEffect.style.borderRadius = "50%";
    hitEffect.style.background = "radial-gradient(circle, rgba(255, 0, 255, 0.6), transparent)";
    hitEffect.style.boxShadow = "0 0 30px #ff00ff, 0 0 15px #9900ff";
    hitEffect.style.transform = "translate(-50%, -50%)";
    hitEffect.style.pointerEvents = "none";
    hitEffect.style.zIndex = "99";
    hitEffect.style.animation = "hit-heavy-fade 0.5s ease-out forwards";
    gameField.appendChild(hitEffect);
    
    setTimeout(() => {
      if (hitEffect.parentElement) {
        hitEffect.parentElement.removeChild(hitEffect);
      }
    }, 500);
  }
  
  // 移除子弹元素
  if (bullet.el.parentElement) {
    bullet.el.parentElement.removeChild(bullet.el);
  }
}

/**
 * 清理死亡的子弹
 * @param {Bullet[]} bullets 子弹数组
 */
export function cleanupBullets(bullets) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet.alive) {
      if (bullet.el.parentElement) {
        bullet.el.parentElement.removeChild(bullet.el);
      }
      bullets.splice(i, 1);
    }
  }
}

