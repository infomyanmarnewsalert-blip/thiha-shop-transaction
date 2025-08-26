// /app/api/auth/register/route.ts
import { findUserByPhone, supabase, invalidateBalanceCache } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  if (!phone || String(phone).trim() === "") {
    return new Response(JSON.stringify({ error: "phone required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const p = String(phone).trim();

  const exists = await findUserByPhone(p);
  if (exists) {
    return new Response(
      JSON.stringify({
        created: false,
        message:
          "既に電話番号が登録されています。ログイン画面から電話番号を入力してください。",
      }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
  }

  // 初期残高0, last_charge_date空
  await supabase.from("Users").insert({ phone: p, balance: 0, last_charge_date: "" });
  invalidateBalanceCache(p);

  return new Response(JSON.stringify({ created: true, balance: 0 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
