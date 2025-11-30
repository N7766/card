import { DebugConfig } from "./config.js";
import { initGame } from "./game.js";
import { ensureMinimalBindings, initializeStartMenu } from "./startMenu.js";
import { showFatalError } from "../utils/errorOverlay.js";

let guardsInstalled = false;

function logInit(message, detail) {
  if (!DebugConfig.logInitSteps) return;
  if (detail !== undefined) {
    console.log(`[GameRoot] ${message}`, detail);
  } else {
    console.log(`[GameRoot] ${message}`);
  }
}

function installGlobalGuards() {
  if (guardsInstalled) return;
  window.addEventListener("error", (event) => {
    if (!event.error) return;
    console.error("[GameRoot] Uncaught error", event.error);
    showFatalError("遊戲執行過程中出現錯誤", event.error.message || String(event.error));
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[GameRoot] Unhandled promise rejection", event.reason);
    showFatalError(
      "遊戲遇到未處理的 Promise 錯誤",
      event.reason?.message || String(event.reason)
    );
  });
  guardsInstalled = true;
}

export function bootstrapGame() {
  logInit("bootstrap:start");
  initializeStartMenu();
  installGlobalGuards();
  try {
    initGame();
    logInit("bootstrap:initGame:success");
  } catch (error) {
    console.error("[GameRoot] initGame 失敗", error);
    ensureMinimalBindings();
    showFatalError("遊戲初始化失敗", error.message || String(error));
    throw error;
  }
}

