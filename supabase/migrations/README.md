# 資料庫更新規則

1. 已上線的 migration 永遠不要修改或重跑破壞性指令。
2. 每次 DB 變更都新增下一個編號檔案，例如 `002_add_subject_progress.sql`。
3. 優先使用 `add column if not exists`、`create table if not exists`。
4. 禁止在正式資料庫執行 `drop table`、`truncate` 或沒有條件的 `delete`。
5. 上線前先備份，再於測試專案執行 migration。

