// Supabase 的 URL 與 publishable key 可以安全地出現在前端；請勿放入 service_role key。
// 建立 Supabase 專案後，把以下兩個空字串換成專案值，即可開啟真實帳號與資料同步。
window.APP_CONFIG = {
  SUPABASE_URL: "https://sxxtebrzocxgtldvdamn.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_yqAWL9yzDkbNHXra3gm8sg_4NHRfhxX"
};

// 額外功能採獨立資源載入，避免直接改動既有登入與 Supabase 核心流程。
(() => {
  const version = "20260723-music-v4-fix1";
  const styles = [
    "assets/todo-redesign.css",
    "assets/desktop-upgrade.css",
    "assets/desktop-hotfix.css",
    "assets/layout-polish.css",
    "assets/right-drawer-music.css",
    "assets/stacked-drawer-music.css",
    "assets/music-v4-fix.css"
  ];
  const scripts = [
    "assets/todo-redesign.js",
    // 先註冊新版 capture handlers，避免舊視窗管理器攔截縮放與機器人拖曳。
    "assets/layout-polish.js",
    "assets/desktop-upgrade.js",
    "assets/desktop-hotfix.js",
    "assets/desktop-layout-bridge.js",
    "assets/right-drawer-music.js",
    "assets/music-presets-v4.js"
  ];

  styles.forEach((path) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${path}?v=${version}`;
    document.head.appendChild(link);
  });

  scripts.forEach((path) => {
    const script = document.createElement("script");
    script.src = `${path}?v=${version}`;
    script.async = false;
    document.head.appendChild(script);
  });
})();
