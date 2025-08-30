// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getQueue } from "@/lib/queues";

// Node ランタイム（service_role を使う場合の保険）
export const runtime = "nodejs";

type Body = { phone?: string };

// 必要ならフォーマット（先頭ゼロ保持のため文字列のまま）
function normalizePhone(input: string) {
  return input.trim().replace(/[^\d+]/g, "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const rawPhone = String(body.phone ?? "").trim();
    if (!rawPhone) {
      return NextResponse.json(
        { ok: false, error: "phone required" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(rawPhone);

    // Supabase クライアント生成（service_role があれば優先）
    const URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!URL || !/^https?:\/\//.test(URL)) {
      return NextResponse.json(
        { ok: false, error: "Invalid SUPABASE_URL" },
        { status: 500 }
      );
    }
    if (!KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase key" },
        { status: 500 }
      );
    }

    const supabase = createClient(URL, KEY);

    // 既存ユーザーの確認（※ カラム名は Users の実体に合わせる）
    const { data: existing, error: findErr } = await supabase
      .from("Users")
      .select("phone_number,balance")
      .eq("phone_number", phone)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json(
        { ok: false, error: findErr.message },
        { status: 500 }
      );
    }

    if (existing) {
      // 既に登録済み → そのまま balance を返す
      return NextResponse.json(
        { ok: true, phone, balance: Number(existing.balance ?? 0) },
        { status: 200 }
      );
    }

    // 新規作成（ここで "name" など存在しないカラムは一切送らない）
    // Enqueue per phone to avoid race on same phone; allow parallel for different phones
    const queue = getQueue(`register:${phone}`, 1, 200);
    try {
      const resp = await queue.add(async () => {
        const { error: upsertErr } = await supabase
          .from("Users")
          .upsert(
            { phone_number: phone },
            { onConflict: "phone_number", ignoreDuplicates: true }
          );
        if (upsertErr) throw new Error(upsertErr.message);
        return NextResponse.json(
          { ok: true, phone, balance: 0 },
          { status: 200 }
        );
      });
      return resp;
    } catch (qe: any) {
      if (qe?.code === "QUEUE_LIMIT") {
        return NextResponse.json(
          { ok: false, error: "Processing" },
          {
            status: 429,
            headers: { "x-wait-reason": "Processing, please wait..." },
          }
        );
      }
      return NextResponse.json(
        { ok: false, error: qe?.message ?? "failed during queue" },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
