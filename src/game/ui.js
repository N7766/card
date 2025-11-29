/**
 * UI 模組：負責緩存常用 DOM 節點與更新 UI 顯示。
 * - 更新血量條 / 能量條 / 波數與歷史最高波數
 * - 渲染手牌區
 * - 顯示 / 關閉開始 / 勝利 / 失敗覆蓋層
 * - 關卡信息與敵人進度顯示
 */

import { MAX_HAND_SIZE } from "./cards.js";

/** @typedef {import("./cards.js").Card} Card */

const gameRoot = document.getElementById("game-root");
const gameField = /** @type {HTMLElement} */ (document.getElementById("game-field"));
const baseEl = /** @type {HTMLElement} */ (document.getElementById("base"));

const uiPanel = document.getElementById("ui-panel");
const hpBar = /** @type {HTMLElement} */ (document.getElementById("hp-bar"));
const hpText = /** @type {HTMLElement} */ (document.getElementById("hp-text"));
const energyBar = /** @type {HTMLElement} */ (document.getElementById("energy-bar"));
const energyText = /** @type {HTMLElement} */ (document.getElementById("energy-text"));
const waveText = /** @type {HTMLElement} */ (document.getElementById("wave-text"));
const bestRecordText = /** @type {HTMLElement} */ (
  document.getElementById("best-record-text")
);
const levelText = /** @type {HTMLElement} */ (document.getElementById("level-text"));
const enemyProgressText = /** @type {HTMLElement} */ (
  document.getElementById("enemy-progress-text")
);

const handCardsContainer = /** @type {HTMLElement} */ (
  document.getElementById("hand-cards")
);

const startScreen = /** @type {HTMLElement} */ (document.getElementById("start-screen"));
const victoryScreen = /** @type {HTMLElement} */ (
  document.getElementById("victory-screen")
);
const defeatScreen = /** @type {HTMLElement} */ (document.getElementById("defeat-screen"));

const btnStart = /** @type {HTMLButtonElement} */ (document.getElementById("btn-start"));
const btnPause = /** @type {HTMLButtonElement} */ (document.getElementById("btn-pause"));
const btnSpeed = /** @type {HTMLButtonElement} */ (document.getElementById("btn-speed"));
const btnDebug = /** @type {HTMLButtonElement} */ (document.getElementById("btn-debug"));
const btnRestartVictory = /** @type {HTMLButtonElement} */ (
  document.getElementById("btn-restart-victory")
);
const btnRestartDefeat = /** @type {HTMLButtonElement} */ (
  document.getElementById("btn-restart-defeat")
);

const victoryBestRecord = /** @type {HTMLElement} */ (
  document.getElementById("victory-best-record")
);
const defeatBestRecord = /** @type {HTMLElement} */ (
  document.getElementById("defeat-best-record")
);

const levelCompleteScreen = /** @type {HTMLElement} */ (
  document.getElementById("level-complete-screen")
);
const btnNextLevel = /** @type {HTMLButtonElement} */ (
  document.getElementById("btn-next-level")
);
const btnRetryLevel = /** @type {HTMLButtonElement} */ (
  document.getElementById("btn-retry-level")
);
const btnBackToStartDefeat = /** @type {HTMLButtonElement} */ (
  document.getElementById("btn-back-to-start-defeat")
);
const btnBackToMenu = /** @type {HTMLButtonElement} */ (
  document.getElementById("btn-back-to-menu")
);

/**
 * UI 相關 DOM 引用，供其他模組使用。
 */
export const uiElements = {
  gameRoot,
  gameField,
  baseEl,
  uiPanel,
  handCardsContainer,
  startScreen,
  victoryScreen,
  defeatScreen,
  btnStart,
  btnPause,
  btnSpeed,
  btnDebug,
  btnRestartVictory,
  btnRestartDefeat,
  victoryBestRecord,
  defeatBestRecord,
};

/**
 * 綁定控制按鈕的事件。
 * @param {{ onStart: () => void, onTogglePause: () => void, onRestart: () => void, onToggleSpeed: () => void, onToggleDebug?: () => void, onNextLevel?: () => void, onRetryLevel?: () => void, onBackToStart?: () => void, onBackToMenu?: () => void }} handlers
 */
