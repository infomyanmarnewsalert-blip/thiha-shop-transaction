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

  // 404にせず、200 + {exists:false} を返す
  if (!snap?.exists) {
    return new Response(JSON.stringify({ exists: false }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=2",
      },
    });
  }

  // 見つかった場合は exists:true を明示して返す
  return new Response(
    JSON.stringify({
      exists: true,
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
