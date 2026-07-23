// Supabase 的 URL 與 publishable key 可以安全地出現在前端；請勿放入 service_role key。
// 建立 Supabase 專案後，把以下兩個空字串換成專案值，即可開啟真實帳號與資料同步。
window.APP_CONFIG = {
  SUPABASE_URL: "https://sxxtebrzocxgtldvdamn.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_yqAWL9yzDkbNHXra3gm8sg_4NHRfhxX"
};

// 額外功能採獨立資源載入，避免直接改動既有登入與 Supabase 核心流程。
(() => {
  const version = "20260723-workspace-hotfix1";
  const styles = [
    "assets/todo-redesign.css",
    "assets/desktop-upgrade.css",
    "assets/desktop-hotfix.css"
  ];
  const scripts = [
    "assets/todo-redesign.js",
    "assets/desktop-upgrade.js",
    "assets/desktop-hotfix.js"
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