export function bindControlButtons(handlers) {
  btnStart.addEventListener("click", () => {
    handlers.onStart();
  });

  btnPause.addEventListener("click", () => {
    handlers.onTogglePause();
  });

  btnSpeed.addEventListener("click", () => {
    handlers.onToggleSpeed();
  });

  if (btnDebug && handlers.onToggleDebug) {
    btnDebug.addEventListener("click", () => {
      handlers.onToggleDebug();
    });
  }

  btnRestartVictory.addEventListener("click", () => {
    handlers.onRestart();
  });

  btnRestartDefeat.addEventListener("click", () => {
    handlers.onRestart();
  });

  // 绑定失败界面的返回开始按钮
  if (btnBackToStartDefeat && handlers.onBackToStart) {
    btnBackToStartDefeat.addEventListener("click", () => {
      handlers.onBackToStart();
    });
  }

  // 绑定游戏中的返回主菜单按钮
  if (btnBackToMenu && handlers.onBackToMenu) {
    btnBackToMenu.addEventListener("click", () => {
      handlers.onBackToMenu();
    });
  }

  if (btnNextLevel && handlers.onNextLevel) {
    btnNextLevel.addEventListener("click", () => {
      handlers.onNextLevel();
    });
  }

  if (btnRetryLevel && handlers.onRetryLevel) {
    btnRetryLevel.addEventListener("click", () => {
      handlers.onRetryLevel();
    });
  }
}

/**
 * 更新基地生命顯示。
 * @param {number} hp
 * @param {number} maxHp
 */
export function updateHp(hp, maxHp) {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  hpBar.style.transform = `scaleX(${ratio})`;
  hpText.textContent = `${Math.max(0, Math.floor(hp))} / ${maxHp}`;
}

/**
 * 更新能量顯示。
 * @param {number} energy
 * @param {number} maxEnergy
 */
export function updateEnergy(energy, maxEnergy) {
  const ratio = maxEnergy > 0 ? Math.max(0, Math.min(1, energy / maxEnergy)) : 0;
  energyBar.style.transform = `scaleX(${ratio})`;
  energyText.textContent = `${Math.floor(energy)} / ${maxEnergy}`;
  
  // 确保能量图标存在（在能量文本之前）
  const statItem = energyText.parentElement;
  if (statItem) {
    let energyIcon = energyText.previousElementSibling;
    if (!energyIcon || !energyIcon.classList || !energyIcon.classList.contains("energy-icon")) {
      energyIcon = document.createElement("span");
      energyIcon.className = "energy-icon";
      energyIcon.textContent = "⚡";
      statItem.insertBefore(energyIcon, energyText);
    }
  }
}

/**
 * 更新波數文字。
 * @param {number} waveIndex 當前波索引（從 0 開始）
 * @param {number} totalWaves 總波數
 */
export function updateWave(waveIndex, totalWaves) {
  waveText.textContent = `${Math.min(waveIndex + 1, totalWaves)} / ${totalWaves}`;
}

/**
 * 更新歷史最高波數顯示。
 * @param {number} bestWave
 */
export function updateBestRecord(bestWave) {
  bestRecordText.textContent = bestWave > 0 ? String(bestWave) : "-";
}

/**
 * 渲染手牌。
 * @param {Card[]} handCards
 * @param {(card: Card) => void} onCardClick
 * @param {Card | null} selectedCard
 * @param {number} currentEnergy 当前能量值，用于判断卡牌是否可用
 */
