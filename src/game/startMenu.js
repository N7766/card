import {
  MODE_TYPES,
  getCampaignLevelIndex,
  getCurrentMode,
  setCampaignLevelIndex,
  setCurrentMode,
} from "./modeManager.js";
import { renderCampaignLevelList } from "./uiLevelSelect.js";
import { startGame } from "./game.js";

const MainMenuView = Object.freeze({
  MAIN: "main",
  CAMPAIGN: "campaign",
  CHALLENGE: "challenge",
});

const CHALLENGE_PRESETS = [
  {
    id: "challenge-energy-storm",
    name: "能量風暴",
    description: "能量回復降低，敵人撤退更慢但更耐打。",
    modifiers: ["能量回復 -40%", "敵人速度 +15%", "Boss 血量 +10%"],
    levelId: 2,
  },
  {
    id: "challenge-portal-chaos",
    name: "傳送門失控",
    description: "額外的隨機事件會在波次中觸發。",
    modifiers: ["每波額外隨機事件", "稀有事件觸發率提升"],
    levelId: 3,
  },
];

let minimalBindingsInstalled = false;
let currentView = MainMenuView.MAIN;

const dom = {
  startScreen: null,
  helpBtn: null,
  helpPanel: null,
  btnStart: null,
  modeButtons: [],
  campaignBackBtn: null,
  challengeBackBtn: null,
  mainView: null,
  campaignView: null,
  challengeView: null,
  campaignList: null,
  challengeList: null,
};

export function initializeStartMenu() {
  cacheDom();
  console.info("[MAIN_MENU] init", {
    hasStartScreen: Boolean(dom.startScreen),
    hasButtons: dom.modeButtons.length,
  });
  setupStartHelpToggle();
  setupModeButtons();
  setupBackButtons();
  renderCampaignLevels();
  renderChallenges();
  setupCardSidebarToggle();
  attachDebugClickLogger();
  listenForExternalReset();
  ensureMinimalBindings();
  bindStartButton();
  switchView(MainMenuView.MAIN);
  if (typeof window !== "undefined") {
    window.__MAIN_MENU_DEBUG__ = {
      switchView,
      startCampaignRun,
      startEndlessMode,
      startChallenge: switchView.bind(null, MainMenuView.CHALLENGE),
    };
  }
}

export function ensureMinimalBindings() {
  if (minimalBindingsInstalled) return;
  const btnPause = document.getElementById("btn-pause");
  bindStartButton();
  if (btnPause) {
function bindStartButton() {
  if (!dom.btnStart) return;
  if (dom.btnStart.dataset.bound === "true") return;
  dom.btnStart.dataset.bound = "true";
  dom.btnStart.addEventListener("click", () => {
    console.log("[MAIN_MENU] clicked button = START");
    const currentMode = getCurrentModeForStart();
    if (currentMode === MODE_TYPES.CAMPAIGN) {
      startCampaignRun();
    } else if (currentMode === MODE_TYPES.ENDLESS) {
      startEndlessMode();
    } else if (currentMode === MODE_TYPES.CHALLENGE) {
      switchView(MainMenuView.CHALLENGE);
    } else {
      startCampaignRun();
    }
  });
}

function getCurrentModeForStart() {
  const selected = dom.modeButtons.find((btn) => btn.classList.contains("selected"));
  return selected?.dataset.mode || getCurrentMode() || MODE_TYPES.CAMPAIGN;
}

function startCampaignRun(levelOverride) {
  const fallback = getCampaignLevelIndex();
  startGame({
    mode: MODE_TYPES.CAMPAIGN,
    levelIndex: levelOverride ?? fallback,
  });
}
    btnPause.addEventListener("click", () => {
      const isPaused = btnPause.dataset.state === "paused";
      const nextState = isPaused ? "running" : "paused";
      btnPause.dataset.state = nextState;
      btnPause.textContent = nextState === "paused" ? "繼續" : "暫停";
    });
  }
  minimalBindingsInstalled = true;
}

function cacheDom() {
  dom.startScreen = document.getElementById("start-screen");
  dom.helpBtn = document.getElementById("btn-toggle-help");
  dom.helpPanel = document.getElementById("start-help-panel");
  dom.btnStart = document.getElementById("btn-start");
  dom.modeButtons = Array.from(document.querySelectorAll("#mode-select [data-mode]"));
  dom.campaignBackBtn = document.getElementById("btn-campaign-back");
  dom.challengeBackBtn = document.getElementById("btn-challenge-back");
  dom.mainView = document.getElementById("menu-main-view");
  dom.campaignView = document.getElementById("menu-campaign-view");
  dom.challengeView = document.getElementById("menu-challenge-view");
  dom.campaignList = document.getElementById("campaign-level-list");
  dom.challengeList = document.getElementById("challenge-list");
}

