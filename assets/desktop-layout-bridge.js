(() => {
  "use strict";

  const WINDOW_KEY = "bubble-workspace-windows";
  const LAYOUT_KEY = "bubble-workspace-layout-bridge";
  let pendingSync = 0;
  let pressedWindow = null;

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Bubble Workspace 版面保存失敗", error);
    }
  }

  function numberFromStyle(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function captureElement(element, layout) {
    if (!element?.dataset.windowId) return;
    const id = element.dataset.windowId;
    const rect = element.getBoundingClientRect();
    const desktopRect = element.closest("[data-workspace-desktop]")?.getBoundingClientRect();
    const previous = layout[id] || {};

    layout[id] = {
      x: Math.round(numberFromStyle(element.style.left, desktopRect ? rect.left - desktopRect.left : previous.x || 0)),
      y: Math.round(numberFromStyle(element.style.top, desktopRect ? rect.top - desktopRect.top : previous.y || 0)),
      width: Math.round(numberFromStyle(element.style.width, rect.width || previous.width || 520)),
      height: Math.round(numberFromStyle(element.style.height, rect.height || previous.height || 380)),
      z: Math.round(numberFromStyle(element.style.zIndex, previous.z || 10))
    };
  }

  function applyElement(element, saved) {
    if (!element || !saved) return;
    if (!element.classList.contains("maximized")) {
      if (Number.isFinite(saved.x)) element.style.left = `${saved.x}px`;
      if (Number.isFinite(saved.y)) element.style.top = `${saved.y}px`;
      if (Number.isFinite(saved.width)) element.style.width = `${saved.width}px`;
      if (Number.isFinite(saved.height)) element.style.height = `${saved.height}px`;
    }
    if (Number.isFinite(saved.z)) element.style.zIndex = String(saved.z);
  }

  function syncLayout() {
    pendingSync = 0;
    const shell = document.querySelector("#workspaceShell");
    if (!shell) return;

    const elements = [...shell.querySelectorAll(".desktop-window[data-window-id]")];
    const layout = readJson(LAYOUT_KEY, {});
    const currentIds = new Set(elements.map((element) => element.dataset.windowId));
    let maxZ = Object.values(layout).reduce((max, entry) => Math.max(max, Number(entry?.z) || 0), 10);

    elements.forEach((element) => {
      const id = element.dataset.windowId;
      if (!layout[id]) {
        captureElement(element, layout);
        layout[id].z = ++maxZ;
      }
      applyElement(element, layout[id]);
    });

    Object.keys(layout).forEach((id) => {
      if (!currentIds.has(id)) delete layout[id];
    });

    const windows = readJson(WINDOW_KEY, []);
    if (Array.isArray(windows)) {
      windows.forEach((item) => {
        const saved = layout[item.id];
        if (!saved) return;
        item.x = saved.x;
        item.y = saved.y;
        item.width = saved.width;
        item.height = saved.height;
        item.z = saved.z;
      });
      writeJson(WINDOW_KEY, windows);
    }

    writeJson(LAYOUT_KEY, layout);
  }

  function scheduleSync() {
    if (pendingSync) return;
    pendingSync = window.setTimeout(syncLayout, 0);
  }

  // 在舊版事件攔截器之前記住操作中的視窗；放開後再讀取最終位置。
  window.addEventListener("pointerdown", (event) => {
    pressedWindow = event.target.closest?.(".desktop-window[data-window-id]") || null;
  }, true);

  window.addEventListener("pointerup", () => {
    const target = pressedWindow;
    pressedWindow = null;
    window.setTimeout(() => {
      const layout = readJson(LAYOUT_KEY, {});
      if (target?.isConnected) captureElement(target, layout);
      writeJson(LAYOUT_KEY, layout);
      syncLayout();
    }, 0);
  }, true);

  window.addEventListener("pointercancel", () => {
    pressedWindow = null;
    scheduleSync();
  }, true);

  const observer = new MutationObserver(scheduleSync);

  function begin() {
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
})();