export function renderHandCards(handCards, onCardClick, selectedCard, currentEnergy = 0) {
  handCardsContainer.innerHTML = "";

  for (let i = 0; i < MAX_HAND_SIZE; i++) {
    const card = handCards[i];
    if (!card) {
      // 空槽
      const slot = document.createElement("div");
      slot.className = "card card-empty";
      slot.style.opacity = "0.12";
      handCardsContainer.appendChild(slot);
      continue;
    }

    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;
    // 基礎卡牌信息先存入 dataset，供能量狀態與 tooltip 組合使用
    el.dataset.cardName = card.name;
    el.dataset.cardType = card.type;
    el.dataset.cardCost = String(card.cost);
    el.dataset.cardDesc = card.description;

    // 判断是否为选中状态
    if (selectedCard && selectedCard.id === card.id) {
      el.classList.add("card--selected");
    }
    
    // 判断是否能量不足（禁用状态）
    const affordable = currentEnergy >= card.cost;
    if (!affordable) {
      el.classList.add("card--disabled");
    }

    // 顶部：名称
    const header = document.createElement("div");
    header.className = "card-header";

    const nameSpan = document.createElement("span");
    nameSpan.className = "card-name";
    nameSpan.textContent = card.name;

    // 布局卡显示BUFF badge
    if (card.type === "layout") {
      const badge = document.createElement("span");
      badge.className = "card-badge-buff";
      badge.textContent = "BUFF";
      header.appendChild(badge);
    }

    header.appendChild(nameSpan);

    // 第二行：费用图标
    const costDiv = document.createElement("div");
    costDiv.className = "card-cost";
    const costIcon = document.createElement("span");
    costIcon.className = "cost-icon";
    costIcon.textContent = "★";
    const costValue = document.createElement("span");
    costValue.className = "cost-value";
    costValue.textContent = String(card.cost);
    costDiv.appendChild(costIcon);
    costDiv.appendChild(costValue);

    // 中部：数值摘要（仅塔卡）
    let statsDiv = null;
    if (card.type === "tower" && card.stats) {
      statsDiv = document.createElement("div");
      statsDiv.className = "card-stats";
      const stats = card.stats;
      const statsText = `ATK ${stats.attack} | RNG ${stats.range} | SPD ${stats.speed}`;
      statsDiv.textContent = statsText;
    }

    // 底部：标签区域
    const tagDiv = document.createElement("div");
    tagDiv.className = "card-tags";
    if (card.type === "tower" && card.stats && card.stats.typeTag) {
      tagDiv.textContent = card.stats.typeTag;
    } else if (card.type === "layout" && card.stats && card.stats.effectTag) {
      tagDiv.textContent = card.stats.effectTag;
    } else if (card.type === "style" && card.stats && card.stats.effectTag) {
      tagDiv.textContent = card.stats.effectTag;
    }

    el.appendChild(header);
    el.appendChild(costDiv);
    if (statsDiv) {
      el.appendChild(statsDiv);
    }
    el.appendChild(tagDiv);

    // 设置tooltip（详细描述）
    el.dataset.tooltip = card.description;

    // 点击事件：能量不足时显示提示，否则正常处理
    const cardAffordable = affordable; // 保存到闭包中
    el.addEventListener("click", () => {
      if (!cardAffordable) {
        // 能量不足时显示提示
        showEnergyInsufficientTip();
        flashCardInsufficient(card.id);
        return;
      }
      onCardClick(card);
    });

    handCardsContainer.appendChild(el);
  }
}

/**
 * 根據當前能量更新手牌的可用/禁用狀態與 tooltip。
 * - 僅在此處處理視覺與提示，具體能否出牌仍由 game 邏輯檢查。
 * @param {number} currentEnergy
 */
export function updateHandEnergyState(currentEnergy) {
  const cardEls = /** @type NodeListOf<HTMLElement> */ (
    handCardsContainer.querySelectorAll(".card:not(.card-empty)")
  );

  cardEls.forEach((el) => {
    const id = el.dataset.cardId;
    const cost = Number(el.dataset.cardCost || "0");
    const desc = el.dataset.cardDesc || "";

    if (!id || !Number.isFinite(cost)) return;

    const affordable = currentEnergy >= cost;
    // 使用统一的类名
    el.classList.toggle("card--disabled", !affordable);
    el.classList.remove("card-disabled"); // 移除旧类名（兼容）

    // 更新费用显示状态
    const costDiv = el.querySelector(".card-cost");
    if (costDiv) {
      costDiv.classList.toggle("cost-insufficient", !affordable);
    }

    // tooltip 保持详细描述，能量不足时追加提示
    const tip = affordable ? desc : `${desc}\n—— 能量不足，無法使用`;
    el.dataset.tooltip = tip;
    el.title = affordable ? "" : "能量不足";
  });
}

