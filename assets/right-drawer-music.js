(() => {
  "use strict";

  const RIGHT_DRAWER_KEY = "bubble-right-tools-open";
  const MUSIC_KEY = "bubble-background-music";
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

      const previous = $(".workspace-search-note", topbar);
      previous?.remove();
      const note = document.createElement("div");
      note.className = "workspace-search-note";
      note.textContent = "搜尋結果已在新分頁開啟";
      topbar.append(note);
      window.setTimeout(() => note.remove(), 1800);
    });

    return true;
  }

  const audioEngine = (() => {
    let context = null;
    let master = null;
    let activePreset = "none";
    let activeNodes = [];
    const bufferCache = new Map();

    function ensureContext() {
      if (!context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
      }
      return context;
    }

    function stopNodes() {
      activeNodes.forEach((node) => {
        try { node.stop?.(); } catch {}
        try { node.disconnect?.(); } catch {}
      });
      activeNodes = [];
    }

    function getNoiseBuffer(kind) {
      const ctx = ensureContext();
      if (!ctx) return null;
      if (bufferCache.has(kind)) return bufferCache.get(kind);

      const seconds = 4;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      if (kind === "brown") {
        let last = 0;
        for (let i = 0; i < data.length; i += 1) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.2;
        }
      } else {
        for (let i = 0; i < data.length; i += 1) {
          data[i] = Math.random() * 2 - 1;
        }
      }

      bufferCache.set(kind, buffer);
      return buffer;
    }

    function setVolume(volume) {
      const ctx = ensureContext();
      if (!ctx || !master) return;
      const normalized = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
      const target = normalized * 0.11;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.08);
    }

    async function play(preset, volume) {
      activePreset = preset || "none";
      const ctx = ensureContext();
      if (!ctx) return false;

      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {
        return false;
      }

      stopNodes();
      setVolume(volume);
      if (activePreset === "none") return true;

      if (activePreset === "focus") {
        const frequencies = [174, 261.63, 329.63];
        frequencies.forEach((frequency, index) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = index === 0 ? "sine" : "triangle";
          oscillator.frequency.value = frequency;
          gain.gain.value = index === 0 ? 0.24 : 0.08;
          oscillator.connect(gain).connect(master);
          oscillator.start();
          activeNodes.push(oscillator, gain);
        });
        return true;
      }

      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const localGain = ctx.createGain();
      source.loop = true;

      if (activePreset === "rain") {
        source.buffer = getNoiseBuffer("white");
        filter.type = "lowpass";
        filter.frequency.value = 3200;
        filter.Q.value = 0.45;
        localGain.gain.value = 0.72;
      } else {
        source.buffer = getNoiseBuffer("brown");
        filter.type = "lowpass";
        filter.frequency.value = 850;
        filter.Q.value = 0.3;
        localGain.gain.value = 0.82;
      }

      source.connect(filter).connect(localGain).connect(master);
      source.start();
      activeNodes.push(source, filter, localGain);
      return true;
    }

    function stop() {
      activePreset = "none";
      stopNodes();
      if (master && context) {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.linearRampToValueAtTime(0, context.currentTime + 0.06);
      }
    }

    return { play, stop, setVolume, get activePreset() { return activePreset; } };
  })();

  function installMusicSettings() {
    const shell = $("#settingsDialog .settings-shell");
    if (!shell || $("[data-music-settings]", shell)) return false;

    const saved = readJson(MUSIC_KEY, { preset: "none", volume: 35 });
    const section = document.createElement("section");
    section.className = "settings-section music-settings-section";
    section.dataset.musicSettings = "";
    section.innerHTML = `
      <div class="settings-row">
        <h3>背景音樂</h3>
        <span aria-hidden="true">♫</span>
      </div>
      <div class="music-setting-grid">
        <label class="music-field">
          <span>音景</span>
          <select data-music-preset>
            <option value="none">不要播放</option>
            <option value="focus">柔和專注</option>
            <option value="rain">細雨白噪音</option>
            <option value="night">深夜低頻</option>
          </select>
        </label>
        <label class="music-field">
          <span>音量</span>
          <div class="music-volume-row">
            <input data-music-volume type="range" min="0" max="100" step="5" value="35" />
            <output data-music-volume-value>35%</output>
          </div>
        </label>
      </div>
      <p class="music-status" data-music-status>目前未播放背景音樂。</p>`;
    shell.append(section);

    const presetSelect = $("[data-music-preset]", section);
    const volumeInput = $("[data-music-volume]", section);
    const volumeOutput = $("[data-music-volume-value]", section);
    const status = $("[data-music-status]", section);

    presetSelect.value = saved.preset || "none";
    volumeInput.value = String(Number.isFinite(Number(saved.volume)) ? Number(saved.volume) : 35);
    volumeOutput.textContent = `${volumeInput.value}%`;

    const presetNames = {
      none: "不要播放",
      focus: "柔和專注",
      rain: "細雨白噪音",
      night: "深夜低頻"
    };

    const saveState = () => {
      writeJson(MUSIC_KEY, {
        preset: presetSelect.value,
        volume: Number(volumeInput.value)
      });
    };

    const updateStatus = (playing = false) => {
      if (presetSelect.value === "none") {
        status.textContent = "目前未播放背景音樂。";
        return;
      }
      status.textContent = playing
        ? `正在播放：${presetNames[presetSelect.value]}。重新整理後，瀏覽器可能會要求你先點一下頁面才開始播放。`
        : `已選擇：${presetNames[presetSelect.value]}。點一下頁面後會開始播放。`;
    };

    presetSelect.addEventListener("change", async () => {
      saveState();
      if (presetSelect.value === "none") {
        audioEngine.stop();
        updateStatus(false);
        return;
      }
      const playing = await audioEngine.play(presetSelect.value, Number(volumeInput.value));
      updateStatus(playing);
    });

    volumeInput.addEventListener("input", () => {
      volumeOutput.textContent = `${volumeInput.value}%`;
      saveState();
      audioEngine.setVolume(Number(volumeInput.value));
    });

    updateStatus(false);
    return true;
  }

  function resumeSavedMusicOnInteraction() {
    const start = async () => {
      const saved = readJson(MUSIC_KEY, { preset: "none", volume: 35 });
      if (saved.preset && saved.preset !== "none") {
        await audioEngine.play(saved.preset, Number(saved.volume));
        const section = $("[data-music-settings]");
        const status = section && $("[data-music-status]", section);
        if (status) status.textContent = `正在播放背景音樂。可在設定中切換或關閉。`;
      }
    };
    document.addEventListener("pointerdown", start, { once: true, capture: true });
    document.addEventListener("keydown", start, { once: true, capture: true });
  }

  function begin() {
    installRightToolsDrawer();
    installMusicSettings();
    resumeSavedMusicOnInteraction();

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
