// /app/api/purchase/route.ts
import {
  findUserByPhone,
  supabase,
  invalidateBalanceCache,
} from "@/lib/db";
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

  const current = Number(u.balance ?? 0);

  // フロント計算を採用 → quantity/total_amount に正規化
  const normalized = items.map((it) => ({
    product_id: it.product_id,
    quantity: (it.quantity ?? it.qty)!,
    total_amount: (it.total_amount ?? it.total)!,
  }));

  const now = nowISO();
  const rows = normalized.map((it) => ({
    timestamp: now,
    phone_number: phone,
    product_id: it.product_id,
    quantity: it.quantity,
    total_amount: it.total_amount,
  }));
  const grand = normalized.reduce(
    (s, it) => s + Number(it.total_amount || 0),
    0
  );
  const after = current - grand;

  await supabase.from("Transactions").insert(rows);
  await supabase
    .from("Users")
    .update({ balance: after })
    .eq("phone", phone);

  invalidateBalanceCache(phone);
  return json({ ok: true, total: grand, balance_after: after });
}
