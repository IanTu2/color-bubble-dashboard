(() => {
  "use strict";

  if (window.__BUBBLE_WORKSPACE_LEARNING_V2__) return;
  window.__BUBBLE_WORKSPACE_LEARNING_V2__ = true;

  const SEARCH_STATE_KEY = "bubble-workspace-search-state-v2";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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
      console.warn("Bubble Space 搜尋狀態保存失敗", error);
    }
  }

  function searchTarget(query, engine) {
    const value = String(query || "").trim();
    if (!value) return "";
    const encoded = encodeURIComponent(value);
    const targets = {
      google: `https://www.google.com/search?q=${encoded}`,
      duckduckgo: `https://duckduckgo.com/?q=${encoded}`,
      bing: `https://www.bing.com/search?q=${encoded}`,
      youtube: `https://www.youtube.com/results?search_query=${encoded}`
    };
    return targets[engine] || targets.google;
  }

  function announceSearch(pane, text) {
    const status = $("[data-window-search-status]", pane);
    if (!status) return;
    status.textContent = text;
    window.setTimeout(() => {
      if (status.textContent === text) status.textContent = "輸入關鍵字後按 Enter 或搜尋。";
    }, 2400);
  }

  function enhanceSearchWindow(windowElement) {
    if (!windowElement || windowElement.dataset.searchWindowV2 === "true") return;

    const titleNode = $(".window-titlebar strong", windowElement);
    const title = titleNode?.textContent?.trim() || "";
    const isYouTube = title === "YouTube" || title === "YouTube 搜尋";
    const isWeb = title === "一般網頁" || title === "網頁搜尋";
    if (!isYouTube && !isWeb) return;

    const content = $(".window-content", windowElement);
    if (!content) return;

    windowElement.dataset.searchWindowV2 = "true";
    const id = windowElement.dataset.windowId || `window-${Date.now()}`;
    const state = readJson(SEARCH_STATE_KEY, {});
    const saved = state[id] || {};

    if (titleNode) titleNode.textContent = isYouTube ? "YouTube 搜尋" : "網頁搜尋";

    content.innerHTML = `
      <div class="workspace-window-search ${isYouTube ? "youtube-search-window" : "web-search-window"}">
        <div class="workspace-search-intro">
          <span class="workspace-search-icon" aria-hidden="true">${isYouTube ? "▶" : "⌕"}</span>
          <div>
            <h3>${isYouTube ? "搜尋 YouTube" : "搜尋網路"}</h3>
            <p>${isYouTube ? "直接輸入影片主題、歌名或頻道名稱。" : "直接輸入關鍵字，不需要貼網站網址。"}</p>
          </div>
        </div>
        <form class="workspace-window-search-form" data-window-search-form>
          ${isYouTube ? "" : `
            <select data-window-search-engine aria-label="搜尋引擎">
              <option value="google">Google</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="bing">Bing</option>
            </select>`}
          <input
            type="search"
            data-window-search-input
            autocomplete="off"
            placeholder="${isYouTube ? "例如：JavaScript 教學、輕音樂" : "例如：台北天氣、Spring Boot 教學"}"
            aria-label="搜尋關鍵字"
          />
          <button type="submit">搜尋</button>
        </form>
        <p class="workspace-window-search-status" data-window-search-status aria-live="polite">輸入關鍵字後按 Enter 或搜尋。</p>
        <div class="workspace-search-empty" aria-hidden="true">
          <span>${isYouTube ? "影片搜尋" : "網路搜尋"}</span>
          <small>搜尋結果會在新的瀏覽器分頁開啟，避免網站禁止嵌入造成空白。</small>
        </div>
      </div>`;

    const pane = $(".workspace-window-search", content);
    const form = $("[data-window-search-form]", pane);
    const input = $("[data-window-search-input]", pane);
    const engineSelect = $("[data-window-search-engine]", pane);

    input.value = saved.query || "";
    if (engineSelect) engineSelect.value = saved.engine || "google";

    const persist = () => {
      const next = readJson(SEARCH_STATE_KEY, {});
      next[id] = {
        query: input.value,
        engine: isYouTube ? "youtube" : (engineSelect?.value || "google")
      };
      writeJson(SEARCH_STATE_KEY, next);
    };

    input.addEventListener("input", persist);
    engineSelect?.addEventListener("change", persist);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selectedEngine = isYouTube ? "youtube" : (engineSelect?.value || "google");
      const target = searchTarget(input.value, selectedEngine);
      if (!target) {
        input.setCustomValidity("請輸入要搜尋的關鍵字");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      persist();
      window.open(target, "_blank", "noopener,noreferrer");
      announceSearch(pane, `已開啟${isYouTube ? " YouTube" : "網路"}搜尋結果。`);
    });
  }

  function enhanceAllSearchWindows(root = document) {
    root.querySelectorAll?.(".desktop-window").forEach(enhanceSearchWindow);
  }

  function languageText() {
    const english = document.documentElement.lang?.toLowerCase().startsWith("en");
    return english ? {
      drawerEnglish: "English",
      title: "English Learning",
      subtitle: "Choose a clean learning space to begin.",
      vocabulary: "Vocabulary",
      vocabularyText: "Build and review your vocabulary collection.",
      game: "Games",
      gameText: "Practice English through short interactive activities.",
      back: "Back",
      close: "Return home",
      reserved: "This area is ready for the next content update.",
      choose: "Choose a learning area"
    } : {
      drawerEnglish: "英文",
      title: "英文學習",
      subtitle: "選擇一個乾淨的學習空間開始。",
      vocabulary: "單字",
      vocabularyText: "建立、複習並整理你的英文單字。",
      game: "遊戲",
      gameText: "透過短篇互動活動練習英文。",
      back: "返回選擇",
      close: "回到首頁",
      reserved: "此區已完成桌面骨架，下一階段加入正式內容。",
      choose: "選擇學習區"
    };
  }

  function createLearningDesktop() {
    if ($("#englishLearningDesktop")) return $("#englishLearningDesktop");

    const shell = document.createElement("section");
    shell.id = "englishLearningDesktop";
    shell.className = "learning-desktop";
    shell.hidden = true;
    shell.innerHTML = `
      <header class="learning-desktop-topbar">
        <div class="learning-desktop-brand">
          <span class="learning-desktop-mark" aria-hidden="true">A</span>
          <div>
            <small>LEARNING SPACE</small>
            <strong data-learning-title></strong>
          </div>
        </div>
        <button type="button" class="learning-desktop-close" data-close-learning></button>
      </header>
      <main class="learning-desktop-main">
        <section class="learning-home" data-learning-home>
          <div class="learning-hero-clean">
            <span class="learning-kicker">ENGLISH</span>
            <h1 data-learning-heading></h1>
            <p data-learning-subtitle></p>
          </div>
          <div class="learning-choice-grid" aria-label="英文學習選擇">
            <button type="button" class="learning-choice-card" data-learning-choice="vocabulary">
              <span class="learning-choice-icon" aria-hidden="true">Aa</span>
              <strong data-choice-vocabulary></strong>
              <p data-choice-vocabulary-text></p>
              <span class="learning-choice-arrow" aria-hidden="true">→</span>
            </button>
            <button type="button" class="learning-choice-card" data-learning-choice="game">
              <span class="learning-choice-icon" aria-hidden="true">◆</span>
              <strong data-choice-game></strong>
              <p data-choice-game-text></p>
              <span class="learning-choice-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>
        <section class="learning-content-view" data-learning-content hidden>
          <button type="button" class="learning-back-button" data-learning-back>← <span></span></button>
          <div class="learning-content-placeholder">
            <span class="learning-content-icon" data-learning-content-icon aria-hidden="true"></span>
            <p class="learning-kicker">ENGLISH SPACE</p>
            <h2 data-learning-content-title></h2>
            <p data-learning-content-description></p>
            <div class="learning-reserved" data-learning-reserved></div>
          </div>
        </section>
      </main>`;
    document.body.append(shell);

    const renderLanguage = () => {
      const text = languageText();
      $("[data-learning-title]", shell).textContent = text.title;
      $("[data-learning-heading]", shell).textContent = text.choose;
      $("[data-learning-subtitle]", shell).textContent = text.subtitle;
      $("[data-choice-vocabulary]", shell).textContent = text.vocabulary;
      $("[data-choice-vocabulary-text]", shell).textContent = text.vocabularyText;
      $("[data-choice-game]", shell).textContent = text.game;
      $("[data-choice-game-text]", shell).textContent = text.gameText;
      $("[data-close-learning]", shell).textContent = text.close;
      $("[data-learning-back] span", shell).textContent = text.back;
      $("[data-learning-reserved]", shell).textContent = text.reserved;
    };

    const showHome = () => {
      $("[data-learning-home]", shell).hidden = false;
      $("[data-learning-content]", shell).hidden = true;
    };

    const showChoice = (choice) => {
      const text = languageText();
      const vocabulary = choice === "vocabulary";
      $("[data-learning-home]", shell).hidden = true;
      $("[data-learning-content]", shell).hidden = false;
      $("[data-learning-content-icon]", shell).textContent = vocabulary ? "Aa" : "◆";
      $("[data-learning-content-title]", shell).textContent = vocabulary ? text.vocabulary : text.game;
      $("[data-learning-content-description]", shell).textContent = vocabulary ? text.vocabularyText : text.gameText;
    };

    shell.openLearningDesktop = () => {
      $("#drawerClose")?.click();
      $("#rightToolsDrawer .right-tools-close")?.click();
      $("#workspaceShell [data-close-workspace]")?.click();
      renderLanguage();
      showHome();
      shell.hidden = false;
      document.body.classList.add("learning-desktop-open");
    };

    shell.closeLearningDesktop = () => {
      shell.hidden = true;
      document.body.classList.remove("learning-desktop-open");
      showHome();
    };

    $("[data-close-learning]", shell).addEventListener("click", shell.closeLearningDesktop);
    $("[data-learning-back]", shell).addEventListener("click", showHome);
    $$('[data-learning-choice]', shell).forEach((button) => {
      button.addEventListener("click", () => showChoice(button.dataset.learningChoice));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !shell.hidden) shell.closeLearningDesktop();
    });

    new MutationObserver(renderLanguage).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"]
    });

    renderLanguage();
    return shell;
  }

  function installLearningNav() {
    const nav = $("#memberNav");
    if (!nav) return false;
    if ($("[data-open-english-learning]", nav)) return true;

    const englishSummary = $("summary [data-i18n='english']", nav)?.closest("summary");
    const englishAccordion = englishSummary?.closest("details.nav-accordion.nested");
    if (!englishAccordion) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-single english-learning-entry";
    button.dataset.openEnglishLearning = "";
    button.innerHTML = `<span data-english-entry-label>英文</span><span class="english-entry-arrow" aria-hidden="true">›</span>`;
    englishAccordion.replaceWith(button);

    const shell = createLearningDesktop();
    button.addEventListener("click", () => shell.openLearningDesktop());

    const syncLabel = () => {
      $("[data-english-entry-label]", button).textContent = languageText().drawerEnglish;
    };
    syncLabel();
    new MutationObserver(syncLabel).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"]
    });
    return true;
  }

  function begin() {
    createLearningDesktop();
    installLearningNav();
    enhanceAllSearchWindows();

    const observer = new MutationObserver((mutations) => {
      installLearningNav();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(".desktop-window")) enhanceSearchWindow(node);
          enhanceAllSearchWindows(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
})();
