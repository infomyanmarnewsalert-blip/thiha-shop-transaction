import { supabase } from "@/lib/db";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";

// PUT /api/products/:id  （id は int）
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id))
    return json({ success: false, error: "invalid id" }, 400);

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const updates: Record<string, any> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return json({ success: false, error: "name must be string" }, 400);
    }
    updates.name = body.name;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price)) {
      return json({ success: false, error: "price must be number" }, 400);
    }
    updates.price = price;
  }
  if (Object.keys(updates).length === 0) {
    return json({ success: false, error: "no fields to update" }, 400);
  }

  const { data, error } = await supabase
    .from("Products")
    .update(updates)
    .eq("id", id)
    .select("id,name,price")
    .single();

  if (error) return json({ success: false, error: error.message }, 500);
  return json({ success: true, item: data });
}

// DELETE /api/products/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id))
    return json({ success: false, error: "invalid id" }, 400);

  const { error } = await supabase
    .from("Products")
    .delete()
    .eq("id", id);
  if (error) return json({ success: false, error: error.message }, 500);

  return json({ success: true });
}