/**
 * 給卡牌元素添加短暫的"能量不足"動畫。
 * @param {string} cardId
 */
export function flashCardInsufficient(cardId) {
  const el = /** @type {HTMLElement | null} */ (
    handCardsContainer.querySelector(`[data-card-id="${cardId}"]`)
  );
  if (!el) return;
  el.classList.remove("card-insufficient");
  // 強制重繪以重新觸發動畫
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  // @ts-ignore
  void el.offsetWidth;
  el.classList.add("card-insufficient");
}

/**
 * 顯示能量不足提示條。
 */
function showEnergyInsufficientTip() {
  let tipEl = document.getElementById("energy-insufficient-tip");
  
  if (!tipEl && uiPanel) {
    tipEl = document.createElement("div");
    tipEl.id = "energy-insufficient-tip";
    tipEl.className = "energy-insufficient-tip";
    tipEl.textContent = "能量不足";
    uiPanel.insertBefore(tipEl, uiPanel.firstChild);
  }
  
  if (!tipEl) return;
  
  // 显示提示
  tipEl.classList.remove("energy-insufficient-tip--visible");
  // 强制重绘
  // @ts-ignore
  void tipEl.offsetWidth;
  tipEl.classList.add("energy-insufficient-tip--visible");
  
  // 1秒后隐藏
  setTimeout(() => {
    if (tipEl) {
      tipEl.classList.remove("energy-insufficient-tip--visible");
    }
  }, 1000);
}

/**
 * 顯示開始界面。
 */
export function showStartScreen() {
  startScreen.classList.remove("hidden");
}

/**
 * 關閉開始界面。
 */
export function hideStartScreen() {
  startScreen.classList.add("hidden");
}

/**
 * 顯示勝利界面。
 * @param {number} bestWave
 */
export function showVictory(bestWave) {
  victoryScreen.classList.remove("hidden");
  victoryBestRecord.textContent = `歷史最高波數：${bestWave}`;
}

/**
 * 顯示失敗界面。
 * @param {number} bestWave
 */
export function showDefeat(bestWave) {
  defeatScreen.classList.remove("hidden");
  defeatBestRecord.textContent = `歷史最高波數：${bestWave}`;
}

/**
 * 隱藏勝利/失敗界面。
 */
export function hideResultOverlays() {
  victoryScreen.classList.add("hidden");
  defeatScreen.classList.add("hidden");
}

/**
 * 更新暫停按鈕文字。
 * @param {boolean} paused
 */
export function updatePauseButton(paused) {
  btnPause.textContent = paused ? "繼續" : "暫停";
}

/**
 * 更新速度按鈕文字與狀態。
 * @param {number} multiplier
 */
export function updateSpeedButton(multiplier) {
  const label = multiplier >= 2 ? "2x" : "1x";
  btnSpeed.textContent = label;
  btnSpeed.dataset.speed = String(multiplier);
}

/**
 * 更新调试按钮显示状态。
 * @param {boolean} isDebugMode
 */
export function updateDebugButton(isDebugMode) {
  if (btnDebug) {
    if (isDebugMode) {
      btnDebug.classList.add("debug-active");
      btnDebug.textContent = "调试 ✓";
    } else {
      btnDebug.classList.remove("debug-active");
      btnDebug.textContent = "调试";
    }
  }
}

let waveToastEl =
  /** @type {HTMLElement | null} */ (document.getElementById("wave-toast"));
/** @type {number | null} */
let waveToastTimer = null;

function ensureWaveToastEl() {
  if (!gameRoot) return;
  if (!waveToastEl) {
    waveToastEl = document.createElement("div");
    waveToastEl.id = "wave-toast";
    waveToastEl.className = "wave-toast";
    gameRoot.appendChild(waveToastEl);
  }
}

/**
 * 在戰場上方顯示一條波次/狀態提示。
 * @param {string} text
 * @param {"start"|"clear"|"info"} [type]
 */
