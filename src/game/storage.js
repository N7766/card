/**
 * storage 模組：使用 localStorage 保存簡單數據。
 * - 玩家歷史最高通關波數
 * - 是否曾經通關過遊戲
 */

const KEY_BEST_WAVE = "dom-td-best-wave";
const KEY_EVER_WON = "dom-td-ever-won";

/**
 * 讀取歷史最高波數。
 * @returns {number}
 */
export function loadBestRecord() {
  try {
    const raw = localStorage.getItem(KEY_BEST_WAVE);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * 保存新的最高波數（若比原記錄高）。
 * @param {number} wave
 */
export function saveBestRecord(wave) {
  if (!Number.isFinite(wave) || wave <= 0) return;
  try {
    const prev = loadBestRecord();
    if (wave > prev) {
      localStorage.setItem(KEY_BEST_WAVE, String(Math.floor(wave)));
    }
  } catch {
    // 忽略存儲錯誤
  }
}

/**
 * 標記玩家曾經通關。
 */
export function markEverWon() {
  try {
    localStorage.setItem(KEY_EVER_WON, "1");
  } catch {
    // ignore
  }
}

/**
 * 是否曾通關過遊戲。
 * @returns {boolean}
 */
export function hasEverWon() {
  try {
    return localStorage.getItem(KEY_EVER_WON) === "1";
  } catch {
    return false;
  }
}


