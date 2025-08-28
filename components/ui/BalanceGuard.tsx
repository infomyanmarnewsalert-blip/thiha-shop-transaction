// components/ui/BalanceGuard.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import LoginRegisterGate from "@/components/ui/login-register-gate";

const fetcher = async (u: string) => {
  const res = await fetch(u);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
};

export type BalanceGuardProps = { children?: React.ReactNode };

export default function BalanceGuard({ children }: BalanceGuardProps) {
  const [phone, setPhone] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPhone(localStorage.getItem("phone"));
  }, []);

  const { data } = useSWR(
    phone ? `/api/balance?phone=${encodeURIComponent(phone)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      dedupingInterval: 60_000,
      shouldRetryOnError: false,
    }
  );

  // Gate 完了時に phone を保存
  const handleAuthed = React.useCallback((p: string, _b: number) => {
    localStorage.setItem("phone", p);
    setPhone(p);
  }, []);

  new BroadcastChannel("thiha-shop").postMessage({
    type: "LOGIN_SUCCESS",
    phone,
  });

  // 電話番号未設定 → Gate 表示
  if (!phone) return <LoginRegisterGate onAuthed={handleAuthed} />;

  // DB未登録（/api/balance が {exists:false}）→ Gate 表示
  if (data && data.exists === false) {
    return <LoginRegisterGate onAuthed={handleAuthed} />;
  }

  // 登録済みのみ children を許可
  return <>{children}</>;
}
