// app/api/charge-requests/route.ts
export const runtime = "nodejs";

import { supabase, invalidateBalanceCache, findUserByPhone } from "@/lib/db";
import { ChargeRequestSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";
import { notifyAdmins, isPushReady } from "@/lib/push";

export const dynamic = "force-dynamic";

// GET: /api/charge-requests?status=pending|approved|all
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status =
      (searchParams.get("status") as "pending" | "approved" | "all") || "all";
    let query = supabase
      .from("ChargeRequests")
      .select("*, Users(phone_number,balance,last_charge_date)")
      // 新しい順で上に来るように並べる
      .order("requested_at", { ascending: false, nullsFirst: false });
    if (status === "pending") query = query.eq("approved", false);
    if (status === "approved") query = query.eq("approved", true);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    const items = (data ?? []).map((r: any) => {
      const { Users, ...rest } = r;
      return {
        ...rest,
        phone: Users?.phone_number,
        currentBalance: Users?.balance,
        last_charge_date: Users?.last_charge_date,
      };
    });
    return json({ items });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to list charge requests" }, 500);
  }
}

// POST: create new charge request
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = ChargeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.format() }, 400);
  const { phone, amount } = parsed.data;

  let user = await findUserByPhone(phone);
  if (!user) {
    const { data: newUser, error: userErr } = await supabase
      .from("Users")
      .insert({ phone_number: phone, balance: 0, last_charge_date: "" })
      .select("id")
      .single();
    if (userErr) return json({ error: userErr.message }, 500);
    user = newUser;
  }

  const userId = user.id;
  const now = nowISO();
  // ✅ id は指定しない。DB が採番した id を返す
  const { data: inserted, error } = await supabase
    .from("ChargeRequests")
    .insert({
      user_id: userId,
      amount,
      approved: false,
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 500);

  if (isPushReady()) {
    await notifyAdmins({
      title: "New charge request",
      body: "ユーザーからチャージ申請が来ました",
      url: "/admin/charge-requests",
    });
  }
  return json({ success: true, id: inserted.id });
}

// PUT: approve charge request {id}
export async function PUT(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (id == null)
      return json({ success: false, error: "id is required" }, 400);
    // ✅ bigint 対応（数値化して検索）
    const idNum = Number(id);
    if (!Number.isFinite(idNum))
      return json({ success: false, error: "invalid id" }, 400);

    const { data: reqData, error: reqErr } = await supabase
      .from("ChargeRequests")
      .select("*")
      .eq("id", idNum)
      .maybeSingle();
    if (reqErr || !reqData)
      return json({ success: false, error: "not found" }, 404);
    if (reqData.approved) return json({ success: true, already: true }, 200);

    const userId = reqData.user_id as string | number;
    const amount = Number(reqData.amount ?? 0);
    const now = nowISO();

    await supabase
      .from("ChargeRequests")
      .update({ approved: true })
      .eq("id", idNum);

    const { data: user } = await supabase
      .from("Users")
      .select("phone_number,balance")
      .eq("id", userId)
      .maybeSingle();
    if (!user) return json({ success: false, error: "user not found" }, 404);
    const phone = user.phone_number as string;
    const newBalance = Number(user.balance ?? 0) + amount;
    await supabase
      .from("Users")
      .update({ balance: newBalance, last_charge_date: now })
      .eq("id", userId);

    invalidateBalanceCache(phone);
    return json({ success: true, balance: newBalance }, 200);
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? "approve failed" }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
