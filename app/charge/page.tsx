/* app/charge/page.tsx */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSavedPhone } from "@/lib/client-auth";

const PRESETS = [1000, 3000, 5000, 10000];

export default function ChargePage() {
  const [phone, setPhone] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    setPhone(getSavedPhone() ?? null);
  }, []);

  const handleSubmit = async () => {
    if (!phone || !amount || submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const res = await fetch("/api/charge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, amount }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json?.success ?? true)) {
        setNotice("チャージリクエストを送信しました");
        // 他タブ（管理画面など）に通知したい場合は以下
        new BroadcastChannel("thiha-shop").postMessage({ type: "CR_CHANGED" });
      } else {
        setNotice(`送信に失敗しました：${json?.error ?? res.statusText}`);
      }
    } catch (e) {
      setNotice("送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-black">残高チャージ</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-black">チャージ金額</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* よく使う金額（上に配置） */}
            <div>
              <div className="mb-2 font-semibold">よく使う金額</div>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((v) => {
                  const selected = amount === v;
                  return (
                    <Button
                      key={v}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className={selected ? "h-12" : "h-12 bg-transparent"}
                      onClick={() => setAmount(v)}
                      disabled={submitting}
                    >
                      ¥{v.toLocaleString()}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* 金額（円）：入力不可。選択結果の表示のみ */}
            <div>
              <div className="mb-2 font-semibold">金額（円）</div>
              <div className="h-12 flex items-center rounded-md border px-3 bg-muted/30">
                <span className="text-lg font-semibold">
                  {amount ? `¥${amount.toLocaleString()}` : "未選択"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ※金額は上の「よく使う金額」から選択してください
              </p>
            </div>

            <Button
              className="w-full h-12"
              onClick={handleSubmit}
              disabled={!phone || !amount || submitting}
              aria-busy={submitting}
            >
              {submitting ? "送信中…" : "チャージリクエスト送信"}
            </Button>

            <Link href="/" className="block">
              <Button variant="outline" className="w-full h-12">
                商品購入画面に戻る
              </Button>
            </Link>

            {notice && (
              <p className="text-center text-sm text-muted-foreground">
                {notice}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
