(() => {
  "use strict";

  const LEGACY_KEY = "bubble-background-music";
  const MUSIC_KEY = "bubble-background-music-v2";
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
      console.warn("Bubble Space 音樂設定保存失敗", error);
    }
  }

  const synth = (() => {
    let context = null;
    let master = null;
    let activePreset = "none";
    let loopGeneration = 0;
    const nodes = new Set();
    const timers = new Set();
    const noiseBuffers = new Map();

    function ensureContext() {
      if (context) return context;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      return context;
    }

    function track(node) {
      nodes.add(node);
      node.addEventListener?.("ended", () => {
        nodes.delete(node);
        try { node.disconnect?.(); } catch {}
      }, { once: true });
      return node;
    }

    function stopAllNodes() {
      nodes.forEach((node) => {
        try { node.stop?.(); } catch {}
        try { node.disconnect?.(); } catch {}
      });
      nodes.clear();
    }

    function clearAllTimers() {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    }

    function setVolume(volume) {
      const ctx = ensureContext();
      if (!ctx || !master) return;
      const normalized = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
      const target = normalized * 0.16;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.08);
    }

    function getNoiseBuffer(kind = "white", seconds = 2) {
      const ctx = ensureContext();
      if (!ctx) return null;
      const key = `${kind}-${seconds}`;
      if (noiseBuffers.has(key)) return noiseBuffers.get(key);

      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let index = 0; index < data.length; index += 1) {
        const white = Math.random() * 2 - 1;
        if (kind === "brown") {
          previous = (previous + white * 0.02) / 1.02;
          data[index] = previous * 3.1;
        } else {
          data[index] = white;
        }
      }
      noiseBuffers.set(key, buffer);
      return buffer;
    }

    function scheduleTone(frequency, start, duration, options = {}) {
      const ctx = ensureContext();
      if (!ctx || activePreset === "none") return;
      const oscillator = track(ctx.createOscillator());
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      oscillator.type = options.type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      filter.type = "lowpass";
      filter.frequency.value = options.filter || 2800;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, options.gain || 0.08),
        start + (options.attack || 0.025)
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(filter).connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.04);
    }

    function scheduleNoiseHit(start, duration, frequency, gainValue) {
      const ctx = ensureContext();
      if (!ctx || activePreset === "none") return;
      const source = track(ctx.createBufferSource());
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      source.buffer = getNoiseBuffer("white", 1);
      filter.type = "highpass";
      filter.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      source.connect(filter).connect(gain).connect(master);
      source.start(start);
      source.stop(start + duration + 0.03);
    }

    function scheduleKick(start) {
      const ctx = ensureContext();
      if (!ctx || activePreset !== "rock") return;
      const oscillator = track(ctx.createOscillator());
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(145, start);
      oscillator.frequency.exponentialRampToValueAtTime(42, start + 0.18);
      gain.gain.setValueAtTime(0.55, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.24);
    }

    function startFocus() {
      const ctx = ensureContext();
      if (!ctx) return;
      [174, 261.63, 329.63].forEach((frequency, index) => {
        const oscillator = track(ctx.createOscillator());
        const gain = ctx.createGain();
        oscillator.type = index === 0 ? "sine" : "triangle";
        oscillator.frequency.value = frequency;
        gain.gain.value = index === 0 ? 0.22 : 0.065;
        oscillator.connect(gain).connect(master);
        oscillator.start();
      });
    }

    function startNoise(preset) {
      const ctx = ensureContext();
      if (!ctx) return;
      const source = track(ctx.createBufferSource());
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      source.loop = true;
      source.buffer = getNoiseBuffer(preset === "rain" ? "white" : "brown", 4);
      filter.type = "lowpass";
      filter.frequency.value = preset === "rain" ? 3300 : 820;
      filter.Q.value = preset === "rain" ? 0.42 : 0.28;
      gain.gain.value = preset === "rain" ? 0.68 : 0.8;

      source.connect(filter).connect(gain).connect(master);
      source.start();
    }

    function scheduleRecurringBar(preset, interval, drawBar) {
      const generation = loopGeneration;
      const run = (barIndex = 0) => {
        if (activePreset !== preset || generation !== loopGeneration) return;
        drawBar(barIndex);
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          run(barIndex + 1);
        }, interval);
        timers.add(timer);
      };
      run();
    }

    function startLightMusic() {
      scheduleRecurringBar("light", 3600, (barIndex) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.06;
        const chords = [
          [261.63, 329.63, 392.0],
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [196.0, 246.94, 293.66]
        ];
        const chord = chords[barIndex % chords.length];
        const pattern = [0, 1, 2, 1, 0, 1, 2, 1];

        scheduleTone(chord[0] / 2, start, 3.85, {
          type: "sine",
          gain: 0.045,
          attack: 0.2,
          filter: 1200
        });
        pattern.forEach((noteIndex, step) => {
          scheduleTone(chord[noteIndex], start + step * 0.48, 0.43, {
            type: step % 2 ? "triangle" : "sine",
            gain: 0.095,
            attack: 0.035,
            filter: 2400
          });
        });
      });
    }

    function startRockMusic() {
      scheduleRecurringBar("rock", 1750, (barIndex) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.06;
        const beat = 0.5;
        const roots = [82.41, 98.0, 110.0, 73.42];
        const root = roots[barIndex % roots.length];

        for (let step = 0; step < 8; step += 1) {
          scheduleNoiseHit(start + step * beat / 2, 0.055, 6200, step % 2 ? 0.07 : 0.11);
        }
        [0, 2].forEach((beatIndex) => scheduleKick(start + beatIndex * beat));
        [1, 3].forEach((beatIndex) => {
          scheduleNoiseHit(start + beatIndex * beat, 0.16, 1500, 0.2);
          scheduleTone(180, start + beatIndex * beat, 0.12, {
            type: "triangle",
            gain: 0.05,
            filter: 1800
          });
        });
        for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
          scheduleTone(root * (beatIndex === 3 ? 1.5 : 1), start + beatIndex * beat, 0.38, {
            type: "sawtooth",
            gain: 0.105,
            attack: 0.015,
            filter: 760
          });
        }
      });
    }

    function stop() {
      activePreset = "none";
      loopGeneration += 1;
      clearAllTimers();
      stopAllNodes();
      if (master && context) {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.linearRampToValueAtTime(0, context.currentTime + 0.06);
      }
    }

    async function play(preset, volume) {
      stop();
      activePreset = preset || "none";
      if (activePreset === "none") return true;

      const ctx = ensureContext();
      if (!ctx) return false;
      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {
        activePreset = "none";
        return false;
      }
      setVolume(volume);

      if (activePreset === "focus") startFocus();
      else if (activePreset === "rain" || activePreset === "night") startNoise(activePreset);
      else if (activePreset === "light") startLightMusic();
      else if (activePreset === "rock") startRockMusic();
      return true;
    }

    return {
      play,
      stop,
      setVolume,
      get activePreset() { return activePreset; }
    };
  })();

  function installMusicV2() {
    const shell = $("#settingsDialog .settings-shell");
    if (!shell || $("[data-music-settings-v2]", shell)) return false;

    const legacySaved = readJson(LEGACY_KEY, { preset: "none", volume: 35 });
    const saved = readJson(MUSIC_KEY, legacySaved);
    const legacySection = $("[data-music-settings]", shell);
    const legacySelect = legacySection && $("[data-music-preset]", legacySection);

    if (legacySelect) {
      legacySelect.value = "none";
      legacySelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    writeJson(LEGACY_KEY, { preset: "none", volume: Number(saved.volume) || 35 });
    legacySection?.remove();

    const section = document.createElement("section");
    section.className = "settings-section music-settings-v2";
    section.dataset.musicSettingsV2 = "";
    section.innerHTML = `
      <div class="settings-row">
        <h3>背景音樂</h3>
        <span class="music-v2-badge" aria-hidden="true">♫</span>
      </div>
      <div class="music-setting-grid">
        <label class="music-field">
          <span>音樂類型</span>
          <select data-music-v2-preset>
            <option value="none">不要播放</option>
            <option value="light">輕音樂</option>
            <option value="rock">搖滾節奏</option>
            <option value="focus">柔和專注</option>
            <option value="rain">細雨白噪音</option>
            <option value="night">深夜低頻</option>
          </select>
        </label>
        <label class="music-field">
          <span>音量</span>
          <div class="music-volume-row">
            <input data-music-v2-volume type="range" min="0" max="100" step="5" value="35" />
            <output data-music-v2-volume-value>35%</output>
          </div>
        </label>
      </div>
      <p class="music-preset-description" data-music-v2-description></p>
      <p class="music-status" data-music-v2-status>目前未播放背景音樂。</p>`;
    shell.append(section);

    const preset = $("[data-music-v2-preset]", section);
    const volume = $("[data-music-v2-volume]", section);
    const volumeValue = $("[data-music-v2-volume-value]", section);
    const description = $("[data-music-v2-description]", section);
    const status = $("[data-music-v2-status]", section);
    const descriptions = {
      none: "關閉所有背景聲音。",
      light: "由瀏覽器即時產生的柔和旋律與和弦，適合閱讀或整理事項。",
      rock: "由瀏覽器即時產生的鼓點、貝斯與節奏音色，適合需要提振精神時使用。",
      focus: "持續、平穩的和聲音景。",
      rain: "細雨感白噪音，可遮蔽環境雜音。",
      night: "較沉穩的低頻環境音。"
    };
    const names = {
      none: "不要播放",
      light: "輕音樂",
      rock: "搖滾節奏",
      focus: "柔和專注",
      rain: "細雨白噪音",
      night: "深夜低頻"
    };

    preset.value = names[saved.preset] ? saved.preset : "none";
    volume.value = String(Number.isFinite(Number(saved.volume)) ? Number(saved.volume) : 35);
    volumeValue.textContent = `${volume.value}%`;

    const persist = () => writeJson(MUSIC_KEY, {
      preset: preset.value,
      volume: Number(volume.value)
    });

    const refreshText = (playing = false) => {
      description.textContent = descriptions[preset.value] || descriptions.none;
      if (preset.value === "none") {
        status.textContent = "目前未播放背景音樂。";
      } else if (playing) {
        status.textContent = `正在播放：${names[preset.value]}。`;
      } else {
        status.textContent = `已選擇：${names[preset.value]}。瀏覽器可能需要你先點一下頁面才允許播放。`;
      }
    };

    preset.addEventListener("change", async () => {
      persist();
      if (preset.value === "none") {
        synth.stop();
        refreshText(false);
        return;
      }
      const playing = await synth.play(preset.value, Number(volume.value));
      refreshText(playing);
    });

    volume.addEventListener("input", () => {
      volumeValue.textContent = `${volume.value}%`;
      persist();
      synth.setVolume(Number(volume.value));
    });

    refreshText(false);

    const resume = async () => {
      const current = readJson(MUSIC_KEY, { preset: "none", volume: 35 });
      if (current.preset && current.preset !== "none" && synth.activePreset === "none") {
        const playing = await synth.play(current.preset, Number(current.volume));
        preset.value = names[current.preset] ? current.preset : "none";
        volume.value = String(Number(current.volume) || 35);
        volumeValue.textContent = `${volume.value}%`;
        refreshText(playing);
      }
    };
    document.addEventListener("pointerdown", resume, { once: true, capture: true });
    document.addEventListener("keydown", resume, { once: true, capture: true });
    return true;
  }

  function begin() {
    if (!installMusicV2()) {
      const observer = new MutationObserver(() => {
        if (installMusicV2()) observer.disconnect();
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