function setupStartHelpToggle() {
  if (!dom.helpBtn || !dom.helpPanel) return;
  dom.helpBtn.addEventListener("click", () => {
    const hidden = dom.helpPanel.classList.toggle("hidden");
    dom.helpBtn.textContent = hidden ? "操作說明" : "收起說明";
    console.log("[MAIN_MENU] clicked button = HELP_TOGGLE");
  });
}

function setupModeButtons() {
  if (!dom.modeButtons.length) return;
  dom.modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (!mode) return;
      dom.modeButtons.forEach((node) => node.classList.toggle("selected", node === btn));
      if (mode === MODE_TYPES.CAMPAIGN) {
        console.log("[MAIN_MENU] clicked button = CAMPAIGN");
        switchView(MainMenuView.CAMPAIGN);
      } else if (mode === MODE_TYPES.ENDLESS) {
        console.log("[MAIN_MENU] clicked button = ENDLESS");
        startEndlessMode();
      } else if (mode === MODE_TYPES.CHALLENGE) {
        console.log("[MAIN_MENU] clicked button = CHALLENGE");
        switchView(MainMenuView.CHALLENGE);
      }
      setCurrentMode(mode);
    });
  });
}

function setupBackButtons() {
  dom.campaignBackBtn?.addEventListener("click", () => {
    console.log("[MAIN_MENU] clicked button = CAMPAIGN_BACK");
    switchView(MainMenuView.MAIN);
  });
  dom.challengeBackBtn?.addEventListener("click", () => {
    console.log("[MAIN_MENU] clicked button = CHALLENGE_BACK");
    switchView(MainMenuView.MAIN);
  });
}

function renderCampaignLevels() {
  if (!dom.campaignList) return;
  renderCampaignLevelList(dom.campaignList, {
    activeIndex: getCampaignLevelIndex(),
    onSelect: (level, index) => {
      console.log("[MAIN_MENU] campaign level selected", level.id || index + 1);
      setCampaignLevelIndex(index);
      startCampaignRun(index);
    },
  });
}

function renderChallenges() {
  if (!dom.challengeList) return;
  dom.challengeList.innerHTML = "";
  CHALLENGE_PRESETS.forEach((challenge) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "challenge-card";

    const title = document.createElement("p");
    title.className = "challenge-card__name";
    title.textContent = challenge.name;

    const meta = document.createElement("p");
    meta.className = "challenge-card__meta";
    meta.textContent = `關卡 #${challenge.levelId}`;

    const desc = document.createElement("p");
    desc.className = "challenge-card__desc";
    desc.textContent = challenge.description;

    const mods = document.createElement("ul");
    mods.className = "challenge-card__mods";
    challenge.modifiers.forEach((modifier) => {
      const li = document.createElement("li");
      li.textContent = `• ${modifier}`;
      mods.appendChild(li);
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(mods);

    card.addEventListener("click", () => {
      console.log("[MAIN_MENU] challenge selected", challenge.id);
      startGame({
        mode: MODE_TYPES.CHALLENGE,
        levelId: challenge.levelId,
        challengeId: challenge.id,
      });
    });

    dom.challengeList.appendChild(card);
  });
}

function switchView(view) {
  currentView = view;
  const mapping = {
    [MainMenuView.MAIN]: dom.mainView,
    [MainMenuView.CAMPAIGN]: dom.campaignView,
    [MainMenuView.CHALLENGE]: dom.challengeView,
  };
  Object.entries(mapping).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("menu-view--hidden", key !== view);
  });
  if (view === MainMenuView.CAMPAIGN) {
    renderCampaignLevels();
  }
}

function startEndlessMode() {
  startGame({
    mode: MODE_TYPES.ENDLESS,
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
    toggleBtn.textContent = collapsed ? "展開" : "收起";
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

function attachDebugClickLogger() {
  if (!dom.startScreen) return;
  dom.startScreen.addEventListener("click", (event) => {
    console.log(
      "[MAIN_MENU][CLICK]",
      event.clientX,
      event.clientY,
      "view=",
      currentView
    );
  });
}

function listenForExternalReset() {
  document.addEventListener("main-menu:enter", () => {
    switchView(MainMenuView.MAIN);
  });
}

