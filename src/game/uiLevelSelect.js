import { getLevels } from "./levelConfigManager.js";

function formatDifficultyStars(value = 1) {
  const total = 5;
  const filled = Math.max(0, Math.min(total, Math.round(value)));
  const stars = "★".repeat(filled) + "☆".repeat(total - filled);
  return stars;
}

export function renderCampaignLevelList(container, { activeIndex = 0, onSelect } = {}) {
  if (!container) return;
  const levels = getLevels();
  container.innerHTML = "";

  levels.forEach((level, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "campaign-level-card";
    btn.dataset.levelIndex = String(index);

    const title = document.createElement("p");
    title.className = "campaign-level-card__name";
    title.textContent = level.name || `關卡 ${level.id ?? index + 1}`;

    const meta = document.createElement("p");
    meta.className = "campaign-level-card__meta";
    const waveCount = Array.isArray(level.waves) ? level.waves.length : 0;
    meta.textContent = `難度 ${formatDifficultyStars(level.difficulty || 1)} · 波數 ${waveCount}`;

    const desc = document.createElement("p");
    desc.className = "campaign-level-card__desc";
    desc.textContent = level.description || "敵人即將來襲，準備防禦！";

    btn.appendChild(title);
    btn.appendChild(meta);
    btn.appendChild(desc);

    if (index === activeIndex) {
      btn.classList.add("campaign-level-card--active");
    }

    btn.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(level, index);
      }
    });

    container.appendChild(btn);
  });
}

