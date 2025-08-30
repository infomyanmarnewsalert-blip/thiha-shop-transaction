// /app/api/purchase/route.ts
import { findUserByPhone, supabase, invalidateBalanceCache } from "@/lib/db";
import { getQueue } from "@/lib/queues";
import { PurchaseSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.format() }, 400);

  const { phone, items } = parsed.data;

  // ユーザーが存在しない場合は購入を拒否
  const u = await findUserByPhone(phone);
  if (!u) return json({ error: "unknown phone" }, 400);
  const userId = u.id as any;

  // フロント計算を採用 → quantity/total_amount に正規化
  const normalized = items.map((it) => ({
    product_id: it.product_id,
    quantity: (it.quantity ?? it.qty)!,
    total_amount: (it.total_amount ?? it.total)!,
  }));

  const now = nowISO();
  const rows = normalized.map((it) => ({
    created_at: now,
    user_id: userId,
    product_id: it.product_id,
    quantity: it.quantity,
    total_amount: it.total_amount,
  }));
  const grand = normalized.reduce(
    (s, it) => s + Number(it.total_amount || 0),
    0
  );
  const queue = getQueue(`user:${userId}`, 1, 1000);
  try {
    const resp = await queue.add(async () => {
      // Recheck balance inside lock
      const { data: freshUser, error: fuErr } = await supabase
        .from("Users")
        .select("balance")
        .eq("id", userId)
        .maybeSingle();
      if (fuErr) throw new Error(fuErr.message);
      const current = Number(freshUser?.balance ?? 0);
      const after = current - grand;
      if (!Number.isFinite(grand) || grand < 0) {
        throw new Error("invalid total amount");
      }
      if (after < 0) {
        return json({ ok: false, error: "insufficient balance" }, 400);
      }
      // Insert transactions then update balance
      const { error: insErr } = await supabase
        .from("Transactions")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
      const { error: upErr } = await supabase
        .from("Users")
        .update({ balance: after })
        .eq("id", userId);
      if (upErr) throw new Error(upErr.message);
      invalidateBalanceCache(phone);
      return json({ ok: true, total: grand, balance_after: after });
    });
    return resp;
  } catch (e: any) {
    if (e?.code === "QUEUE_LIMIT") {
      return new Response(JSON.stringify({ ok: false, error: "Processing" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-wait-reason": "Processing, please wait...",
        },
      });
    }
    return json({ ok: false, error: e?.message ?? "purchase failed" }, 500);
  }
}
