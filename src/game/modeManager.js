import { DebugConfig } from "./config.js";
import {
  DEFAULT_LEVEL_INDEX,
  clampLevelIndex,
  getLevelByIndex,
  getLevelIndexById,
  getLevels,
  summarizeLevel,
} from "./levelConfigManager.js";

export const MODE_TYPES = Object.freeze({
  CAMPAIGN: "campaign",
  ENDLESS: "endless",
  CHALLENGE: "challenge",
});

const modeState = {
  current: MODE_TYPES.CAMPAIGN,
  campaignLevelIndex: DEFAULT_LEVEL_INDEX,
  endless: {
    difficulty: 1,
    seed: null,
  },
  challenge: {
    challengeId: null,
  },
};

function logInit(message, detail) {
  if (!DebugConfig.logInitSteps) return;
  if (detail !== undefined) {
    console.log(`[ModeManager] ${message}`, detail);
  } else {
    console.log(`[ModeManager] ${message}`);
  }
}

function normalizeRequest(request = {}) {
  if (typeof request === "number") {
    return { levelIndex: request };
  }
  if (typeof request === "string") {
    return { levelId: request };
  }
  if (request && typeof request === "object") {
    return { ...request };
  }
  return {};
}

function getFallbackLevelIndexForMode(mode) {
  const levels = getLevels();
  if (!levels.length) return DEFAULT_LEVEL_INDEX;
  if (mode === MODE_TYPES.ENDLESS) {
    return clampLevelIndex(levels.length - 1);
  }
  if (mode === MODE_TYPES.CHALLENGE) {
    return clampLevelIndex(Math.min(1, levels.length - 1));
  }
  return clampLevelIndex(modeState.campaignLevelIndex);
}

export function setCampaignLevelIndex(index) {
  const clamped = clampLevelIndex(index);
  modeState.campaignLevelIndex = clamped;
  logInit("setCampaignLevelIndex", clamped);
  return clamped;
}

export function getCampaignLevelIndex() {
  return modeState.campaignLevelIndex;
}

export function setCurrentMode(mode) {
  if (!Object.values(MODE_TYPES).includes(mode)) {
    return modeState.current;
  }
  if (modeState.current === mode) {
    return mode;
  }
  modeState.current = mode;
  logInit("setCurrentMode", mode);
  return mode;
}

export function getCurrentMode() {
  return modeState.current;
}

export function resolveStartRequest(request = {}) {
  const normalized = normalizeRequest(request);
  const forcedMode = DebugConfig.forceMode;
  const forcedLevelId = DebugConfig.forceLevelId;

  let mode = normalized.mode || forcedMode || modeState.current;
  if (!Object.values(MODE_TYPES).includes(mode)) {
    mode = MODE_TYPES.CAMPAIGN;
  }

  let levelIndex;
  if (Number.isFinite(normalized.levelIndex)) {
    levelIndex = normalized.levelIndex;
  } else if (normalized.levelId !== undefined) {
    levelIndex = getLevelIndexById(normalized.levelId);
  }

  if (forcedLevelId !== undefined && forcedLevelId !== null) {
    const forcedIndex = getLevelIndexById(forcedLevelId);
    if (forcedIndex >= 0) {
      levelIndex = forcedIndex;
    }
  }

  if (!Number.isFinite(levelIndex) || levelIndex < 0) {
    levelIndex = getFallbackLevelIndexForMode(mode);
  }

  levelIndex = clampLevelIndex(levelIndex);
  const level = getLevelByIndex(levelIndex);
  const summary = summarizeLevel(level);

  const payload = {
    mode,
    levelIndex,
    levelId: level?.id ?? null,
    level,
    summary,
    meta: {
      forcedMode: Boolean(forcedMode),
      forcedLevel: Boolean(forcedLevelId),
      request: normalized,
    },
  };

  logInit("resolveStartRequest", payload);
  return payload;
}

