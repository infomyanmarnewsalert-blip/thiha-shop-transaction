// /app/api/balance/route.ts
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
  if (!snap.exists) {
    return new Response(JSON.stringify({ exists: false, error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({
      phone,
      balance: snap.balance,
      last_charge_date: snap.last_charge_date,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=2",
      },
    }
  );
}
