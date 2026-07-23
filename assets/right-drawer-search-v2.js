(() => {
  "use strict";

  const RIGHT_DRAWER_KEY = "bubble-right-tools-open";
  const COLLAPSED_KEY = "bubble-collapsed-cards";
  const $ = (selector, root = document) => root.querySelector(selector);

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
      console.warn("Bubble Space 設定保存失敗", error);
    }
  }

  function resetIndividualCardCollapse(dashboard) {
    const state = readJson(COLLAPSED_KEY, {});
    ["calendarCard", "todoCard"].forEach((id) => {
      delete state[id];
      const card = document.getElementById(id);
      if (!card) return;
      card.classList.remove("is-collapsed");
      card.style.removeProperty("height");
      card.style.removeProperty("overflow");
      card.style.removeProperty("--collapsed-card-height");
      const collapseButton = card.querySelector("[data-collapse-card]");
      if (collapseButton) collapseButton.hidden = true;
    });
    writeJson(COLLAPSED_KEY, state);
    dashboard.classList.add("right-tools-mounted");
  }

  function installRightToolsDrawer() {
    const dashboard = $("#memberDashboard");
    if (!dashboard || $("#rightToolsDrawer")) return;

    const trigger = document.createElement("button");
    trigger.id = "rightToolsTrigger";
    trigger.className = "right-tools-trigger";
    trigger.type = "button";
    trigger.hidden = true;
    trigger.setAttribute("aria-label", "開啟月曆與待辦事項");
    trigger.setAttribute("aria-controls", "rightToolsDrawer");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
      <span class="right-tools-arrow" aria-hidden="true">‹</span>
      <span></span><span></span><span></span>`;

    const drawer = document.createElement("aside");
    drawer.id = "rightToolsDrawer";
    drawer.className = "right-tools-drawer";
    drawer.setAttribute("aria-label", "月曆與待辦事項");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="right-tools-head">
        <div class="right-tools-title">
          <span class="right-tools-title-mark" aria-hidden="true">▦</span>
          <div>
            <h2>行程工具</h2>
            <p>月曆與待辦事項</p>
          </div>
        </div>
        <button class="right-tools-close" type="button" aria-label="關閉月曆與待辦事項">×</button>
      </div>
      <div class="right-tools-body"></div>`;

    const backdrop = document.createElement("button");
    backdrop.id = "rightToolsBackdrop";
    backdrop.className = "right-tools-backdrop";
    backdrop.type = "button";
    backdrop.hidden = true;
    backdrop.setAttribute("aria-label", "關閉月曆與待辦事項");

    document.body.append(trigger, backdrop, drawer);
    $(".right-tools-body", drawer).append(dashboard);
    resetIndividualCardCollapse(dashboard);

    const closeDrawer = ({ remember = true } = {}) => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      trigger.setAttribute("aria-expanded", "false");
      trigger.querySelector(".right-tools-arrow").textContent = "‹";
      backdrop.hidden = true;
      document.body.classList.remove("right-tools-open");
      if (remember) sessionStorage.setItem(RIGHT_DRAWER_KEY, "closed");
    };

    const openDrawer = () => {
      if (dashboard.hidden) return;
      $("#drawerClose")?.click();
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      trigger.setAttribute("aria-expanded", "true");
      trigger.querySelector(".right-tools-arrow").textContent = "›";
      backdrop.hidden = false;
      document.body.classList.add("right-tools-open");
      sessionStorage.setItem(RIGHT_DRAWER_KEY, "open");
    };

    trigger.addEventListener("click", () => {
      if (drawer.classList.contains("open")) closeDrawer();
      else openDrawer();
    });
    $(".right-tools-close", drawer).addEventListener("click", () => closeDrawer());
    backdrop.addEventListener("click", () => closeDrawer());
    $("#drawerTrigger")?.addEventListener("click", () => closeDrawer({ remember: false }));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
    });

    const syncVisibility = () => {
      const signedInView = !dashboard.hidden;
      trigger.hidden = !signedInView;
      if (!signedInView) {
        closeDrawer({ remember: false });
        return;
      }
      resetIndividualCardCollapse(dashboard);
    };

    new MutationObserver(syncVisibility).observe(dashboard, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
    syncVisibility();
  }

  function normalizeSearchTarget(raw, engine) {
    const value = String(raw || "").trim();
    if (!value) return "";

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
      } catch {
        return "";
      }
    }

    const encoded = encodeURIComponent(value);
    const engines = {
      google: `https://www.google.com/search?q=${encoded}`,
      duckduckgo: `https://duckduckgo.com/?q=${encoded}`,
      bing: `https://www.bing.com/search?q=${encoded}`,
      youtube: `https://www.youtube.com/results?search_query=${encoded}`
    };
    return engines[engine] || engines.google;
  }

  function installWorkspaceSearch() {
    const topbar = $("#workspaceShell .workspace-topbar");
    if (!topbar || $(".workspace-search", topbar)) return false;

    const actions = $(".workspace-actions", topbar);
    const form = document.createElement("form");
    form.className = "workspace-search";
    form.setAttribute("role", "search");
    form.innerHTML = `
      <select aria-label="搜尋來源">
        <option value="google">Google</option>
        <option value="duckduckgo">DuckDuckGo</option>
        <option value="bing">Bing</option>
        <option value="youtube">YouTube</option>
      </select>
      <input type="search" autocomplete="off" placeholder="搜尋關鍵字，或貼上完整網址" aria-label="搜尋關鍵字或網址" />
      <button type="submit">搜尋</button>`;

    if (actions) topbar.insertBefore(form, actions);
    else topbar.append(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input", form);
      const engine = $("select", form).value;
      const target = normalizeSearchTarget(input.value, engine);
      if (!target) {
        input.setCustomValidity("請輸入搜尋文字或有效網址");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      window.open(target, "_blank", "noopener,noreferrer");

      $(".workspace-search-note", topbar)?.remove();
      const note = document.createElement("div");
      note.className = "workspace-search-note";
      note.textContent = "搜尋結果已在新分頁開啟";
      topbar.append(note);
      window.setTimeout(() => note.remove(), 1800);
    });

    return true;
  }

  function begin() {
    installRightToolsDrawer();
    if (!installWorkspaceSearch()) {
      const observer = new MutationObserver(() => {
        if (installWorkspaceSearch()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
})();
