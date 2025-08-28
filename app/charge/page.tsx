"use client";

import { useState } from "react";
import { ArrowLeft, CreditCard, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getSavedPhone, requireSavedPhone } from "@/lib/client-auth";

export default function ChargePage() {
  const [chargeAmount, setChargeAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showProof, setShowProof] = useState(false);
  const [requestData, setRequestData] = useState<any>(null);
  const phoneNumber = getSavedPhone();

  const handleChargeRequest = async () => {
    if (!phoneNumber) {
      setError(
        "電話番号が未設定です。最初の画面でログイン/新規登録してください"
      );
      return;
    }

    const amt = Number.parseInt(String(chargeAmount), 10);
    if (!chargeAmount || !Number.isFinite(amt) || amt <= 0) {
      setError("チャージ金額を正しく入力してください");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/charge-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phoneNumber,
          amount: amt,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        // API が message を返している場合は表示
        setError(result?.error || "リクエストの送信に失敗しました");
        return;
      }
      const requestIdStr = result?.id != null ? String(result.id) : "";
      if (result.success) {
        setRequestData({
          phoneLastFour: phoneNumber.slice(-4),
          amount: amt,
          timestamp: new Date().toLocaleString("ja-JP"),
          status: "pending",
          requestId: requestIdStr,
        });
        setShowProof(true);

        // 管理者画面へ「CR_CHANGED」を通知 → 一覧SWRを mutate して即反映
        new BroadcastChannel("thiha-shop").postMessage({
          type: "CR_CHANGED",
        });
      }
    } catch (err) {
      console.error("Charge request failed:", err);
      setError("リクエストの送信に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  if (showProof && requestData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Card className="border-2 border-primary">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black">
                チャージリクエスト証明
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    電話番号（下4桁）
                  </span>
                  <span className="font-semibold">
                    ****{requestData.phoneLastFour}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    チャージリクエスト金額
                  </span>
                  <span className="font-semibold">
                    ¥{requestData.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    ステータス
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-800"
                  >
                    承認待ち（pending）
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    リクエスト日時
                  </span>
                  <span className="text-sm">{requestData.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    リクエストID
                  </span>
                  <span className="font-semibold">{requestData.requestId}</span>
                </div>
              </div>

              <Alert className="border-primary bg-primary/5">
                <AlertDescription className="text-primary text-sm">
                  チャージリクエストした金額の現金を管理者に渡してChargeをお願いしてください
                </AlertDescription>
              </Alert>

              <Link href="/">
                <Button className="w-full h-12">Back Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const quickAmounts = [500, 1000, 2000, 3000];

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
            <h1 className="text-lg font-black">残高チャージ</h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Phone Number Input */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                電話番号入力
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="phone">電話番号（ハイフンなし）</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  maxLength={11}
                />
              </div>
            </CardContent>
          </Card> */}

          {/* Charge Amount */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                チャージ金額
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="amount">金額（円）</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="1000"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  min="1"
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  よく使う金額
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {quickAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setChargeAmount(amount.toString())}
                      className="text-sm"
                    >
                      ¥{amount.toLocaleString()}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleChargeRequest}
              disabled={isLoading || !phoneNumber || !chargeAmount}
              className="w-full h-12 text-lg font-semibold"
            >
              {isLoading ? (
                "送信中..."
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  チャージリクエスト送信
                </>
              )}
            </Button>

            <Link href="/" className="block">
              <Button variant="outline" className="w-full bg-transparent">
                商品購入画面に戻る
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
