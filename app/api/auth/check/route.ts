// /app/api/auth/check/route.ts
import { getBalanceFast } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone")?.trim();
  if (!phone) {
    return new Response(JSON.stringify({ error: "phone required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const snap = await getBalanceFast(phone);
  return new Response(
    JSON.stringify({
      exists: snap.exists,
      balance: snap.exists ? snap.balance : undefined,
      last_charge_date: snap.exists ? snap.last_charge_date : undefined,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
