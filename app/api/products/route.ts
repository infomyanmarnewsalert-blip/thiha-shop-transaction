import { supabase } from "@/lib/db";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/products  一覧
export async function GET() {
  const { data, error } = await supabase
    .from("Products")
    .select("id,name,price")
    .order("id");
  if (error) return json({ error: error.message }, 500);
  // UI 側が items でも配列でも読めるように、どちらにも対応
  return json({
    items: (data ?? []).map((p) => ({ ...p, price: Number(p.price) })),
  });
}

// POST /api/products  追加
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const name = body?.name;
  const priceNum = Number(body?.price);

  if (!name || typeof name !== "string") {
    return json({ success: false, error: "name required" }, 400);
  }
  if (!Number.isFinite(priceNum)) {
    return json({ success: false, error: "price must be number" }, 400);
  }

  const { error } = await supabase
    .from("Products")
    .insert({ name, price: priceNum });
  if (error) return json({ success: false, error: error.message }, 500);
  return json({ success: true });
}
