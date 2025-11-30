import { LEVELS } from "./config.js";

export const DEFAULT_LEVEL_INDEX = 0;

export function getLevels() {
  return LEVELS;
}

export function getLevelByIndex(index) {
  if (!Number.isFinite(index)) return null;
  return LEVELS[index] ?? null;
}

export function getLevelIndexById(idOrName) {
  if (idOrName === undefined || idOrName === null) return -1;
  for (let i = 0; i < LEVELS.length; i += 1) {
    const level = LEVELS[i];
    if (!level) continue;
    if (String(level.id) === String(idOrName)) {
      return i;
    }
    if (typeof idOrName === "string" && level.name === idOrName) {
      return i;
    }
  }
  return -1;
}

export function clampLevelIndex(index, fallback = DEFAULT_LEVEL_INDEX) {
  if (!Number.isFinite(index)) return fallback;
  if (index < 0) return 0;
  if (index >= LEVELS.length) return LEVELS.length - 1;
  return index;
}

export function summarizeLevel(level) {
  if (!level) return null;
  return {
    id: level.id ?? null,
    name: level.name ?? "未知關卡",
    waves: Array.isArray(level.waves) ? level.waves.length : 0,
    difficulty: level.difficulty ?? 0,
  };
}

export { LEVELS };

