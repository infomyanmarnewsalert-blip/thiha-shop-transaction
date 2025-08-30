/* app/charge/page.tsx */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getSavedPhone } from "@/lib/client-auth";
// ✅ 追加：確認モーダル
import ConfirmModal from "@/components/ui/ConfirmModal";
import { apiFetch } from "@/lib/api";
import { formatYGNMinute } from "@/lib/utils";

const PRESETS = [1000, 3000, 5000, 10000];

type ProofData = {
  phoneLastFour: string;
  amount: number;
  timestamp: string;
  status: "pending";
  requestId: string;
};

export default function ChargePage() {
  const [phone, setPhone] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showProof, setShowProof] = useState(false);
  const [requestData, setRequestData] = useState<ProofData | null>(null);
  // ✅ 追加：確認モーダルの開閉
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setPhone(getSavedPhone() ?? null);
  }, []);

  const handleSubmit = async () => {
    if (!phone || !amount || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/charge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, amount }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.success === false) {
        setError(
          json?.error || res.statusText || "リクエストの送信に失敗しました"
        );
        return;
      }

      const requestIdStr = json?.id != null ? String(json.id) : "";

      // 以前の証明画面と同じ構成
      setRequestData({
        phoneLastFour: phone.slice(-4),
        amount,
        timestamp: formatYGNMinute(new Date()),
        status: "pending",
        requestId: requestIdStr,
      });
      setShowProof(true);

      // 管理者画面の一覧を更新させる
      new BroadcastChannel("thiha-shop").postMessage({ type: "CR_CHANGED" });
    } catch (e) {
      setError("リクエストの送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 証明（レシート）画面：以前のUI =====
  if (showProof && requestData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Card className="border-2 border-primary">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black">Request Sent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Phone (last 4)
                  </span>
                  <span className="font-semibold">
                    ****{requestData.phoneLastFour}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-semibold">
                    {requestData.amount.toLocaleString()}ks
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-800"
                  >
                    Pending
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Time</span>
                  <span className="text-sm">{requestData.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Request ID
                  </span>
                  <span className="font-semibold">{requestData.requestId}</span>
                </div>
              </div>

              <Alert className="border-primary bg-primary/5">
                <AlertDescription className="flex justify-center text-center text-lg text-red-500 font-bold">
                  Show this screen to admin staff.
                </AlertDescription>
              </Alert>

              <Link href="/" className="block">
                <Button className="w-full h-12">Back Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===== Choose Amount選択画面（プリセット上/入力不可） =====
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-black">Request Charge Money</h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Choose Amount
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Pick（上） */}
              <div>
                <div className="mb-2 font-semibold"></div>
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
                        {v.toLocaleString()}ks
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Selected：表示のみ */}
              <div>
                <div className="mb-2 font-semibold">Selected</div>
                <div className="h-12 flex items-center rounded-md border px-3 bg-muted/30">
                  <span className="text-lg font-semibold">
                    {amount ? `${amount.toLocaleString()}ks` : "ks"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Pick an amount and press Request Charge Money.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* ✅ 変更：送信ボタンは即POSTせずモーダルを開く */}
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!phone || !amount || submitting}
                aria-busy={submitting}
                className="w-full h-12 text-lg font-semibold"
              >
                {submitting ? (
                  "Sending..."
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Request Charge Money
                  </>
                )}
              </Button>

              {/* ✅ 追加：Charge MoneyRequest前確認モーダル（Phoneはマスクしない） */}
              <ConfirmModal
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Confirm Amount"
                description="Please check amount. OK?"
                confirmLabel="Request"
                cancelLabel="Cancel"
                onConfirm={async () => {
                  setConfirmOpen(false);
                  await handleSubmit();
                }}
              >
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phone</span>
                    <span className="font-semibold">{phone ?? "Not set"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm">Amount</span>
                    <span className="text-lg font-bold">
                      {amount ? `${amount.toLocaleString()}ks` : "ks"}
                    </span>
                  </div>
                </div>
              </ConfirmModal>

              <Link href="/" className="block">
                <Button variant="outline" className="w-full bg-transparent">
                  Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
