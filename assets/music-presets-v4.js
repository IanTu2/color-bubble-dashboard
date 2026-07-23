(() => {
  "use strict";

  if (window.__BUBBLE_MUSIC_V4__) return;
  window.__BUBBLE_MUSIC_V4__ = true;

  const LEGACY_KEY = "bubble-background-music";
  const MUSIC_KEY = "bubble-background-music-v2";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const PRESETS = {
    none: {
      name: "不要播放",
      description: "關閉所有背景聲音。"
    },
    light: {
      name: "輕音樂",
      description: "旋律、分解和弦與低音會交替變化，比原本更有段落感。"
    },
    piano: {
      name: "鋼琴",
      description: "溫和的鋼琴和弦、低音與旋律，適合閱讀、筆記和專注。"
    },
    musicbox: {
      name: "音樂盒",
      description: "清亮的音樂盒旋律搭配柔和低音，適合放鬆或安靜工作。"
    },
    rock: {
      name: "搖滾節奏",
      description: "鼓點、貝斯、節奏和弦與短旋律會輪替，不再只重複單一節拍。"
    },
    focus: {
      name: "柔和專注",
      description: "緩慢變化的和聲音景，適合長時間工作。"
    },
    rain: {
      name: "細雨白噪音",
      description: "帶有遠近層次的細雨聲，可遮蔽環境雜音。"
    },
    night: {
      name: "深夜低頻",
      description: "沉穩低頻搭配緩慢脈動，適合深夜使用。"
    }
  };

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

  const audio = (() => {
    let context = null;
    let master = null;
    let compressor = null;
    let activePreset = "none";
    let generation = 0;
    const nodes = new Set();
    const timers = new Set();
    const noiseBuffers = new Map();

    function ensureContext() {
      if (context) return context;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;

      context = new AudioContextClass();
      master = context.createGain();
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 20;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.28;
      master.gain.value = 0;
      master.connect(compressor).connect(context.destination);
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

    function clearTimers() {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    }

    function stopNodes() {
      nodes.forEach((node) => {
        try { node.stop?.(); } catch {}
        try { node.disconnect?.(); } catch {}
      });
      nodes.clear();
    }

    function stop() {
      activePreset = "none";
      generation += 1;
      clearTimers();
      stopNodes();
      if (master && context) {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(0, now, 0.03);
      }
    }

    function setVolume(volume) {
      const ctx = ensureContext();
      if (!ctx || !master) return;
      const normalized = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
      const target = normalized * 0.19;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(target, now, 0.035);
    }

    function noiseBuffer(kind = "white", seconds = 4) {
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
          previous = (previous + white * 0.022) / 1.022;
          data[index] = previous * 3.15;
        } else {
          data[index] = white;
        }
      }
      noiseBuffers.set(key, buffer);
      return buffer;
    }

    function tone(frequency, start, duration, options = {}) {
      const ctx = ensureContext();
      if (!ctx || activePreset === "none") return;

      const oscillator = track(ctx.createOscillator());
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      oscillator.type = options.type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.detune.setValueAtTime(options.detune || 0, start);
      filter.type = options.filterType || "lowpass";
      filter.frequency.setValueAtTime(options.filter || 3000, start);
      filter.Q.value = options.q || 0.35;

      const attack = Math.max(0.003, options.attack || 0.02);
      const peak = Math.max(0.0002, options.gain || 0.07);
      const releaseAt = Math.max(start + attack + 0.01, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt);

      oscillator.connect(filter).connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(releaseAt + 0.06);
    }

    function pianoNote(frequency, start, duration = 1.4, velocity = 1) {
      tone(frequency, start, duration, {
        type: "triangle", gain: 0.115 * velocity, attack: 0.005, filter: 2900
      });
      tone(frequency * 2, start, duration * 0.68, {
        type: "sine", gain: 0.032 * velocity, attack: 0.004, filter: 4700, detune: 2
      });
      tone(frequency * 3, start, duration * 0.38, {
        type: "sine", gain: 0.011 * velocity, attack: 0.003, filter: 5600, detune: -3
      });
    }

    function musicBoxNote(frequency, start, duration = 1.15, velocity = 1) {
      tone(frequency, start, duration, {
        type: "sine", gain: 0.098 * velocity, attack: 0.003, filter: 5900
      });
      tone(frequency * 2, start, duration * 0.74, {
        type: "triangle", gain: 0.034 * velocity, attack: 0.003, filter: 7200, detune: 5
      });
      tone(frequency * 3, start, duration * 0.42, {
        type: "sine", gain: 0.013 * velocity, attack: 0.003, filter: 8200, detune: -4
      });
    }

    function noiseHit(start, duration, frequency, gainValue) {
      const ctx = ensureContext();
      if (!ctx || activePreset === "none") return;
      const source = track(ctx.createBufferSource());
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = noiseBuffer("white", 1);
      filter.type = "highpass";
      filter.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter).connect(gain).connect(master);
      source.start(start);
      source.stop(start + duration + 0.04);
    }

    function kick(start, strong = true) {
      const ctx = ensureContext();
      if (!ctx || activePreset !== "rock") return;
      const oscillator = track(ctx.createOscillator());
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(strong ? 155 : 125, start);
      oscillator.frequency.exponentialRampToValueAtTime(43, start + 0.2);
      gain.gain.setValueAtTime(strong ? 0.58 : 0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.23);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    }

    function recurring(preset, interval, draw) {
      const localGeneration = generation;
      const run = (index = 0) => {
        if (activePreset !== preset || localGeneration !== generation) return;
        draw(index);
        const timer = setTimeout(() => {
          timers.delete(timer);
          run(index + 1);
        }, interval);
        timers.add(timer);
      };
      run();
    }

    function startLight() {
      const progression = [
        [261.63, 329.63, 392.0], [196.0, 246.94, 293.66],
        [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
        [146.83, 196.0, 246.94], [174.61, 220.0, 261.63],
        [196.0, 246.94, 293.66], [220.0, 277.18, 329.63]
      ];
      const melodies = [
        [523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 523.25],
        [392.0, 493.88, 587.33, 493.88, 440.0, 392.0, 369.99, 392.0]
      ];

      recurring("light", 4200, (bar) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.07;
        const chord = progression[bar % progression.length];
        const melody = melodies[Math.floor(bar / 2) % melodies.length];
        tone(chord[0] / 2, start, 4.25, { type: "sine", gain: 0.05, attack: 0.18, filter: 1300 });
        [0, 1, 2, 1, 0, 2, 1, 2].forEach((noteIndex, step) => {
          tone(chord[noteIndex], start + step * 0.5, 0.6, {
            type: step % 3 ? "triangle" : "sine", gain: 0.074, attack: 0.025, filter: 3000
          });
        });
        melody.forEach((frequency, step) => {
          if ((bar + step) % 3 !== 1) {
            tone(frequency, start + step * 0.5, 0.48, {
              type: "sine", gain: 0.035, attack: 0.02, filter: 3900
            });
          }
        });
      });
    }

    function startPiano() {
      const bars = [
        { chord: [261.63, 329.63, 392.0], bass: 130.81, melody: [523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 523.25] },
        { chord: [196.0, 246.94, 293.66], bass: 98.0, melody: [493.88, 587.33, 698.46, 587.33, 523.25, 493.88, 440.0, 493.88] },
        { chord: [220.0, 261.63, 329.63], bass: 110.0, melody: [440.0, 523.25, 659.25, 523.25, 493.88, 440.0, 392.0, 440.0] },
        { chord: [174.61, 220.0, 261.63], bass: 87.31, melody: [349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63, 349.23] },
        { chord: [146.83, 196.0, 246.94], bass: 73.42, melody: [392.0, 493.88, 587.33, 493.88, 440.0, 392.0, 349.23, 392.0] },
        { chord: [174.61, 220.0, 261.63], bass: 87.31, melody: [523.25, 440.0, 392.0, 440.0, 523.25, 587.33, 523.25, 440.0] },
        { chord: [196.0, 246.94, 293.66], bass: 98.0, melody: [587.33, 493.88, 440.0, 493.88, 587.33, 659.25, 587.33, 523.25] },
        { chord: [220.0, 277.18, 329.63], bass: 110.0, melody: [554.37, 659.25, 739.99, 659.25, 587.33, 554.37, 493.88, 523.25] }
      ];

      recurring("piano", 5000, (barIndex) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.07;
        const bar = bars[barIndex % bars.length];
        pianoNote(bar.bass, start, 2.8, 0.8);
        pianoNote(bar.bass * (barIndex % 4 === 3 ? 1.5 : 1), start + 2.5, 2.2, 0.68);
        bar.chord.forEach((frequency, index) => {
          pianoNote(frequency, start + index * 0.035, 2.2, 0.5);
          pianoNote(frequency, start + 2.5 + index * 0.035, 1.95, 0.43);
        });
        bar.melody.forEach((frequency, step) => {
          const shifted = barIndex % 4 === 2 && step > 4 ? frequency * 1.12246 : frequency;
          pianoNote(shifted, start + step * 0.6, step % 4 === 3 ? 1.08 : 0.76, 0.67);
        });
      });
    }

    function startMusicBox() {
      const melodies = [
        [659.25, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25],
        [587.33, 440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88],
        [523.25, 440.0, 493.88, 523.25, 659.25, 523.25, 493.88, 440.0],
        [587.33, 493.88, 523.25, 587.33, 698.46, 659.25, 587.33, 523.25],
        [783.99, 659.25, 698.46, 783.99, 880.0, 783.99, 698.46, 659.25],
        [698.46, 587.33, 659.25, 698.46, 783.99, 698.46, 659.25, 587.33],
        [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 698.46, 659.25],
        [587.33, 523.25, 493.88, 523.25, 659.25, 587.33, 523.25, 493.88]
      ];
      const roots = [261.63, 220.0, 174.61, 196.0, 261.63, 220.0, 196.0, 246.94];

      recurring("musicbox", 4300, (barIndex) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.06;
        const melody = melodies[barIndex % melodies.length];
        const root = roots[barIndex % roots.length];
        musicBoxNote(root, start, 2.15, 0.44);
        musicBoxNote(root * 1.5, start + 2.05, 1.85, 0.35);
        melody.forEach((frequency, step) => {
          const octaveLift = barIndex % 4 === 3 && step >= 4 ? 2 : 1;
          musicBoxNote(frequency * octaveLift, start + step * 0.51, step % 4 === 3 ? 1.5 : 1.08, 0.76);
          if (step === 2 || step === 6) {
            musicBoxNote(frequency / 2, start + step * 0.51 + 0.08, 0.9, 0.22);
          }
        });
      });
    }

    function startRock() {
      const roots = [82.41, 98.0, 110.0, 73.42, 82.41, 123.47, 98.0, 110.0];
      const lead = [164.81, 196.0, 220.0, 146.83, 164.81, 246.94, 196.0, 220.0];

      recurring("rock", 2100, (barIndex) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.06;
        const beat = 0.5;
        const root = roots[barIndex % roots.length];
        for (let step = 0; step < 8; step += 1) {
          noiseHit(start + step * beat / 2, 0.05, 6100, step % 2 ? 0.055 : 0.095);
        }
        kick(start, true);
        kick(start + beat * 2, barIndex % 2 === 0);
        if (barIndex % 4 === 3) kick(start + beat * 3.5, false);
        [1, 3].forEach((beatIndex) => noiseHit(start + beatIndex * beat, 0.16, 1450, 0.19));
        [0, 1, 2, 3].forEach((beatIndex) => {
          const bassFrequency = root * (beatIndex === 3 && barIndex % 2 ? 1.5 : 1);
          tone(bassFrequency, start + beatIndex * beat, 0.4, {
            type: "sawtooth", gain: 0.105, attack: 0.01, filter: 780
          });
        });
        [0, 2].forEach((beatIndex) => {
          tone(root * 2, start + beatIndex * beat, 0.32, {
            type: "square", gain: 0.045, attack: 0.01, filter: 1250
          });
          tone(root * 2.5, start + beatIndex * beat + 0.015, 0.3, {
            type: "sawtooth", gain: 0.034, attack: 0.01, filter: 1500
          });
        });
        if (barIndex % 2 === 1) {
          [0, 1, 2, 3].forEach((step) => {
            tone(lead[barIndex % lead.length] * (step === 3 ? 1.12246 : 1), start + step * beat, 0.22, {
              type: "square", gain: 0.025, attack: 0.008, filter: 2100
            });
          });
        }
      });
    }

    function startFocus() {
      const chords = [
        [130.81, 196.0, 261.63], [110.0, 164.81, 220.0],
        [87.31, 130.81, 174.61], [98.0, 146.83, 196.0]
      ];
      recurring("focus", 9000, (barIndex) => {
        const ctx = ensureContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.08;
        const chord = chords[barIndex % chords.length];
        chord.forEach((frequency, index) => {
          tone(frequency, start + index * 0.08, 9.4, {
            type: index === 0 ? "sine" : "triangle",
            gain: index === 0 ? 0.11 : 0.045,
            attack: 1.6,
            filter: 1100 + index * 350,
            detune: index === 2 ? 4 : 0
          });
        });
        [0, 2, 4, 6].forEach((offset) => {
          tone(chord[1] * 2, start + offset, 2.2, {
            type: "sine", gain: 0.017, attack: 0.45, filter: 2600
          });
        });
      });
    }

    function startNoise(preset) {
      const ctx = ensureContext();
      if (!ctx) return;

      const sourceA = track(ctx.createBufferSource());
      const sourceB = track(ctx.createBufferSource());
      const filterA = ctx.createBiquadFilter();
      const filterB = ctx.createBiquadFilter();
      const gainA = ctx.createGain();
      const gainB = ctx.createGain();

      sourceA.loop = true;
      sourceB.loop = true;
      sourceA.buffer = noiseBuffer(preset === "rain" ? "white" : "brown", 5);
      sourceB.buffer = noiseBuffer(preset === "rain" ? "brown" : "white", 5);
      filterA.type = "lowpass";
      filterB.type = preset === "rain" ? "bandpass" : "lowpass";
      filterA.frequency.value = preset === "rain" ? 3600 : 720;
      filterB.frequency.value = preset === "rain" ? 1550 : 240;
      filterB.Q.value = preset === "rain" ? 0.7 : 0.35;
      gainA.gain.value = preset === "rain" ? 0.52 : 0.62;
      gainB.gain.value = preset === "rain" ? 0.18 : 0.12;
      sourceA.connect(filterA).connect(gainA).connect(master);
      sourceB.connect(filterB).connect(gainB).connect(master);
      sourceA.start();
      sourceB.start();

      if (preset === "night") {
        recurring("night", 4200, (index) => {
          const now = ensureContext()?.currentTime;
          if (now == null) return;
          tone(index % 2 ? 55 : 49, now + 0.08, 3.8, {
            type: "sine", gain: 0.035, attack: 0.8, filter: 420
          });
        });
      }
    }

    async function play(preset, volume) {
      stop();
      activePreset = PRESETS[preset] ? preset : "none";
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

      if (activePreset === "light") startLight();
      else if (activePreset === "piano") startPiano();
      else if (activePreset === "musicbox") startMusicBox();
      else if (activePreset === "rock") startRock();
      else if (activePreset === "focus") startFocus();
      else if (activePreset === "rain" || activePreset === "night") startNoise(activePreset);
      return true;
    }

    return {
      play,
      stop,
      setVolume,
      get activePreset() { return activePreset; }
    };
  })();

  function removeOldMusicSections(shell) {
    const legacySelect = $("[data-music-preset]", shell);
    if (legacySelect) {
      legacySelect.value = "none";
      legacySelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    $$('[data-music-settings], [data-music-settings-v2], [data-music-settings-v3]', shell)
      .forEach((section) => section.remove());
  }

  function install() {
    const shell = $("#settingsDialog .settings-shell");
    if (!shell) return false;
    if ($("[data-music-settings-v4]", shell)) return true;

    removeOldMusicSections(shell);
    const legacySaved = readJson(LEGACY_KEY, { preset: "none", volume: 35 });
    const saved = readJson(MUSIC_KEY, legacySaved);
    writeJson(LEGACY_KEY, { preset: "none", volume: Number(saved.volume) || 35 });

    const section = document.createElement("section");
    section.className = "settings-section music-settings-v2 music-settings-v4";
    section.dataset.musicSettingsV4 = "";
    section.innerHTML = `
      <div class="settings-row">
        <h3>背景音樂</h3>
        <span class="music-v2-badge" aria-hidden="true">♫</span>
      </div>
      <div class="music-setting-grid">
        <label class="music-field">
          <span>音樂類型</span>
          <select data-music-v4-preset aria-label="背景音樂類型">
            ${Object.entries(PRESETS).map(([value, item]) => `<option value="${value}">${item.name}</option>`).join("")}
          </select>
        </label>
        <label class="music-field">
          <span>音量</span>
          <div class="music-volume-row">
            <input data-music-v4-volume type="range" min="0" max="100" step="5" value="35" />
            <output data-music-v4-volume-value>35%</output>
          </div>
        </label>
      </div>
      <p class="music-preset-description" data-music-v4-description></p>
      <p class="music-status" data-music-v4-status>目前未播放背景音樂。</p>`;
    shell.append(section);

    const preset = $("[data-music-v4-preset]", section);
    const volume = $("[data-music-v4-volume]", section);
    const volumeValue = $("[data-music-v4-volume-value]", section);
    const description = $("[data-music-v4-description]", section);
    const status = $("[data-music-v4-status]", section);

    preset.value = PRESETS[saved.preset] ? saved.preset : "none";
    volume.value = String(Number.isFinite(Number(saved.volume)) ? Number(saved.volume) : 35);
    volumeValue.textContent = `${volume.value}%`;

    const persist = () => writeJson(MUSIC_KEY, {
      preset: preset.value,
      volume: Number(volume.value)
    });

    const refresh = (playing = false) => {
      const item = PRESETS[preset.value] || PRESETS.none;
      description.textContent = item.description;
      if (preset.value === "none") {
        status.textContent = "目前未播放背景音樂。";
      } else if (playing) {
        status.textContent = `正在播放：${item.name}。`;
      } else {
        status.textContent = `已選擇：${item.name}。瀏覽器可能需要你先點一下頁面才允許播放。`;
      }
    };

    preset.addEventListener("change", async () => {
      persist();
      if (preset.value === "none") {
        audio.stop();
        refresh(false);
        return;
      }
      refresh(await audio.play(preset.value, Number(volume.value)));
    });

    volume.addEventListener("input", () => {
      volumeValue.textContent = `${volume.value}%`;
      persist();
      audio.setVolume(Number(volume.value));
    });

    refresh(false);

    const resume = async () => {
      const current = readJson(MUSIC_KEY, { preset: "none", volume: 35 });
      if (current.preset && current.preset !== "none" && audio.activePreset === "none") {
        preset.value = PRESETS[current.preset] ? current.preset : "none";
        volume.value = String(Number(current.volume) || 35);
        volumeValue.textContent = `${volume.value}%`;
        refresh(await audio.play(preset.value, Number(volume.value)));
      }
    };
    document.addEventListener("pointerdown", resume, { once: true, capture: true });
    document.addEventListener("keydown", resume, { once: true, capture: true });
    return true;
  }

  function begin() {
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
})();
