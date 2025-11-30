/**
 * DOM 塔防卡 - 入口脚本
 * 直接在浏览器打开 index.html 即可运行，无需后端与构建工具。
 *
 * 目标：
 * - 保证「直接用浏览器打开 index.html」不会报错。
 * - 至少实现：点击「开始游戏」隐藏开始遮罩，并在控制台输出一条日志。
 * - 在条件允许的情况下，继续初始化完整的游戏逻辑。
 */

import { initGame } from "./game/game.js";
import { LEVELS } from "./game/config.js";

/**
 * 最小初始化逻辑：
 * - 只负责为 #btn-start 和 #btn-pause 绑定最基础的行为；
 * - 不依赖其它模块，保证在完整游戏初始化失败时也能正常工作。
 */
function setupMinimalDomBindings() {
  const startScreen = document.getElementById("start-screen");
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");

  // 开始按钮：隐藏开始界面遮罩
  if (btnStart && startScreen) {
    btnStart.addEventListener("click", () => {
      if (!startScreen.classList.contains("hidden")) {
        startScreen.classList.add("hidden");
      }
      console.log(
        "[DOM 塔防卡] 开始游戏按钮已点击，开始界面已隐藏（入口脚本最小逻辑已生效）。"
      );
    });
  }

  // 暂停按钮：仅切换按钮文字与内部状态标记
  if (btnPause) {
    btnPause.addEventListener("click", () => {
      const isPaused = btnPause.dataset.state === "paused";
      const nextState = isPaused ? "running" : "paused";
      btnPause.dataset.state = nextState;
      btnPause.textContent = nextState === "paused" ? "继续" : "暂停";
      console.log(
        `[DOM 塔防卡] 暂停按钮点击，当前状态：${
          nextState === "paused" ? "已暂停（占位逻辑）" : "继续运行（占位逻辑）"
        }。`
      );
    });
  }
}

function setupStartHelpToggle() {
  const helpBtn = document.getElementById("btn-toggle-help");
  const helpPanel = document.getElementById("start-help-panel");
  if (!helpBtn || !helpPanel) return;

  helpBtn.addEventListener("click", () => {
    const hidden = helpPanel.classList.toggle("hidden");
    helpBtn.textContent = hidden ? "操作说明" : "收起说明";
  });
}

function setupCardSidebarToggle() {
  const sidebar = document.getElementById("card-sidebar");
  const toggleBtn = document.getElementById("card-sidebar-toggle");
  if (!sidebar || !toggleBtn) return;

  let userOverride = false;

  const updateUi = () => {
    const collapsed = sidebar.classList.contains("card-sidebar--collapsed");
    sidebar.setAttribute("aria-expanded", String(!collapsed));
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleBtn.textContent = collapsed ? "展开" : "收起";
  };

  const applyResponsiveState = () => {
    if (userOverride) {
      updateUi();
      return;
    }
    if (window.innerWidth < 1200) {
      sidebar.classList.add("card-sidebar--collapsed");
    } else {
      sidebar.classList.remove("card-sidebar--collapsed");
    }
    updateUi();
  };

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("card-sidebar--collapsed");
    userOverride = true;
    updateUi();
  });

  window.addEventListener("resize", applyResponsiveState);
  applyResponsiveState();
}

/**
 * 渲染關卡選擇按鈕。
 */
function renderLevelSelect() {
  const levelSelect = document.getElementById("level-select");
  if (!levelSelect) return;

  levelSelect.innerHTML = '<p class="level-select__label">選擇關卡：</p>';

  LEVELS.forEach((level, index) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.dataset.levelIndex = String(index);
    btn.textContent = level.name;
    if (index === 0) {
      btn.classList.add("selected");
    }
    btn.addEventListener("click", () => {
      // 移除所有選中狀態
      levelSelect.querySelectorAll(".level-btn").forEach((b) => {
        b.classList.remove("selected");
      });
      // 選中當前按鈕
      btn.classList.add("selected");
    });
    levelSelect.appendChild(btn);
  });
}

// 等待 DOM 加载完成后再做初始化，避免访问到不存在的节点
window.addEventListener("DOMContentLoaded", () => {
  // 渲染關卡選擇按鈕
  renderLevelSelect();
  setupStartHelpToggle();
  setupCardSidebarToggle();

  // 先尝试完整游戏初始化，增加更完善的错误捕获
  try {
    initGame();
    console.log("[DOM 塔防卡] 完整游戏逻辑初始化成功。");
  } catch (error) {
    console.error(
      "[DOM 塔防卡] initGame 初始化失败，将退回到最小 DOM 绑定逻辑：",
      error
    );
    
    // 显示错误信息到页面
    const errorEl = document.getElementById("game-error");
    if (errorEl) {
      errorEl.textContent = `游戏初始化失败：${error.message || error}。请打开控制台查看详细错误日志。`;
      errorEl.style.display = "block";
    }
    
    // 当完整逻辑失败时，至少保证按钮可以工作，不让页面"死掉"
    setupMinimalDomBindings();
    return;
  }

  // 如果完整初始化成功，这里再补充一次最小绑定并不会影响现有逻辑：
  // - #btn-start 原本就会在点击时开始游戏并隐藏遮罩；
  // - 这里的逻辑只是在第一次点击时确保遮罩已隐藏，并打印一条额外日志。
  // 若你希望绝对避免重复绑定，可以删掉这一行，保留上面的 try/catch 即可。
  setupMinimalDomBindings();
});