export function showWaveToast(text, type = "info") {
  ensureWaveToastEl();
  if (!waveToastEl) return;

  waveToastEl.textContent = text;
  waveToastEl.dataset.type = type;

  waveToastEl.classList.remove("visible");
  // 強制重繪以重新觸發過渡
  // @ts-ignore
  void waveToastEl.offsetWidth;
  waveToastEl.classList.add("visible");

  if (waveToastTimer != null) {
    window.clearTimeout(waveToastTimer);
  }
  waveToastTimer = window.setTimeout(() => {
    if (waveToastEl) {
      waveToastEl.classList.remove("visible");
    }
  }, 1800);
}

/**
 * 更新 BASE 位置（根據關卡配置的相對座標）。
 * @param {{ x: number, y: number }} position 相對座標（0~1），x 為水平位置，y 為從頂部開始的垂直位置
 */
export function updateBasePosition(position) {
  if (!baseEl || !gameField) return;
  
  // 使用 requestAnimationFrame 確保 DOM 已渲染後再計算位置
  requestAnimationFrame(() => {
    const fieldRect = gameField.getBoundingClientRect();
    
    // 計算絕對像素位置
    const x = position.x * fieldRect.width;
    const y = position.y * fieldRect.height;
    
    // BASE 使用 left/top 定位，並用 transform 居中
    // 使用 !important 確保覆蓋 CSS 中的固定定位
    baseEl.style.setProperty('left', `${x}px`, 'important');
    baseEl.style.setProperty('top', `${y}px`, 'important');
    baseEl.style.setProperty('bottom', 'auto', 'important');
    baseEl.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
  });
}

/**
 * 更新戰局進度顯示（整合關卡、波次、敵人信息）。
 * @param {number} levelIndex 當前關卡索引（0 開始）
 * @param {string} levelName 關卡名稱
 * @param {number} waveIndex 當前波索引（0 開始）
 * @param {number} totalWaves 總波數
 * @param {number} enemiesKilled 已擊殺敵人數
 * @param {number} totalEnemies 總敵人數
 */
export function updateBattleProgress(levelIndex, levelName, waveIndex, totalWaves, enemiesKilled, totalEnemies) {
  if (!levelText || !waveText || !enemyProgressText) return;
  
  // 更新关卡名
  levelText.textContent = `Level ${levelIndex + 1} · ${levelName}`;
  
  // 更新波次
  waveText.textContent = `${waveIndex + 1} / ${totalWaves}`;
  
  // 更新敌人进度
  enemyProgressText.textContent = `${enemiesKilled} / ${totalEnemies}`;
}

/**
 * 更新關卡信息顯示（保留兼容性，内部调用updateBattleProgress）。
 * @param {number} currentIndex 當前關卡索引（0 開始）
 * @param {number} totalLevels 總關卡數
 * @param {string} levelName 關卡名稱
 */
export function updateLevelInfo(currentIndex, totalLevels, levelName) {
  // 保持兼容性，如果有wave和enemy信息则一起更新
  if (waveText && enemyProgressText) {
    // 只更新关卡名部分，其他信息保持原样
    if (levelText) {
      levelText.textContent = `Level ${currentIndex + 1} · ${levelName}`;
    }
  } else {
    // 旧版本兼容
    if (levelText) {
      levelText.textContent = `${currentIndex + 1} / ${totalLevels} · ${levelName}`;
    }
  }
}

/**
 * 更新敵人進度顯示（已擊殺 / 總數）（保留兼容性）。
 * @param {number} killed 已擊殺敵人數
 * @param {number} total 總敵人數
 */
export function updateEnemyProgress(killed, total) {
  if (!enemyProgressText) return;
  enemyProgressText.textContent = `${killed} / ${total}`;
}

/**
 * 顯示關卡完成界面。
 * @param {string} levelName 關卡名稱
 * @param {number} killed 擊殺數
 * @param {number} total 總數
 */
export function showLevelComplete(levelName, killed, total) {
  if (!levelCompleteScreen) return;
  levelCompleteScreen.classList.remove("hidden");
  
  const levelCompleteTitle = document.getElementById("level-complete-title");
  const levelCompleteStats = document.getElementById("level-complete-stats");
  if (levelCompleteTitle) {
    levelCompleteTitle.textContent = `${levelName} 完成！`;
  }
  if (levelCompleteStats) {
    levelCompleteStats.textContent = `擊殺敵人：${killed} / ${total}`;
  }
}

