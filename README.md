# Thihaショップ（Vercel + Supabase / 社内向けシンプル版）

## Database (Supabase)

Supabase のテーブル構造は以下の通りです。

- **Products** — `id, name, price`
- **Users** — `id, phone_number, balance, last_charge_date`
- **Transactions** — `id, created_at, user_id, product_id, quantity, total_amount`
- **ChargeRequests** — `id, user_id, amount, approved, requested_at, approved_at`
  - `approved`: `true` / `false`
- **AdminSubscriptions** — `adminId, subscription`（Push 購読 JSON 文字列）

## Google Sheets から Supabase への移行手順

1. Google Sheets で使用中の各シートを CSV 形式でエクスポートする。
2. Supabase プロジェクトを作成し、上記スキーマでテーブルを作成する。
3. Supabase の Table Editor から CSV をインポートし、データを移行する。
4. プロジェクトの URL とサービスロールキーを取得し、`.env` に設定する。

```
SUPABASE_URL=<プロジェクトURL>
SUPABASE_SERVICE_ROLE_KEY=<サービスロールキー>
# 任意: キャッシュのTTL (ミリ秒)
BALANCE_CACHE_TTL_MS=2000
```

## 事前準備

1. 上記 `.env` を作成
2. 依存関係をインストール

```bash
npm install
```

## ローカル起動手順

```bash
git clone <このリポジトリURL>
cd <リポジトリ名>
npm install
npm run dev
```

## Web Push について

現在 Web Push はダミー実装になっており、設定しなくてもアプリは動作します。
将来的に Push 通知を有効化する場合は、`/lib/push.ts` の `isPushReady()` を実装し、
VAPID キーなどの必要な設定を行ってください。

