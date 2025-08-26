import { NextResponse } from "next/server"
import {
  getBalance,
  updateBalance,
  addTransaction,
  getProducts,
} from "@/lib/sheets"

export async function POST(request: Request) {
  try {
    const { phone, products } = await request.json()

    const productDefs = await getProducts()
    const productMap = new Map(productDefs.map((p) => [p.product_id, p]))

    let total = 0
    for (const { productId, qty } of products) {
      const def = productMap.get(productId)
      if (!def) {
        return NextResponse.json(
          { error: `Unknown product: ${productId}` },
          { status: 400 },
        )
      }
      if (!def.active) {
        return NextResponse.json(
          { error: `Inactive product: ${productId}` },
          { status: 400 },
        )
      }
      total += def.price * qty
    }

    // Check balance
    const currentBalance = await getBalance(phone)
    if (currentBalance < total) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }

    // Update balance
    const newBalance = currentBalance - total
    await updateBalance(phone, newBalance)

    // Add transaction records
    for (const { productId, qty } of products) {
      const def = productMap.get(productId)!
      await addTransaction({
        type: "purchase",
        phone,
        product_id: productId,
        qty,
        price: def.price,
        total: def.price * qty,
        note: `Purchase: ${def.name}`,
      })
    }

    return NextResponse.json({ success: true, newBalance, total })
  } catch (error) {
    console.error("Error processing purchase:", error)
    return NextResponse.json({ error: "Failed to process purchase" }, { status: 500 })
  }
}