/**
 * 隱藏關卡完成界面。
 */
export function hideLevelComplete() {
  if (!levelCompleteScreen) return;
  levelCompleteScreen.classList.add("hidden");
}

/**
 * 显示关卡开始介绍气泡。
 * @param {string} levelName 关卡名称
 * @param {number} prepTimeSeconds 布置时间（秒）
 * @param {string} description 关卡描述
 * @param {() => void} onClose 关闭气泡的回调
 * @param {Object} levelInfo 关卡额外信息
 * @param {number} levelInfo.difficulty 难度星级 1~3
 * @param {string[]} levelInfo.enemyTypes 敌人类型数组
 * @param {string} levelInfo.recommended 推荐玩法提示
 */
export function showLevelIntroBubble(levelName, prepTimeSeconds, description, onClose, levelInfo = {}) {
  const bubble = document.getElementById("level-intro-bubble");
  const titleEl = document.getElementById("bubble-level-title");
  const prepTimeEl = document.getElementById("bubble-prep-time");
  const descEl = document.getElementById("bubble-description");
  const closeBtn = document.getElementById("btn-close-bubble");
  const difficultyEl = document.getElementById("bubble-difficulty-stars");
  const enemyTypesEl = document.getElementById("bubble-enemy-types-list");
  const recommendedEl = document.getElementById("bubble-recommended");
  
  if (!bubble || !titleEl || !prepTimeEl || !descEl || !closeBtn) return;
  
  // 设置标题
  titleEl.textContent = levelName;
  
  // 设置难度星级
  if (difficultyEl) {
    const difficulty = levelInfo.difficulty || 1;
    const stars = "★".repeat(difficulty) + "☆".repeat(3 - difficulty);
    difficultyEl.textContent = stars;
  }
  
  // 设置敌人类型
  if (enemyTypesEl) {
    const enemyTypes = levelInfo.enemyTypes || [];
    const typeNames = {
      "ad": "AD",
      "banner": "BANNER",
      "script": "SCRIPT",
    };
    const typeLabels = enemyTypes.map(type => {
      const name = typeNames[type.toLowerCase()] || type;
      const colorClass = type.toLowerCase() === "ad" ? "enemy-type-ad" :
                        type.toLowerCase() === "banner" ? "enemy-type-banner" :
                        type.toLowerCase() === "script" ? "enemy-type-script" : "";
      return `<span class="enemy-type-badge ${colorClass}">${name}</span>`;
    }).join(" · ");
    enemyTypesEl.innerHTML = typeLabels || "未知";
  }
  
  // 设置描述
  descEl.textContent = description;
  
  // 设置推荐玩法
  if (recommendedEl) {
    recommendedEl.textContent = levelInfo.recommended || "";
  }
  
  // 清除之前的关闭类和倒计时
  bubble.classList.remove("hidden", "bubble--closing");
  
  // 倒计时相关变量
  let countdown = prepTimeSeconds;
  let countdownInterval = null;
  let autoCloseTimer = null;
  
  // 更新倒计时显示
  const updateCountdown = () => {
    if (prepTimeEl) {
      prepTimeEl.textContent = `${countdown}s`;
    }
    
    // 倒计时归零时自动开始战斗
    if (countdown <= 0) {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      closeBtn.textContent = "战斗进行中...";
      closeBtn.disabled = true;
      closeBtn.classList.add("btn-disabled");
      
      // 延迟一小段时间后自动关闭
      setTimeout(() => {
        handleClose();
      }, 300);
    }
  };
  
  // 开始倒计时
  updateCountdown();
  countdownInterval = setInterval(() => {
    countdown--;
    updateCountdown();
  }, 1000);
  
  // 绑定关闭按钮
  const handleClose = () => {
    // 清理定时器
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    
    // 添加关闭动画
    bubble.classList.add("bubble--closing");
    
    // 动画结束后隐藏
    setTimeout(() => {
      bubble.classList.add("hidden");
      bubble.classList.remove("bubble--closing");
      if (onClose) onClose();
    }, 300);
    
    closeBtn.removeEventListener("click", handleClose);
  };
  
  closeBtn.addEventListener("click", handleClose);
  
  // 备份自动关闭（如果倒计时没触发关闭）
  autoCloseTimer = setTimeout(() => {
    if (!bubble.classList.contains("hidden")) {
      handleClose();
    }
  }, prepTimeSeconds * 1000 + 2000); // 布置时间 + 2秒缓冲
}

