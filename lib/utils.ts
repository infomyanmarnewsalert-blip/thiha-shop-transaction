// /lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcnコンポーネントが参照するユーティリティ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 共通レスポンス（API用） */
export function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

/** ISO日時 */
export const nowISO = () => new Date().toISOString();

/** プロジェクト既定のタイムゾーン（ヤンゴン） */
export const PROJECT_TIME_ZONE = "Asia/Yangon" as const;

/**
 * 指定日時をヤンゴン時間で「YYYY/MM/DD HH:mm」に整形
 * 未設定や不正な日時は "-" を返す
 */
export function formatYGNMinute(dt?: string | number | Date): string {
  if (!dt) return "-";
  // Supabase由来のISOがタイムゾーン表記なしの場合（例: 2025-08-30T05:10:36.758672）
  // はUTCとして解釈できるように 'Z' を補ってからDate化する
  let input: string | number | Date = dt;
  if (typeof dt === "string") {
    const s = dt.trim();
    const hasTZ = /[Zz]|[+\-]\d{2}:?\d{2}$/.test(s);
    input = hasTZ ? s : `${s}Z`;
  }
  const date = new Date(input);
  if (isNaN(date.getTime())) return "-";
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: PROJECT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // Intlの結果はローカライズされた区切りになるので手動で再整形
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const y = parts.year ?? "";
  const m = parts.month ?? "";
  const d = parts.day ?? "";
  const h = parts.hour ?? "";
  const mm = parts.minute ?? "";
  return `${y}/${m}/${d} ${h}:${mm}`;
}
