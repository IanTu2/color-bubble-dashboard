// Supabase 的 URL 與 publishable key 可以安全地出現在前端；請勿放入 service_role key。
// 建立 Supabase 專案後，把以下兩個空字串換成專案值，即可開啟真實帳號與資料同步。
window.APP_CONFIG = {
  SUPABASE_URL: "https://sxxtebrzocxgtldvdamn.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_yqAWL9yzDkbNHXra3gm8sg_4NHRfhxX"
};

// 待辦事項新版介面採獨立資源載入，避免改動既有登入與 Supabase 核心流程。
(() => {
  const version = "20260723-todo-layout1";
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `assets/todo-redesign.css?v=${version}`;
  document.head.appendChild(style);

  window.addEventListener("DOMContentLoaded", () => {
    const script = document.createElement("script");
    script.src = `assets/todo-redesign.js?v=${version}`;
    document.body.appendChild(script);
  });
})();