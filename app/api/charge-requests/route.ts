// app/api/charge-requests/route.ts
export const runtime = "nodejs";

import { supabase, invalidateBalanceCache } from "@/lib/db";
import { ChargeRequestSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";
import { notifyAdmins, isPushReady } from "@/lib/push";

export const dynamic = "force-dynamic";

const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

// GET: /api/charge-requests?status=pending|approved|all
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status =
      (searchParams.get("status") as "pending" | "approved" | "all") || "all";
    let query = supabase
      .from("ChargeRequests")
      .select("*")
      .order("requested_at", { ascending: true });
    if (status === "pending") query = query.eq("approved", false);
    if (status === "approved") query = query.eq("approved", true);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ items: data ?? [] });
  } catch (e: any) {
    return json(
      { error: e?.message ?? "Failed to list charge requests" },
      500
    );
  }
}

// POST: create new charge request
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = ChargeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.format() }, 400);
  const { phone, amount } = parsed.data;

  const id = uid();
  const now = nowISO();
  const { error } = await supabase.from("ChargeRequests").insert({
    id,
    phone,
    amount,
    approved: false,
    requested_at: now,
    approved_at: null,
  });
  if (error) return json({ error: error.message }, 500);

  if (isPushReady()) {
    await notifyAdmins({
      title: "New charge request",
      body: "ユーザーからチャージ申請が来ました",
      url: "/admin/charge-requests",
    });
  }

  return json({ ok: true });
}

// PUT: approve charge request {id}
export async function PUT(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return json({ success: false, error: "id is required" }, 400);

    const { data: reqData, error: reqErr } = await supabase
      .from("ChargeRequests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (reqErr || !reqData)
      return json({ success: false, error: "not found" }, 404);
    if (reqData.approved)
      return json({ success: true, already: true }, 200);

    const phone = reqData.phone as string;
    const amount = Number(reqData.amount ?? 0);
    const now = nowISO();

    await supabase
      .from("ChargeRequests")
      .update({ approved: true, approved_at: now })
      .eq("id", id);

    const { data: user } = await supabase
      .from("Users")
      .select("balance")
      .eq("phone", phone)
      .maybeSingle();

    const newBalance = Number(user?.balance ?? 0) + amount;
    if (user) {
      await supabase
        .from("Users")
        .update({ balance: newBalance, last_charge_date: now })
        .eq("phone", phone);
    } else {
      await supabase
        .from("Users")
        .insert({ phone, balance: newBalance, last_charge_date: now });
    }

    invalidateBalanceCache(phone);
    return json({ success: true, balance: newBalance }, 200);
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? "approve failed" }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

