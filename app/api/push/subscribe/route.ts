import { supabase } from "@/lib/db";
import { json } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { adminId, subscription } = await req.json().catch(() => ({}));
  if (!adminId || !subscription) return json({ error: "invalid payload" }, 400);
  await supabase
    .from("AdminSubscriptions")
    .insert({ adminId, subscription: JSON.stringify(subscription) });
  return json({ ok: true });
}
