"use client";

import { useGlobalLoading } from "@/lib/request-tracker";

export default function GlobalLoadingOverlay() {
  const active = useGlobalLoading();
  if (!active) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 text-white select-none">
        <div className="h-10 w-10 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm">処理中…</div>
      </div>
    </div>
  );
}

