(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = {
    background: "bubble-background-settings",
    collapsed: "bubble-collapsed-cards",
    robot: "bubble-robot-position",
    windows: "bubble-workspace-windows"
  };

  function safeParse(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  }

  function installBackgroundSettings() {
    const shell = $("#settingsDialog .settings-shell");
    if (!shell || $("[data-background-settings]", shell)) return;
    const state = safeParse(STORAGE.background, { theme: "default", motion: "normal", bubbles: true });
    const section = document.createElement("section");
    section.className = "settings-section background-options";
    section.dataset.backgroundSettings = "";
    section.innerHTML = `
      <h3>背景</h3>
      <div class="background-theme-grid" role="group" aria-label="背景主題">
        <button type="button" data-bg-theme="default">預設</button>
        <button type="button" data-bg-theme="ocean">海洋</button>
        <button type="button" data-bg-theme="sunset">晚霞</button>
        <button type="button" data-bg-theme="midnight">深夜</button>
      </div>
      <label class="setting-toggle"><span>顯示泡泡</span><input type="checkbox" data-bg-bubbles></label>
      <label class="setting-toggle"><span>背景動態</span>
        <select data-bg-motion>
          <option value="normal">一般</option>
          <option value="calm">緩慢</option>
          <option value="static">停止</option>
        </select>
      </label>`;
    shell.appendChild(section);

    const apply = () => {
      const next = {
        theme: $("[data-bg-theme].active", section)?.dataset.bgTheme || "default",
        motion: $("[data-bg-motion]", section).value,
        bubbles: $("[data-bg-bubbles]", section).checked
      };
      document.body.classList.remove("theme-ocean", "theme-sunset", "theme-midnight", "bg-calm", "bg-static", "hide-bubbles");
      if (next.theme !== "default") document.body.classList.add(`theme-${next.theme}`);
      if (next.motion !== "normal") document.body.classList.add(`bg-${next.motion}`);
      if (!next.bubbles) document.body.classList.add("hide-bubbles");
      localStorage.setItem(STORAGE.background, JSON.stringify(next));
    };

    $$('[data-bg-theme]', section).forEach((button) => {
      button.classList.toggle("active", button.dataset.bgTheme === state.theme);
      button.addEventListener("click", () => {
        $$('[data-bg-theme]', section).forEach((item) => item.classList.toggle("active", item === button));
        apply();
      });
    });
    $("[data-bg-bubbles]", section).checked = state.bubbles !== false;
    $("[data-bg-motion]", section).value = state.motion || "normal";
    $("[data-bg-bubbles]", section).addEventListener("change", apply);
    $("[data-bg-motion]", section).addEventListener("change", apply);
    apply();
  }

  function installCardCollapse() {
    const collapsed = safeParse(STORAGE.collapsed, {});
    ["calendarCard", "todoCard"].forEach((id) => {
      const card = document.getElementById(id);
      const head = $(".card-head", card);
      if (!card || !head || $("[data-collapse-card]", head)) return;
      const existing = $(".round-arrow", head);
      const actions = document.createElement("div");
      actions.className = "card-head-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-collapse";
      button.dataset.collapseCard = id;
      const render = () => {
        const isCollapsed = card.classList.contains("is-collapsed");
        button.textContent = isCollapsed ? "⌄" : "⌃";
        button.title = isCollapsed ? "展開" : "收起";
        button.setAttribute("aria-expanded", String(!isCollapsed));
      };
      if (collapsed[id]) card.classList.add("is-collapsed");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        card.classList.toggle("is-collapsed");
        const next = safeParse(STORAGE.collapsed, {});
        next[id] = card.classList.contains("is-collapsed");
        localStorage.setItem(STORAGE.collapsed, JSON.stringify(next));
        render();
      });
      if (existing) actions.append(existing);
      actions.append(button);
      head.append(actions);
      render();
    });
  }

  function installRobotDrag() {
    const robot = $("#robotButton");
    if (!robot || robot.dataset.draggableRobot) return;
    robot.dataset.draggableRobot = "true";
    const saved = safeParse(STORAGE.robot, null);
    const applySaved = () => {
      const top = Math.min(window.innerHeight - 70, Math.max(70, saved?.top ?? window.innerHeight - 110));
      const side = saved?.side === "left" ? "left" : "right";
      robot.style.top = `${top}px`;
      robot.style.bottom = "auto";
      robot.style.left = side === "left" ? "10px" : "auto";
      robot.style.right = side === "right" ? "10px" : "auto";
    };
    applySaved();

    let drag = null;
    robot.addEventListener("pointerdown", (event) => {
      drag = { startX: event.clientX, startY: event.clientY, left: robot.getBoundingClientRect().left, top: robot.getBoundingClientRect().top, moved: false };
      robot.setPointerCapture(event.pointerId);
      robot.classList.add("is-dragging");
      event.preventDefault();
    });
    robot.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 5;
      const left = Math.min(window.innerWidth - robot.offsetWidth - 8, Math.max(8, drag.left + dx));
      const top = Math.min(window.innerHeight - robot.offsetHeight - 8, Math.max(60, drag.top + dy));
      robot.style.left = `${left}px`;
      robot.style.right = "auto";
      robot.style.top = `${top}px`;
      robot.style.bottom = "auto";
    });
    robot.addEventListener("pointerup", (event) => {
      if (!drag) return;
      const rect = robot.getBoundingClientRect();
      const side = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
      const top = Math.min(window.innerHeight - rect.height - 8, Math.max(60, rect.top));
      robot.style.left = side === "left" ? "10px" : "auto";
      robot.style.right = side === "right" ? "10px" : "auto";
      robot.style.top = `${top}px`;
      robot.classList.remove("is-dragging");
      localStorage.setItem(STORAGE.robot, JSON.stringify({ side, top }));
      const moved = drag.moved;
      drag = null;
      if (moved) event.stopImmediatePropagation();
    });
  }

  function createWorkspace() {
    if ($("#workspaceShell")) return;
    const shell = document.createElement("section");
    shell.id = "workspaceShell";
    shell.className = "workspace-shell";
    shell.hidden = true;
    shell.innerHTML = `
      <header class="workspace-topbar">
        <strong>Bubble Workspace</strong>
        <div class="workspace-actions">
          <button type="button" data-open-app="notes">＋ 筆記</button>
          <button type="button" data-open-app="youtube">＋ YouTube</button>
          <button type="button" data-open-app="web">＋ 網頁</button>
          <button class="workspace-close" type="button" data-close-workspace>離開工作區</button>
        </div>
      </header>
      <div class="workspace-desktop" data-workspace-desktop></div>
      <div class="workspace-taskbar" data-workspace-taskbar></div>`;
    document.body.append(shell);

    const desktop = $("[data-workspace-desktop]", shell);
    const taskbar = $("[data-workspace-taskbar]", shell);
    let windows = safeParse(STORAGE.windows, []);
    let zCounter = Math.max(10, ...windows.map((item) => item.z || 10));

    const save = () => localStorage.setItem(STORAGE.windows, JSON.stringify(windows));
    const find = (id) => windows.find((item) => item.id === id);
    const focus = (id) => { const item = find(id); if (!item) return; item.z = ++zCounter; save(); render(); };

    function defaultContent(type) {
      if (type === "notes") return { text: "" };
      if (type === "youtube") return { videoId: "dQw4w9WgXcQ" };
      return {};
    }
    function titleFor(type) { return type === "notes" ? "筆記" : type === "youtube" ? "YouTube" : "一般網頁"; }
    function addWindow(type) {
      const offset = windows.length * 26;
      windows.push({ id: `w-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, title: titleFor(type), x: 90 + offset % 280, y: 70 + offset % 180, width: type === "youtube" ? 700 : 520, height: type === "youtube" ? 440 : 380, z: ++zCounter, minimized: false, maximized: false, content: defaultContent(type) });
      save(); render();
    }
    function closeWindow(id) { windows = windows.filter((item) => item.id !== id); save(); render(); }
    function toggleMinimize(id) { const item = find(id); if (!item) return; item.minimized = !item.minimized; save(); render(); }
    function toggleMaximize(id) { const item = find(id); if (!item) return; item.maximized = !item.maximized; item.minimized = false; save(); render(); }

    function windowContent(item) {
      if (item.type === "notes") return `<textarea data-note-id="${item.id}" placeholder="在這裡輸入筆記…"></textarea>`;
      if (item.type === "youtube") return `<div class="youtube-pane"><form class="youtube-form" data-youtube-form="${item.id}"><input value="${item.content.videoId || ""}" placeholder="貼上 YouTube 網址或影片 ID"><button>載入</button></form><iframe src="https://www.youtube.com/embed/${encodeURIComponent(item.content.videoId || "")}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
      return `<div class="web-placeholder"><div><h3>一般網頁工具</h3><p>部分網站會因 X-Frame-Options 或 CSP 禁止嵌入。下一階段會加入網址列與錯誤頁面。</p></div></div>`;
    }

    function render() {
      desktop.innerHTML = windows.map((item) => `
        <article class="desktop-window ${item.minimized ? "minimized" : ""} ${item.maximized ? "maximized" : ""}" data-window-id="${item.id}" style="left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px;z-index:${item.z}">
          <div class="window-titlebar" data-window-drag="${item.id}"><strong>${item.title}</strong><div class="window-controls"><button data-window-min="${item.id}">—</button><button data-window-max="${item.id}">□</button><button data-window-close="${item.id}">×</button></div></div>
          <div class="window-content">${windowContent(item)}</div>
        </article>`).join("");
      taskbar.innerHTML = windows.map((item) => `<button type="button" data-task-window="${item.id}">${item.minimized ? "▣ " : ""}${item.title}</button>`).join("");

      $$('[data-window-id]', desktop).forEach((element) => {
        const id = element.dataset.windowId;
        element.addEventListener("pointerdown", () => focus(id));
        const observer = new ResizeObserver(() => {
          const item = find(id); if (!item || item.maximized || item.minimized) return;
          item.width = element.offsetWidth; item.height = element.offsetHeight; save();
        });
        observer.observe(element);
      });
      $$('[data-window-close]', desktop).forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); closeWindow(button.dataset.windowClose); }));
      $$('[data-window-min]', desktop).forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); toggleMinimize(button.dataset.windowMin); }));
      $$('[data-window-max]', desktop).forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); toggleMaximize(button.dataset.windowMax); }));
      $$('[data-task-window]', taskbar).forEach((button) => button.addEventListener("click", () => { const item = find(button.dataset.taskWindow); if (!item) return; item.minimized = false; item.z = ++zCounter; save(); render(); }));
      $$('[data-note-id]', desktop).forEach((textarea) => { const item = find(textarea.dataset.noteId); textarea.value = item?.content.text || ""; textarea.addEventListener("input", () => { item.content.text = textarea.value; save(); }); });
      $$('[data-youtube-form]', desktop).forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const item = find(form.dataset.youtubeForm); const raw = $("input", form).value.trim(); const match = raw.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/) || raw.match(/^([\w-]{6,})$/); item.content.videoId = match?.[1] || raw; save(); render(); }));
      installWindowDrag();
    }

    function installWindowDrag() {
      $$('[data-window-drag]', desktop).forEach((bar) => {
        let drag = null;
        bar.addEventListener("pointerdown", (event) => {
          if (event.target.closest("button")) return;
          const item = find(bar.dataset.windowDrag); if (!item || item.maximized) return;
          const win = bar.closest(".desktop-window");
          drag = { sx: event.clientX, sy: event.clientY, x: item.x, y: item.y, win };
          bar.setPointerCapture(event.pointerId);
          focus(item.id);
        });
        bar.addEventListener("pointermove", (event) => {
          if (!drag) return;
          const item = find(bar.dataset.windowDrag); if (!item) return;
          item.x = Math.max(0, Math.min(desktop.clientWidth - 120, drag.x + event.clientX - drag.sx));
          item.y = Math.max(0, Math.min(desktop.clientHeight - 42, drag.y + event.clientY - drag.sy));
          drag.win.style.left = `${item.x}px`; drag.win.style.top = `${item.y}px`;
        });
        bar.addEventListener("pointerup", () => { if (!drag) return; drag = null; save(); });
      });
    }

    $$('[data-open-app]', shell).forEach((button) => button.addEventListener("click", () => addWindow(button.dataset.openApp)));
    $("[data-close-workspace]", shell).addEventListener("click", () => { shell.hidden = true; document.body.classList.remove("workspace-open"); });
    shell.openWorkspace = () => { shell.hidden = false; document.body.classList.add("workspace-open"); render(); };
    render();
  }

  function installWorkspaceLauncher() {
    createWorkspace();
    const nav = $("#memberNav");
    if (!nav || $("[data-open-workspace]", nav)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-button workspace-launcher";
    button.dataset.openWorkspace = "";
    button.innerHTML = `<span aria-hidden="true">▦</span><span>桌面工作區</span><span aria-hidden="true">›</span>`;
    button.addEventListener("click", () => { $("#workspaceShell").openWorkspace(); $("#drawerClose")?.click(); });
    nav.append(button);
  }

  function initialize() {
    installBackgroundSettings();
    installCardCollapse();
    installRobotDrag();
    installWorkspaceLauncher();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