/**
 * 更新已激活的布局卡buff显示。
 * @param {Array<{name: string, effect: string}>} activeBuffs 已激活的buff列表
 */
export function updateActiveBuffs(activeBuffs) {
  const container = document.getElementById("active-buffs-container");
  const textEl = document.getElementById("active-buffs-text");
  
  if (!container || !textEl) return;
  
  if (activeBuffs.length === 0) {
    container.style.display = "none";
    return;
  }
  
  container.style.display = "flex";
  const buffTexts = activeBuffs.map(buff => `${buff.name}（${buff.effect}）`);
  textEl.textContent = buffTexts.join(" / ");
}

/** 路径预览DOM元素容器 */
let pathPreviewContainer = null;

/**
 * 显示路径预览（只在布置阶段）。
 * @param {typeof LEVELS[0]} level 关卡配置对象
 */
export function showPathPreview(level) {
  if (!gameField || !level.previewPaths || level.previewPaths.length === 0) return;
  
  // 清除之前的预览
  hidePathPreview();
  
  // 创建路径预览容器
  pathPreviewContainer = document.createElement("div");
  pathPreviewContainer.className = "path-preview-container";
  gameField.appendChild(pathPreviewContainer);
  
  // 等待DOM渲染后计算位置
  requestAnimationFrame(() => {
    if (!pathPreviewContainer || !gameField) return;
    
    const fieldRect = gameField.getBoundingClientRect();
    
    // 为每条路径创建预览线
    level.previewPaths.forEach((path, pathIndex) => {
      if (!path || path.length < 2) return;
      
      // 创建路径线容器
      const pathLine = document.createElement("div");
      pathLine.className = "path-preview-line";
      
      // 计算路径点
      const points = path.map(p => ({
        x: p.x * fieldRect.width,
        y: p.y * fieldRect.height,
      }));
      
      // 创建线段连接点
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        const segment = document.createElement("div");
        segment.className = "path-preview-segment";
        segment.style.left = `${p1.x}px`;
        segment.style.top = `${p1.y}px`;
        segment.style.width = `${length}px`;
        segment.style.transform = `rotate(${angle}deg)`;
        segment.style.transformOrigin = "0 50%";
        
        pathLine.appendChild(segment);
      }
      
      pathPreviewContainer.appendChild(pathLine);
    });
    
    // 添加淡入动画
    requestAnimationFrame(() => {
      if (pathPreviewContainer) {
        pathPreviewContainer.classList.add("path-preview-container--visible");
      }
    });
  });
}

/**
 * 隐藏路径预览。
 */
export function hidePathPreview() {
  if (pathPreviewContainer) {
    pathPreviewContainer.classList.add("path-preview-container--fading");
    setTimeout(() => {
      if (pathPreviewContainer && pathPreviewContainer.parentElement) {
        pathPreviewContainer.parentElement.removeChild(pathPreviewContainer);
      }
      pathPreviewContainer = null;
    }, 400);
  }
}

/**
 * 高亮障碍物（布置阶段）。
 */
export function highlightObstacles() {
  if (!gameField) return;
  const obstacles = gameField.querySelectorAll(".obstacle");
  obstacles.forEach(obs => {
    obs.classList.add("obstacle--highlight");
  });
}

/**
 * 取消障碍物高亮（战斗开始后）。
 */
export function unhighlightObstacles() {
  if (!gameField) return;
  const obstacles = gameField.querySelectorAll(".obstacle");
  obstacles.forEach(obs => {
    obs.classList.remove("obstacle--highlight");
  });
}
