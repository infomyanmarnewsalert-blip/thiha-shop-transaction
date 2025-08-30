"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onResolved: (phone: string, balance: number, lastChargeDate?: string) => void;
  title?: string;
  description?: string;
};

const PHONE_KEY = "thiha_phone";
function isValidPhone(v: string) {
  return /^[0-9+\-\s]{3,}$/.test(v.trim());
}

export default function PhoneGate({
  onResolved,
  title = "電話番号を入力してください",
  description = "電話番号は購入・残高確認に使用します（必須）",
}: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(PHONE_KEY) : null;
    if (saved && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchOnce(saved);
    } else {
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOnce(p: string) {
    try {
      setLoading(true);
      const res = await import("@/lib/api").then(({ apiFetch }) =>
        apiFetch(`/api/balance?phone=${encodeURIComponent(p)}`, {
          cache: "no-store",
          lockUI: false,
        })
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      localStorage.setItem(PHONE_KEY, p);
      setOpen(false);
      onResolved(p, Number(json.balance ?? 0), json.last_charge_date);
    } catch {
      setErr(
        "残高の取得に失敗しました。ネットワークや設定を確認してください。"
      );
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = phone.trim();
    if (!isValidPhone(v)) {
      setErr(
        "電話番号を正しく入力してください（数字/+/−/スペース、3文字以上）"
      );
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    await fetchOnce(v);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        <p className="mb-4 text-sm text-gray-600">{description}</p>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm font-medium">
              電話番号（必須）
            </label>
            <input
              id="phone"
              required
              inputMode="tel"
              placeholder="例: 08012345678"
              className="w-full rounded-md border px-3 py-2 outline-none focus:border-gray-400"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={loading || !isValidPhone(phone)}
            className="inline-flex h-10 items-center justify-center rounded-md border bg-black px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "確認中..." : "残高を表示する"}
          </button>
        </form>
      </div>
    </div>
  );
}
