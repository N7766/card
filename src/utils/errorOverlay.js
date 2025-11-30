const OVERLAY_ID = "game-fatal-overlay";

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0, 0, 0, 0.75)";
  overlay.style.color = "#fff";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "99999";
  overlay.style.padding = "24px";
  overlay.style.boxSizing = "border-box";
  overlay.style.fontFamily =
    '"Inter", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif';
  overlay.style.textAlign = "center";
  overlay.style.gap = "16px";

  const title = document.createElement("h2");
  title.id = `${OVERLAY_ID}-title`;
  title.style.margin = "0";
  title.style.fontSize = "24px";

  const message = document.createElement("p");
  message.id = `${OVERLAY_ID}-message`;
  message.style.margin = "0";
  message.style.fontSize = "16px";

  const hint = document.createElement("p");
  hint.textContent = "請打開開發者工具（Console）查看詳細錯誤資訊。";
  hint.style.margin = "0";
  hint.style.opacity = "0.8";
  hint.style.fontSize = "14px";

  overlay.appendChild(title);
  overlay.appendChild(message);
  overlay.appendChild(hint);

  document.body.appendChild(overlay);
  return overlay;
}

export function showFatalError(title = "遊戲遇到致命錯誤", detail = "") {
  const overlay = ensureOverlay();
  const titleEl = overlay.querySelector(`#${OVERLAY_ID}-title`);
  const messageEl = overlay.querySelector(`#${OVERLAY_ID}-message`);
  if (titleEl) {
    titleEl.textContent = title;
  }
  if (messageEl) {
    messageEl.textContent =
      typeof detail === "string"
        ? detail
        : detail?.message || JSON.stringify(detail);
  }
  overlay.style.visibility = "visible";
  overlay.style.pointerEvents = "auto";
}

export function hideFatalError() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.style.visibility = "hidden";
  overlay.style.pointerEvents = "none";
}

