(() => {
  "use strict";

  const COLLAPSED_KEY = "bubble-collapsed-cards";
  const ROBOT_KEY = "bubble-robot-position";
  const WINDOWS_KEY = "bubble-workspace-windows";
  const LAYOUT_KEY = "bubble-workspace-layout-bridge";
  const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  let robotDrag = null;
  let resizeState = null;
  let resizeFrame = 0;
  let robotFrame = 0;

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
      console.warn("Bubble Space 狀態保存失敗", error);
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function updateMemberLayoutClass() {
    const dashboard = document.querySelector("#memberDashboard");
    const isActive = Boolean(dashboard && !dashboard.hidden);
    document.body.classList.toggle("member-dashboard-active", isActive);
  }

  function collapsedHeight(card) {
    const head = card.querySelector(".card-head");
    if (!head) return 84;
    const style = getComputedStyle(card);
    return Math.ceil(
      head.getBoundingClientRect().height +
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0)
    );
  }

  function saveCollapsedState(card) {
    const state = readJson(COLLAPSED_KEY, {});
    state[card.id] = card.classList.contains("is-collapsed");
    writeJson(COLLAPSED_KEY, state);
  }

  function animateCardCollapse(card, shouldCollapse) {
    if (!card || card.dataset.collapseAnimating === "true") return;
    const startHeight = card.getBoundingClientRect().height;
    card.dataset.collapseAnimating = "true";
    card.style.height = `${Math.round(startHeight)}px`;
    card.style.overflow = "hidden";

    if (shouldCollapse) {
      const targetHeight = collapsedHeight(card);
      card.style.setProperty("--collapsed-card-height", `${targetHeight}px`);
      card.classList.add("is-collapsed");
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.height = `${targetHeight}px`;
      });
    } else {
      card.classList.remove("is-collapsed");
      card.style.height = "auto";
      const targetHeight = card.scrollHeight;
      card.style.height = `${Math.round(startHeight)}px`;
      card.getBoundingClientRect();
      requestAnimationFrame(() => {
        card.style.height = `${targetHeight}px`;
      });
    }

    const finish = () => {
      card.dataset.collapseAnimating = "false";
      if (shouldCollapse) {
        card.style.height = `${collapsedHeight(card)}px`;
      } else {
        card.style.removeProperty("height");
      }
      card.removeEventListener("transitionend", onTransitionEnd);
    };

    const onTransitionEnd = (event) => {
      if (event.propertyName !== "height") return;
      finish();
    };

    card.addEventListener("transitionend", onTransitionEnd);
    window.setTimeout(() => {
      if (card.dataset.collapseAnimating === "true") finish();
    }, 520);

    saveCollapsedState(card);
    const button = card.querySelector("[data-collapse-card]");
    if (button) {
      button.textContent = shouldCollapse ? "⌄" : "⌃";
      button.title = shouldCollapse ? "展開" : "收起";
      button.setAttribute("aria-expanded", String(!shouldCollapse));
    }
  }

  function normalizeCollapsedCards(root = document) {
    root.querySelectorAll?.("#calendarCard, #todoCard").forEach((card) => {
      if (card.classList.contains("is-collapsed")) {
        const targetHeight = collapsedHeight(card);
        card.style.setProperty("--collapsed-card-height", `${targetHeight}px`);
        card.style.height = `${targetHeight}px`;
      }
    });
  }

  function normalizeRobotPosition() {
    const robot = document.querySelector("#robotButton");
    if (!robot) return;
    robot.classList.add("layout-polished-robot");

    if (robotDrag) return;
    const saved = readJson(ROBOT_KEY, {});
    const rect = robot.getBoundingClientRect();
    const width = robot.offsetWidth || rect.width || 58;
    const height = robot.offsetHeight || rect.height || 58;
    const side = saved.side === "left" ? "left" : "right";
    const top = clamp(Number(saved.top) || rect.top || window.innerHeight - 110, 60, window.innerHeight - height - 8);
    const left = side === "left" ? 10 : Math.max(10, window.innerWidth - width - 10);

    robot.style.right = "auto";
    robot.style.left = `${Math.round(left)}px`;
    robot.style.top = `${Math.round(top)}px`;
    robot.style.bottom = "auto";
  }

  function startRobotDrag(event, robot) {
    if (event.button !== 0) return;
    const rect = robot.getBoundingClientRect();
    robotDrag = {
      pointerId: event.pointerId,
      robot,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      nextLeft: rect.left,
      nextTop: rect.top
    };
    robot.classList.remove("is-snapping");
    robot.classList.add("is-dragging", "layout-polished-robot");
    robot.style.right = "auto";
    robot.style.left = `${Math.round(rect.left)}px`;
    robot.style.top = `${Math.round(rect.top)}px`;
    robot.style.bottom = "auto";
    robot.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveRobot(event) {
    if (!robotDrag || event.pointerId !== robotDrag.pointerId) return;
    const { robot } = robotDrag;
    const left = clamp(
      robotDrag.startLeft + event.clientX - robotDrag.startX,
      8,
      window.innerWidth - robot.offsetWidth - 8
    );
    const top = clamp(
      robotDrag.startTop + event.clientY - robotDrag.startY,
      60,
      window.innerHeight - robot.offsetHeight - 8
    );
    robotDrag.nextLeft = left;
    robotDrag.nextTop = top;

    if (robotFrame) return;
    robotFrame = requestAnimationFrame(() => {
      robotFrame = 0;
      if (!robotDrag) return;
      robot.style.left = `${Math.round(robotDrag.nextLeft)}px`;
      robot.style.top = `${Math.round(robotDrag.nextTop)}px`;
    });
  }

  function finishRobotDrag(event) {
    if (!robotDrag || event.pointerId !== robotDrag.pointerId) return;
    if (robotFrame) {
      cancelAnimationFrame(robotFrame);
      robotFrame = 0;
    }

    const { robot, nextLeft, nextTop } = robotDrag;
    const center = nextLeft + robot.offsetWidth / 2;
    const side = center < window.innerWidth / 2 ? "left" : "right";
    const targetLeft = side === "left" ? 10 : Math.max(10, window.innerWidth - robot.offsetWidth - 10);
    const top = clamp(nextTop, 60, window.innerHeight - robot.offsetHeight - 8);

    robot.classList.remove("is-dragging");
    robot.classList.add("is-snapping");
    robot.style.right = "auto";
    robot.style.top = `${Math.round(top)}px`;
    requestAnimationFrame(() => {
      robot.style.left = `${Math.round(targetLeft)}px`;
    });

    const clearSnap = () => {
      robot.classList.remove("is-snapping");
      robot.removeEventListener("transitionend", onTransitionEnd);
    };
    const onTransitionEnd = (transitionEvent) => {
      if (transitionEvent.propertyName === "left") clearSnap();
    };
    robot.addEventListener("transitionend", onTransitionEnd);
    window.setTimeout(clearSnap, 620);

    writeJson(ROBOT_KEY, { side, top: Math.round(top) });
    robotDrag = null;
  }

  function installResizeHandles(windowElement) {
    if (!windowElement || windowElement.dataset.resizeHandles === "true") return;
    windowElement.dataset.resizeHandles = "true";
    RESIZE_DIRECTIONS.forEach((direction) => {
      const handle = document.createElement("span");
      handle.className = "window-resize-handle";
      handle.dataset.resizeDir = direction;
      handle.setAttribute("aria-hidden", "true");
      windowElement.appendChild(handle);
    });
  }

  function installAllResizeHandles(root = document) {
    root.querySelectorAll?.(".desktop-window[data-window-id]").forEach(installResizeHandles);
  }

  function focusWindowWithoutRender(windowElement) {
    if (!windowElement?.dataset.windowId) return;
    const windows = readJson(WINDOWS_KEY, []);
    if (!Array.isArray(windows)) return;
    const item = windows.find((entry) => entry.id === windowElement.dataset.windowId);
    if (!item) return;
    const maxZ = windows.reduce((max, entry) => Math.max(max, Number(entry.z) || 0), 10);
    item.z = maxZ + 1;
    windowElement.style.zIndex = String(item.z);
    writeJson(WINDOWS_KEY, windows);
  }

  function startResize(event, handle) {
    const windowElement = handle.closest(".desktop-window[data-window-id]");
    const desktop = windowElement?.closest("[data-workspace-desktop]");
    if (!windowElement || !desktop || windowElement.classList.contains("maximized")) return;

    const rect = windowElement.getBoundingClientRect();
    const desktopRect = desktop.getBoundingClientRect();
    resizeState = {
      pointerId: event.pointerId,
      handle,
      direction: handle.dataset.resizeDir || "se",
      windowElement,
      desktop,
      id: windowElement.dataset.windowId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left - desktopRect.left,
      startTop: rect.top - desktopRect.top,
      startWidth: rect.width,
      startHeight: rect.height,
      nextLeft: rect.left - desktopRect.left,
      nextTop: rect.top - desktopRect.top,
      nextWidth: rect.width,
      nextHeight: rect.height
    };

    focusWindowWithoutRender(windowElement);
    windowElement.classList.add("is-resizing");
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function calculateResize(event) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) return;
    const state = resizeState;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const minWidth = 280;
    const minHeight = 200;
    const desktopWidth = state.desktop.clientWidth;
    const desktopHeight = state.desktop.clientHeight;
    const direction = state.direction;

    let left = state.startLeft;
    let top = state.startTop;
    let width = state.startWidth;
    let height = state.startHeight;

    if (direction.includes("e")) {
      width = clamp(state.startWidth + dx, minWidth, desktopWidth - state.startLeft);
    }
    if (direction.includes("s")) {
      height = clamp(state.startHeight + dy, minHeight, desktopHeight - state.startTop);
    }
    if (direction.includes("w")) {
      left = clamp(state.startLeft + dx, 0, state.startLeft + state.startWidth - minWidth);
      width = state.startWidth + state.startLeft - left;
    }
    if (direction.includes("n")) {
      top = clamp(state.startTop + dy, 0, state.startTop + state.startHeight - minHeight);
      height = state.startHeight + state.startTop - top;
    }

    state.nextLeft = left;
    state.nextTop = top;
    state.nextWidth = width;
    state.nextHeight = height;

    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!resizeState) return;
      const element = resizeState.windowElement;
      element.style.left = `${Math.round(resizeState.nextLeft)}px`;
      element.style.top = `${Math.round(resizeState.nextTop)}px`;
      element.style.width = `${Math.round(resizeState.nextWidth)}px`;
      element.style.height = `${Math.round(resizeState.nextHeight)}px`;
    });
  }

  function persistResize(state) {
    const bounds = {
      x: Math.round(state.nextLeft),
      y: Math.round(state.nextTop),
      width: Math.round(state.nextWidth),
      height: Math.round(state.nextHeight),
      z: Number.parseInt(state.windowElement.style.zIndex, 10) || 10
    };

    const windows = readJson(WINDOWS_KEY, []);
    if (Array.isArray(windows)) {
      const item = windows.find((entry) => entry.id === state.id);
      if (item) Object.assign(item, bounds);
      writeJson(WINDOWS_KEY, windows);
    }

    const layout = readJson(LAYOUT_KEY, {});
    layout[state.id] = { ...(layout[state.id] || {}), ...bounds };
    writeJson(LAYOUT_KEY, layout);
  }

  function finishResize(event) {
    if (!resizeState || event.pointerId !== resizeState.pointerId) return;
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
    }

    const state = resizeState;
    const element = state.windowElement;
    element.style.left = `${Math.round(state.nextLeft)}px`;
    element.style.top = `${Math.round(state.nextTop)}px`;
    element.style.width = `${Math.round(state.nextWidth)}px`;
    element.style.height = `${Math.round(state.nextHeight)}px`;
    element.classList.remove("is-resizing");
    persistResize(state);
    resizeState = null;
  }

  /* Register before the old workspace capture handler. This lets resize handles
     consume the event without the legacy window manager rebuilding the DOM. */
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest?.(".window-resize-handle");
    if (handle) {
      event.stopImmediatePropagation();
      startResize(event, handle);
      return;
    }

    const robot = event.target.closest?.("#robotButton");
    if (robot) {
      event.stopImmediatePropagation();
      startRobotDrag(event, robot);
    }
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (resizeState) {
      event.stopImmediatePropagation();
      event.preventDefault();
      calculateResize(event);
      return;
    }
    if (robotDrag) {
      event.stopImmediatePropagation();
      event.preventDefault();
      moveRobot(event);
    }
  }, true);

  document.addEventListener("pointerup", (event) => {
    if (resizeState) {
      event.stopImmediatePropagation();
      finishResize(event);
      return;
    }
    if (robotDrag) {
      event.stopImmediatePropagation();
      finishRobotDrag(event);
    }
  }, true);

  document.addEventListener("pointercancel", (event) => {
    if (resizeState) {
      event.stopImmediatePropagation();
      finishResize(event);
      return;
    }
    if (robotDrag) {
      event.stopImmediatePropagation();
      finishRobotDrag(event);
    }
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-collapse-card]");
    if (!button) return;
    const card = button.closest(".dashboard-card");
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    animateCardCollapse(card, !card.classList.contains("is-collapsed"));
  }, true);

  function begin() {
    updateMemberLayoutClass();
    normalizeCollapsedCards();
    normalizeRobotPosition();
    installAllResizeHandles();

    const dashboard = document.querySelector("#memberDashboard");
    if (dashboard) {
      new MutationObserver(updateMemberLayoutClass).observe(dashboard, {
        attributes: true,
        attributeFilter: ["hidden"]
      });
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(".desktop-window[data-window-id]")) installResizeHandles(node);
          installAllResizeHandles(node);
          normalizeCollapsedCards(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    /* The older robot module runs after this file. Re-normalize once its initial
       right:auto/right:10 assignment has completed. */
    window.setTimeout(normalizeRobotPosition, 0);
    window.setTimeout(normalizeRobotPosition, 160);
    window.addEventListener("resize", () => {
      normalizeRobotPosition();
      normalizeCollapsedCards();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
})();
