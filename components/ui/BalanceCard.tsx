"use client";

import useSWR from "swr";
import { getSavedPhone } from "@/lib/client-auth";
import { fetcher } from "@/lib/fetcher";

export default function BalanceCard() {
  const phone = getSavedPhone(); // ローカルストレージから
  const { data, isLoading, error } = useSWR(
    phone ? `/api/balance?phone=${encodeURIComponent(phone)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 4000, // 叩きすぎ防止
    }
  );

  const balance = data?.exists ? Number(data.balance) : 0;

  return (
    <div className="flex items-center justify-between rounded-xl border p-4 bg-card">
      <span className="text-sm text-muted-foreground">現在の残高</span>
      <span className="text-lg font-bold">¥{balance.toLocaleString()}</span>
    </div>
  );
}
