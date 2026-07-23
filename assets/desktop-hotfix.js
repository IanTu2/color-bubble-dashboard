(() => {
  "use strict";

  const STORAGE_KEY = "bubble-workspace-windows";
  let activeDrag = null;
  let animationFrame = 0;

  function readWindows() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeWindows(windows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
    } catch (error) {
      console.warn("Bubble Workspace 狀態保存失敗", error);
    }
  }

  function updateWindowState(id, updater) {
    const windows = readWindows();
    const item = windows.find((windowItem) => windowItem.id === id);
    if (!item) return null;
    updater(item, windows);
    writeWindows(windows);
    return item;
  }

  function getWindowId(element) {
    return element?.closest(".desktop-window")?.dataset.windowId || "";
  }

  function focusWithoutRender(element) {
    const id = getWindowId(element);
    if (!id) return;

    const item = updateWindowState(id, (current, windows) => {
      const maxZ = windows.reduce((max, entry) => Math.max(max, Number(entry.z) || 0), 10);
      if ((Number(current.z) || 0) < maxZ) current.z = maxZ + 1;
    });

    if (item) {
      const windowElement = element.closest(".desktop-window");
      windowElement.style.zIndex = String(item.z);
      updateTaskbar(windowElement.closest("#workspaceShell"), id);
    }
  }

  function updateTaskbar(shell, activeId) {
    if (!shell) return;
    shell.querySelectorAll("[data-task-window]").forEach((button) => {
      button.classList.toggle("active", button.dataset.taskWindow === activeId);
    });
  }

  function startDrag(event, titlebar) {
    const windowElement = titlebar.closest(".desktop-window");
    const desktop = titlebar.closest("[data-workspace-desktop]");
    const id = windowElement?.dataset.windowId;
    if (!windowElement || !desktop || !id || windowElement.classList.contains("maximized")) return;

    const windowRect = windowElement.getBoundingClientRect();
    const desktopRect = desktop.getBoundingClientRect();
    activeDrag = {
      pointerId: event.pointerId,
      id,
      titlebar,
      windowElement,
      desktop,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: windowRect.left - desktopRect.left,
      startTop: windowRect.top - desktopRect.top,
      nextLeft: windowRect.left - desktopRect.left,
      nextTop: windowRect.top - desktopRect.top
    };

    titlebar.setPointerCapture?.(event.pointerId);
    windowElement.classList.add("is-moving");
    focusWithoutRender(windowElement);
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    const maxLeft = Math.max(0, activeDrag.desktop.clientWidth - 120);
    const maxTop = Math.max(0, activeDrag.desktop.clientHeight - 42);
    activeDrag.nextLeft = Math.min(maxLeft, Math.max(0, activeDrag.startLeft + event.clientX - activeDrag.startX));
    activeDrag.nextTop = Math.min(maxTop, Math.max(0, activeDrag.startTop + event.clientY - activeDrag.startY));

    if (animationFrame) return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      if (!activeDrag) return;
      activeDrag.windowElement.style.left = `${activeDrag.nextLeft}px`;
      activeDrag.windowElement.style.top = `${activeDrag.nextTop}px`;
    });
  }

  function finishDrag(event) {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    const { id, windowElement, nextLeft, nextTop } = activeDrag;
    windowElement.style.left = `${nextLeft}px`;
    windowElement.style.top = `${nextTop}px`;
    windowElement.classList.remove("is-moving");

    updateWindowState(id, (item) => {
      item.x = Math.round(nextLeft);
      item.y = Math.round(nextTop);
    });

    activeDrag = null;
  }

  function normalizeUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const url = new URL(candidate);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function enhanceWebWindow(windowElement) {
    if (!windowElement || windowElement.dataset.webHotfix === "true") return;
    const title = windowElement.querySelector(".window-titlebar strong")?.textContent?.trim();
    const placeholder = windowElement.querySelector(".web-placeholder");
    if (title !== "一般網頁" || !placeholder) return;

    windowElement.dataset.webHotfix = "true";
    const id = windowElement.dataset.windowId;
    const windows = readWindows();
    const item = windows.find((entry) => entry.id === id);
    const savedUrl = normalizeUrl(item?.content?.url || "https://example.com");

    const pane = document.createElement("div");
    pane.className = "web-pane hotfix-web-pane";

    const form = document.createElement("form");
    form.className = "web-form";
    const input = document.createElement("input");
    input.type = "url";
    input.placeholder = "https://example.com";
    input.value = savedUrl;

    const loadButton = document.createElement("button");
    loadButton.type = "submit";
    loadButton.textContent = "載入";

    const externalButton = document.createElement("button");
    externalButton.type = "button";
    externalButton.textContent = "新分頁";

    const hint = document.createElement("p");
    hint.className = "web-hint";
    hint.textContent = "有些網站禁止被嵌入；遇到空白或拒絕連線時，請按「新分頁」。";

    const frame = document.createElement("iframe");
    frame.title = "網頁工具";
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.sandbox = "allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts";
    if (savedUrl) frame.src = savedUrl;

    form.append(input, loadButton, externalButton);
    pane.append(form, hint, frame);
    placeholder.replaceWith(pane);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const url = normalizeUrl(input.value);
      if (!url) {
        input.setCustomValidity("請輸入有效網址");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      input.value = url;
      frame.src = url;
      updateWindowState(id, (entry) => {
        entry.content = entry.content || {};
        entry.content.url = url;
      });
    });

    externalButton.addEventListener("click", () => {
      const url = normalizeUrl(input.value || frame.src);
      if (!url) {
        input.setCustomValidity("請輸入有效網址");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function enhanceAllWebWindows(root = document) {
    root.querySelectorAll?.(".desktop-window").forEach(enhanceWebWindow);
  }

  document.addEventListener("pointerdown", (event) => {
    const windowElement = event.target.closest?.(".desktop-window");
    if (!windowElement) return;

    const titlebar = event.target.closest(".window-titlebar");
    const control = event.target.closest(".window-controls button");

    // 阻止舊版 pointerdown 重新 render 整個桌面；否則 click 與拖曳都會被中斷。
    event.stopImmediatePropagation();

    if (control) {
      focusWithoutRender(windowElement);
      return;
    }

    if (titlebar && event.button === 0) {
      startDrag(event, titlebar);
      return;
    }

    focusWithoutRender(windowElement);
  }, true);

  document.addEventListener("pointermove", moveDrag, true);
  document.addEventListener("pointerup", finishDrag, true);
  document.addEventListener("pointercancel", finishDrag, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(".desktop-window")) enhanceWebWindow(node);
        enhanceAllWebWindows(node);
      });
    }
  });

  const begin = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceAllWebWindows();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
})();
