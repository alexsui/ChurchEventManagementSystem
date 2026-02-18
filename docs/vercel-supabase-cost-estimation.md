# 部署成本分析：Vercel + Neon PostgreSQL

> 最後更新：2026-02-18
> 適用專案：Church Event Management System（教會活動管理系統）
> 用途：教會內部管理，非商業用途
> **最終方案：Vercel Hobby + Neon Free = $0/月**

---

## 目錄

1. [專案概況](#專案概況)
2. [最終推薦方案](#最終推薦方案)
3. [Vercel 收費方式](#vercel-收費方式)
4. [為什麼選 Neon？](#為什麼選-neon)
5. [被排除的方案](#被排除的方案)
6. [成本估算情境](#成本估算情境)
7. [未來升級路徑](#未來升級路徑)

---

## 專案概況

本系統為 Next.js 16 全端應用，主要功能包括：

| 項目 | 說明 |
|------|------|
| 框架 | Next.js 16 + React 19 |
| 資料庫 | PostgreSQL（透過 Prisma ORM） |
| 認證 | NextAuth.js（LINE Login + 帳號密碼） |
| API 路由 | 31 條 Serverless API Routes |
| 頁面 | 21 個頁面（7 公開 + 14 管理後台） |
| 檔案上傳 | 無 |
| 即時功能 | 無（無 WebSocket / Realtime） |
| Edge Functions | 僅 Next.js Middleware（認證檢查） |

**預估使用規模**：教會組織（非商業用途），50～2,000 位會員，管理 20～100 場活動

**關鍵事實**：本系統只需要一個 PostgreSQL 資料庫，不使用 Supabase 的 Auth、Storage、Realtime 等功能。因此**不需要為整套 BaaS 平台付費**，只需找到便宜可靠的 PostgreSQL 託管即可。

---

## 最終推薦方案

### Vercel Hobby + Neon Free = $0/月

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   Vercel Hobby (免費)      Neon Free (免費)           │
│   ┌─────────────┐         ┌──────────────┐          │
│   │ Next.js 16  │────────>│ PostgreSQL   │          │
│   │ 31 API Routes│  Prisma │ 0.5 GB 儲存  │          │
│   │ 21 Pages    │<────────│ PITR 備份    │          │
│   └─────────────┘         │ 連線池內建    │          │
│                           └──────────────┘          │
│                                                      │
│   月費：$0    年費：$0                                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

研究了 9 個 PostgreSQL 託管服務後，**Neon Free** 是最佳選擇。以下是完整分析。

---

## Vercel 收費方式

### 決定：使用 Hobby 免費方案

本系統為教會內部管理工具，**無商業用途**，符合 Vercel Hobby 方案的非商業使用條款。

| 資源 | Hobby 免費額度 | 我們的預估用量 | 是否足夠 |
|------|---------------|---------------|---------|
| 頻寬 | 100 GB/月 | < 50 GB | 綽綽有餘 |
| Edge Requests | 100 萬次/月 | < 30 萬次 | 足夠 |
| Function CPU 時間 | 4 CPU-hrs/月 | < 2 hrs | 足夠 |
| Function 調用次數 | 100 萬次/月 | < 50 萬次 | 足夠 |
| Function 最大執行時間 | 60 秒 | API 通常 < 5 秒 | 足夠 |
| Build Minutes | 6,000 分鐘/月 | < 500 分鐘 | 足夠 |

**Vercel 費用：$0/月**

> Hobby 限制：同時只能跑 1 個 Build、Function 最長 60 秒、無 Email 支援。這些對教會內部系統影響不大。

> 若未來需要商業用途，升級到 Pro 為 $20/人/月（含 1 TB 頻寬、100 萬次 Function 調用、$20 使用額度抵扣）。

---

## 為什麼選 Neon？

### Neon 簡介

[neon.com](https://neon.com) — Serverless PostgreSQL 服務，2025 年被 **Databricks 以約 $10 億收購**，有企業級穩定性保障。

### 免費方案內容

| 項目 | 內容 |
|------|------|
| 儲存空間 | 0.5 GB |
| 運算時間 | 100 CU-hours/月（約可運行 400 小時 @ 0.25 CU） |
| 連線數 | 最多 10,000（內建 PgBouncer 連線池） |
| Egress | 5 GB/月 |
| 備份 | PITR 回溯 6 小時或 1 GB 變更量 |
| 分支 | 支援資料庫分支（方便開發測試） |
| PostgreSQL 版本 | 15～17 |
| 開源 | 核心開源 |

### 休眠機制

閒置 5 分鐘後運算自動休眠（Scale to Zero），**資料永遠不會刪除**。下次查詢時自動喚醒，冷啟動約 500ms～幾秒。對教會內部系統幾乎無感。

### 與其他方案的比較

| 比較項目 | Neon Free | Supabase Free | Supabase Pro | Xata Free |
|----------|-----------|---------------|-------------|-----------|
| 月費 | **$0** | $0 | $25 | $0 |
| 儲存 | 0.5 GB | 500 MB | 8 GB | 15 GB |
| 備份 | **PITR 6 小時** | 無 | 7 天備份 | 每日（月限 1 次還原） |
| 暫停風險 | 運算休眠（自動恢復） | **7 天閒置暫停（手動恢復）** | 無 | 無 |
| 連線池 | **內建 PgBouncer（10,000）** | 需額外設定 | 需額外設定 | **無（僅 15 條連線）** |
| Vercel 整合 | **原生一鍵** | 手動 | 手動 | 有但主要針對舊 SDK |
| Prisma 支援 | **官方原生 adapter** | 支援 | 支援 | 支援（有 OOM 回報） |
| 公司穩定性 | **Databricks 收購（$10 億）** | $116M+ 融資 | 同左 | $35M 融資、27 人 |
| 社群生態 | **大、文件多** | 大 | 大 | 小 |

### 為什麼不選 Xata？（15 GB 免費儲存）

Xata 的 15 GB 免費儲存很吸引人，但深入研究後發現有嚴重問題：

1. **Prisma + Xata Free 有 OOM（記憶體不足）錯誤回報** — 開發者回報在 Xata Lite + Prisma 組合下頻繁 OOM，換主機後問題消失
2. **僅 15 條平行連線，無內建連線池** — Vercel Serverless 高峰期容易打爆連線上限
3. **公司穩定性堪憂** — 2022 年後無新融資、僅 27 人、正在轉型企業產品、Xata Lite 疑似進入維護模式
4. **2025 年初已砍掉免費方案的 Search API 和 File API** — 免費方案有持續縮減的趨勢
5. **2024 年底至今 14+ 次服務中斷紀錄**
6. **社群資源少** — 遇到問題難以找到解答

**結論：15 GB 儲存雖大，但穩定性和相容性的風險不值得。**

### 0.5 GB 夠不夠用？

教會活動管理系統的資料量估算：

| 資料類型 | 預估筆數 | 預估大小 |
|----------|---------|---------|
| 會員資料（2,000 人） | 2,000 筆 | ~2 MB |
| 活動（100 場/年 × 5 年） | 500 筆 | ~1 MB |
| 活動場次 | 2,000 筆 | ~2 MB |
| 團隊 + 成員分配 | 10,000 筆 | ~5 MB |
| 報名紀錄 | 50,000 筆 | ~20 MB |
| 出席紀錄 | 100,000 筆 | ~40 MB |
| 任務 + 作業 | 20,000 筆 | ~10 MB |
| 預算項目 | 5,000 筆 | ~2 MB |
| 索引 + 系統表 | — | ~50 MB |
| **合計** | | **~130 MB** |

即使使用 5 年，資料量預估也僅約 **130 MB**，遠低於 0.5 GB 上限。**儲存空間不是問題。**

---

## 被排除的方案

### 研究過但不推薦

| 服務 | 月費 | 排除原因 |
|------|------|----------|
| **Xata Free** | $0 | Prisma OOM 問題、15 連線無連線池、公司穩定性差 |
| **Supabase Free** | $0 | 7 天閒置暫停（需手動恢復）、無備份 |
| **Supabase Pro** | $25 | 只用 DB 卻付整套 BaaS 費用，太貴 |
| **Aiven Free** | $0 | 無備份、保留閒置關閉權利 |
| **Render Free** | $0 | 30 天後**刪除**資料庫（不是暫停） |
| **Fly.io Managed** | $38 | 太貴 |
| **Fly.io Self-managed** | ~$2 | 官方聲明「不提供支援」 |
| **CockroachDB** | $0 | 不是真正 PostgreSQL，需改 Prisma provider |
| **Tembo** | — | 已停止 PostgreSQL 託管服務 |

### 值得作為備選的付費方案

| 服務 | 月費 | 適用場景 |
|------|------|---------|
| **Railway** | $5 | 想要零冷啟動、24/7 運行 |
| **Aiven Developer** | $5 | 想要自動備份 + 8 GB 儲存 |
| **Neon Launch** | $19 | DB 超過 0.5 GB 需要更多空間 |

---

## 成本估算情境

### 各規模用量是否在免費額度內？

| 規模 | MAU | API 調用/月 | DB 大小 | Vercel 夠用？ | Neon 夠用？ |
|------|-----|------------|---------|-------------|------------|
| 小型（50～100 人） | ~50 | ~30K | < 50 MB | 完全足夠 | 完全足夠 |
| 中型（200～500 人） | ~300 | ~150K | < 200 MB | 完全足夠 | 完全足夠 |
| 大型（500～2,000 人） | ~1,000 | ~500K | < 500 MB | 足夠 | 在限內 |

### 各情境月費

| 情境 | Vercel | PostgreSQL | **月總計** | **年總計** |
|------|--------|-----------|-----------|-----------|
| **小～大型教會（推薦）** | $0（Hobby） | $0（Neon Free） | **$0** | **$0** |
| 想要零冷啟動 | $0（Hobby） | $5（Railway） | $5 | $60 |
| DB 超過 0.5 GB | $0（Hobby） | $19（Neon Launch） | $19 | $228 |
| 原方案（Supabase Pro） | $0（Hobby） | $25（Supabase Pro） | $25 | $300 |

---

## 未來升級路徑

| 觸發條件 | 動作 | 費用變化 |
|----------|------|---------|
| DB 超過 0.5 GB | 升級 Neon Launch 方案（10 GB） | $0 → $19/月 |
| 冷啟動不可接受 | 改用 Railway Hobby | $0 → $5/月 |
| 需要商業用途 | 升級 Vercel Pro | +$20/月 |
| 需更大運算能力 | Neon Scale 方案 | 按用量計費 |

### 遷移到 Neon 的步驟

從 Supabase 遷移到 Neon 非常簡單：

1. 在 [neon.com](https://neon.com) 建立免費專案（選 `us-east-1` 區域，與 Vercel 同區最低延遲）
2. 將 `.env` 中的 `DATABASE_URL` 改成 Neon 的**連線池 URL**（pooled connection）
3. 將 `.env` 中的 `DIRECT_URL` 改成 Neon 的**直連 URL**（用於 Prisma migrate）
4. 執行 `npx prisma db push` 建立 schema
5. 執行 `npx prisma db seed` 匯入種子資料
6. 如有正式資料，用 `pg_dump` / `pg_restore` 遷移

---

## 參考資料

- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Neon Pricing](https://neon.com/pricing)
- [Neon Free Plan](https://neon.com/docs/introduction/plans)
- [Neon Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)
- [Neon + Prisma 文件](https://www.prisma.io/docs/orm/overview/databases/neon)
- [Neon + Vercel 整合](https://neon.com/docs/guides/vercel)
- [Xata Pricing](https://xata.io/pricing)
- [Xata Free Tier 變更（2025/01）](https://xata.io/blog/changes-free-tier)
- [Railway Pricing](https://railway.com/pricing)
- [Aiven Pricing](https://aiven.io/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
