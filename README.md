# Bubble Space v2

Bubble Space 的 React + TypeScript 重構版本。

## 分支用途

- `main`：目前正式版，暫時不受影響。
- `react-v2`：新版開發與測試。
- `backup/before-react-v2-20260724`：重構前備份。

## 技術架構

- React
- TypeScript
- Vite
- GitHub Codespaces
- GitHub Actions

## 雲端開發

1. 在 GitHub Repository 選擇 `react-v2` 分支。
2. 點擊 `Code` → `Codespaces` → `Create codespace on react-v2`。
3. Codespace 建立後會自動執行 `npm install`。
4. 在終端機執行：

```bash
npm run dev
```

5. 開啟轉送的 5173 Port，即可看到預覽。

## 驗證建置

```bash
npm run typecheck
npm run build
```

每次推送到 `react-v2`，GitHub Actions 都會在雲端重新安裝套件、檢查 TypeScript 並建置 `dist`。

## 第一階段目標

1. 建立可重複建置的 React + TypeScript 骨架。
2. 確認 Codespaces 可在瀏覽器執行。
3. 確認 GitHub Actions 可以完成雲端建置。
4. 建立獨立測試站後，再逐項搬移既有功能。

## 搬移順序

1. 網站背景、泡泡、版面外框
2. 登入、註冊與設定
3. 待辦與月曆
4. 音樂播放器與工作區
5. 英文學習與搜尋
6. Supabase Edge Functions 與外部 API
