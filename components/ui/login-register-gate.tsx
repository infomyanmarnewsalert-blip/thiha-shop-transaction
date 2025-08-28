// components/ui/login-register-gate.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuthGateMode } from "@/lib/auth-gate";

type Props = {
  onAuthed: (phone: string, balance: number) => void;
};

const PHONE_KEY = "thiha_phone";

/** 電話番号: 国内形式のみ（09で始まり数字のみ・全体8〜11桁） */
export function isValidPhone(input: string): boolean {
  const digits = input.trim().replace(/\D/g, ""); // 数字以外を除去
  return /^09\d{6,9}$/.test(digits); // 09 + 数字6〜9桁 = 8〜11桁
}

/** 入力値を保存用に正規化（国内形式のみ受理）→ 09... の数字列を返す */
export function normalizeToDomestic(input: string): string | null {
  const digits = input.trim().replace(/\D/g, "");
  return /^09\d{6,9}$/.test(digits) ? digits : null;
}

export default function LoginRegisterGate({ onAuthed }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthGateMode>("home");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const tried = useRef(false);

  const onAuthedRef = useRef(onAuthed);
  useEffect(() => {
    onAuthedRef.current = onAuthed;
  }, [onAuthed]);

  // ★ StrictMode でも 1 回しか走らないようにガード
  const didBoot = useRef(false);
  useEffect(() => {
    if (didBoot.current) return;
    didBoot.current = true;

    const saved =
      typeof window !== "undefined" ? localStorage.getItem(PHONE_KEY) : null;

    if (saved) {
      // ★ そのまま通す（モーダルは出さない）
      setOpen(false);
      onAuthedRef.current(saved, 0);

      // ★ 他タブ/他コンポーネントへもログイン状態を通知
      new BroadcastChannel("thiha-shop").postMessage({
        type: "LOGIN_SUCCESS",
        phone: saved,
      });

      // ★ 裏で最新残高だけ取得（UIはブロックしない）
      fetch(`/api/balance?phone=${encodeURIComponent(saved)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j && typeof j.balance === "number")
            onAuthedRef.current(saved, j.balance);
        })
        .catch(() => {});
    } else {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<{ message?: string; mode?: AuthGateMode }>;
      setFlash(ce.detail?.message ?? null);
      setMode(ce.detail?.mode ?? "home");
      setError(null);
      setPhone("");
      setOpen(true);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("thiha:auth:open", onOpen as EventListener);
      return () =>
        window.removeEventListener("thiha:auth:open", onOpen as EventListener);
    }
  }, []);

  async function autoLogin(p: string) {
    try {
      const r = await fetch(`/api/auth/check?phone=${encodeURIComponent(p)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (r.ok && j.exists) {
        setOpen(false);
        onAuthed(p, Number(j.balance ?? 0));
        return;
      }
    } catch {}
    setOpen(true);
  }

  async function doLogin() {
    setError(null);

    const normalized = normalizeToDomestic(phone);
    if (!normalized) {
      setError(
        "「09」で始まる数字のみ、合計8〜11桁で入力してください（例: 09000000000）"
      );
      return;
    }

    setLoading(true);
    try {
      // ★ 送信も保存も正規化した 09... を使用
      const r = await fetch(
        `/api/auth/check?phone=${encodeURIComponent(normalized)}`,
        {
          cache: "no-store",
        }
      );
      const j = await r.json();
      if (r.ok && j.exists) {
        localStorage.setItem(PHONE_KEY, normalized);
        setOpen(false);
        onAuthed(normalized, Number(j.balance ?? 0));

        // ★ 購入画面へ即反映（BroadcastChannel で通知）
        new BroadcastChannel("thiha-shop").postMessage({
          type: "LOGIN_SUCCESS",
          phone: normalized,
        });
      } else {
        setError(
          "入力された電話番号は登録されていません。新規登録してください。"
        );
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function doRegister() {
    setError(null);

    const normalized = normalizeToDomestic(phone);
    if (!normalized) {
      setError(
        "「09」で始まる数字のみ、合計8〜11桁で入力してください（例: 09000000000）"
      );
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const j: any = await r.json().catch(() => ({}));

      // ★ 成功判定を新旧レスポンス両対応に
      const isOk =
        r.ok && (j?.ok === true || typeof j?.created !== "undefined");

      if (isOk) {
        localStorage.setItem(PHONE_KEY, normalized);
        setOpen(false);
        onAuthed(normalized, Number(j?.balance ?? 0));

        // ★ 購入画面へ即反映（BroadcastChannel で通知）
        new BroadcastChannel("thiha-shop").postMessage({
          type: "LOGIN_SUCCESS",
          phone: normalized,
        });
      } else {
        setError(j?.error || j?.message || "登録に失敗しました");
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-md bg-white">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === "home"
              ? "はじめに"
              : mode === "login"
              ? "ログイン"
              : "新規登録"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {flash && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {flash}
            </div>
          )}

          {mode === "home" && (
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-11" onClick={() => setMode("login")}>
                ログイン
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setMode("register")}
              >
                新規登録
              </Button>
            </div>
          )}

          {mode !== "home" && (
            <>
              <div className="space-y-1">
                <label htmlFor="phone" className="text-sm font-medium">
                  電話番号（必須）
                </label>
                <input
                  id="phone"
                  required
                  inputMode="numeric"
                  // ブラウザの軽いチェックも併用（JS 側の isValidPhone が主）
                  pattern="^09\d{6,9}$"
                  title="「09」で始まる数字のみ、合計8〜11桁で入力してください（例: 09000000000）"
                  placeholder="例: 09000000000"
                  className="w-full rounded-md border px-3 py-2 outline-none focus:border-gray-400"
                  aria-describedby="phoneHelp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
                <p
                  id="phoneHelp"
                  className="text-xs text-muted-foreground mt-1"
                >
                  「09」で始まる<strong>数字のみ</strong>、
                  <strong>合計8〜11桁</strong>で入力してください（例:
                  09000000000）。
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button
                  className="h-11 flex-1"
                  disabled={loading || !isValidPhone(phone)}
                  onClick={mode === "login" ? doLogin : doRegister}
                >
                  {loading
                    ? "処理中..."
                    : mode === "login"
                    ? "ログイン"
                    : "登録する"}
                </Button>
                <Button
                  className="h-11 flex-1"
                  variant="outline"
                  onClick={() => {
                    setMode("home");
                    setError(null); // flashは残してもOK。消したいなら setFlash(null)
                  }}
                >
                  戻る
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
