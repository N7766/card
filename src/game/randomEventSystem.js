import { ENEMY_TYPES, MAP_TILE_SIZE, RARE_EVENT_CONFIG } from "./config.js";

/**
 * @param {{
 *  getState: () => any,
 *  uiHooks: { showWaveToast: Function, hideGatherMarker: Function, showGatherMarker: Function },
 *  gridUtils: { pixelToGrid: Function, gridToPixel: Function, getFieldDimensions: Function },
 *  tileSize?: number
 * }} options
 */
export function createRandomEventManager(options) {
  const {
    getState,
    uiHooks,
    gridUtils,
    tileSize = MAP_TILE_SIZE,
  } = options;

  const gatherRadius = tileSize / 2;

  function prepareForWave(waveIndex) {
    const state = getState();
    if (!state) return;
    const wave = state.currentLevelWaves?.[waveIndex];
    state.rareEvents.waveOverrides = null;
    state.rareEvents.zombieWaveActive = false;
    if (state.rareEvents.gather) {
      state.rareEvents.gather = null;
      uiHooks.hideGatherMarker();
    }
    if (!wave) return;

    const isBossWave = (wave.enemies || []).some(
      (group) => group.type === ENEMY_TYPES.BOSS
    );
    if (isBossWave) {
      uiHooks.hideGatherMarker();
      return;
    }

    const zombieChance = RARE_EVENT_CONFIG?.zombieWaveChance ?? 0;
    const gatherChance = RARE_EVENT_CONFIG?.gatherWaveChance ?? 0;
    let zombieTriggered = false;

    if (zombieChance > 0 && Math.random() < zombieChance) {
      zombieTriggered = true;
      state.rareEvents.zombieWaveActive = true;
      const overrideGroups = (wave.enemies || []).map((group) => ({
        ...group,
        type: ENEMY_TYPES.ZOMBIE,
      }));
      state.rareEvents.waveOverrides = {
        index: waveIndex,
        groups: overrideGroups,
      };
      uiHooks.showWaveToast("屍潮來襲！", "zombie");
    }

    if (!zombieTriggered && gatherChance > 0 && Math.random() < gatherChance) {
      const success = setupGatherWave(state, waveIndex, wave);
      if (success) {
        uiHooks.showWaveToast("敵人正在集結！", "gather");
      } else {
        uiHooks.hideGatherMarker();
      }
    } else {
      uiHooks.hideGatherMarker();
    }
  }

  function setupGatherWave(state, waveIndex, wave) {
    let gatherGrid = null;
    const mapState = state.map;
    if (mapState?.width && mapState?.height) {
      gatherGrid = {
        row: Math.floor(mapState.height / 2),
        col: Math.floor(mapState.width / 2),
      };
    } else {
      const { width, height } = gridUtils.getFieldDimensions();
      gatherGrid = gridUtils.pixelToGrid(width / 2, height / 2);
    }
    const gatherPixel = gridUtils.gridToPixel(gatherGrid.row, gatherGrid.col);
    const expectedCount = (wave?.enemies || []).reduce(
      (sum, group) => sum + (group?.count || 0),
      0
    );
    if (expectedCount <= 0) {
      state.rareEvents.gather = null;
      uiHooks.hideGatherMarker();
      return false;
    }
    state.rareEvents.gather = {
      waveIndex,
      phase: "gathering",
      grid: gatherGrid,
      pixel: gatherPixel,
      arrivalRadius: gatherRadius,
      expectedCount,
      arrivedCount: 0,
      deadBeforePush: 0,
    };
    uiHooks.showGatherMarker(gatherPixel.x, gatherPixel.y);
    return true;
  }

  function onEnemyArrived(enemy) {
    const state = getState();
    if (!state?.rareEvents?.gather) return;
    const gather = state.rareEvents.gather;
    if (gather.phase !== "gathering") return;
    gather.arrivedCount += 1;
    maybeReleaseGatherWave();
  }

  function onEnemyDeath(enemy) {
    const state = getState();
    if (!state?.rareEvents?.gather) return;
    const gather = state.rareEvents.gather;
    if (
      gather.phase === "gathering" &&
      enemy?.isGatherWaveUnit &&
      !enemy.arrivedAtGather
    ) {
      gather.deadBeforePush += 1;
    }
  }

  function maybeReleaseGatherWave() {
    const state = getState();
    if (!state?.rareEvents?.gather) return;
    const gather = state.rareEvents.gather;
    if (gather.phase !== "gathering") return;
    if (!state.waveSpawnFinished) return;
    const reached = gather.arrivedCount + gather.deadBeforePush;
    if (reached < gather.expectedCount) {
      return;
    }
    gather.phase = "pushing";
    uiHooks.hideGatherMarker();
    uiHooks.showWaveToast("集結完成，敵人開始推進！", "gather");
    for (const enemy of state.enemies) {
      if (enemy.isGatherWaveUnit && enemy.alive) {
        enemy.customPathTarget = null;
        enemy.phase = "pushing";
        enemy.needsPathRecalculation = true;
      }
    }
  }

  return {
    prepareForWave,
    onEnemyArrived,
    onEnemyDeath,
    maybeReleaseGatherWave,
  };
}

