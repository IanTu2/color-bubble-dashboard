# Bubble Space

圓角、動態彩色背景的個人學習與生活儀表板。網站支援繁體中文／英文、帳號登入、Email 驗證碼註冊、月曆、待辦事項，以及預留的學習、遊戲與 AI 助理區。

網站預計發布於：<https://iantu2.github.io/color-bubble-dashboard/>

## 已完成功能

- 移動式彩色背景與 24 顆隨機泡泡
- 中央即時日期與時間
- 左側黑色抽屜、繁體中文／英文即時切換
- 登入與註冊視窗；Supabase 設定完成後可寄送 Email OTP
- 登入後顯示「學習／英文／單字／遊戲／數學」多層選單
- 月曆、今日／兩天內／七天內／30 天內待辦統計
- 待辦新增、完成、刪除與月曆標記
- 右下 AI 助理入口（目前顯示即將推出）
- 尚未設定 Supabase 時，提供僅儲存於瀏覽器的體驗模式

## 啟用真實帳號與 Email 驗證碼

GitHub Pages 是靜態網站，寄信與帳號資料由 Supabase 安全處理。

1. 在 <https://supabase.com> 建立專案。
2. 打開 **SQL Editor**，執行 `supabase/migrations/001_initial_schema.sql`。
3. 到 **Authentication → Email Templates**：
   - 在 **Confirm signup** 範本中顯示 `{{ .Token }}`，讓新使用者收到數字驗證碼。
   - 建議主旨改成「Bubble Space 驗證碼」。
4. 到 **Project Settings → API** 複製 Project URL 與 publishable/anon key。
5. 修改 `config.js`：

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://你的專案.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "你的 publishable key"
};
```

`publishable/anon key` 本來就是提供前端使用，真正的資料安全由 SQL 內的 Row Level Security 保護。絕對不要把 `service_role key` 放到 GitHub。

## Admin 帳號

`wenchang10802270@gmail.com` 與一般帳號使用相同的 Email 驗證碼註冊流程。註冊成功後，migration 會自動把此 Email 的 `profiles.role` 記錄為 `admin`；目前 Admin 與一般會員使用相同功能。

## 保護既有 DB 資料

- 不修改已上線的 migration；每次新增一個遞增編號 SQL 檔。
- 不使用 `drop table`、`truncate` 或無條件 `delete`。
- schema 使用 `if not exists`，功能更新不需要清空資料庫。
- 任何正式 DB 變更前先備份，再從測試專案驗證。
