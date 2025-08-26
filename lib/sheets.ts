// Google Sheets API integration for unmanned sales system
const SHEET_ID = process.env.SHEET_ID!
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY!

interface Product {
  product_id: number
  name: string
  price: number
  active: boolean
}

interface Balance {
  phone: string
  balance: number
}

interface Transaction {
  timestamp: string
  type: string
  phone: string
  product_id: number
  qty: number
  price: number
  total: number
  note: string
}

interface ChargeRequest {
  id: string
  phone: string
  amount: number
  approved: boolean
  requested_at: string
  approved_at: string | null
}

interface AdminSubscription {
  adminId: string
  subscription: string
}

// Generic function to read from a sheet
async function readSheet(sheetName: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}?key=${API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  return data.values || []
}

// Generic function to write to a sheet
async function writeSheet(sheetName: string, values: any[][]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}:append?valueInputOption=RAW&key=${API_KEY}`
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: values,
    }),
  })
}

// Generic function to update a sheet
async function updateSheet(sheetName: string, range: string, values: any[][]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}!${range}?valueInputOption=RAW&key=${API_KEY}`
  await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: values,
    }),
  })
}

// Products API
export async function getProducts(): Promise<Product[]> {
  const rows = await readSheet("Products")
  if (rows.length <= 1) return [] // Skip header row

  return rows.slice(1).map((row) => ({
    product_id: Number.parseInt(row[0]),
    name: row[1],
    price: Number.parseInt(row[2]),
    active: row[3] !== "FALSE",
  }))
}

export async function addProduct(
  name: string,
  price: number,
  active = true,
): Promise<void> {
  const products = await getProducts()
  const newId =
    products.length > 0
      ? Math.max(...products.map((p) => p.product_id)) + 1
      : 1
  await writeSheet("Products", [[newId, name, price, active ? "TRUE" : "FALSE"]])
}

export async function updateProduct(
  productId: number,
  name: string,
  price: number,
  active = true,
): Promise<void> {
  const rows = await readSheet("Products")
  const rowIndex = rows.findIndex(
    (row, index) => index > 0 && Number.parseInt(row[0]) === productId,
  )
  if (rowIndex !== -1) {
    await updateSheet(
      "Products",
      `A${rowIndex + 1}:D${rowIndex + 1}`,
      [[productId, name, price, active ? "TRUE" : "FALSE"]],
    )
  }
}

export async function deleteProduct(productId: number): Promise<void> {
  // Note: Google Sheets API doesn't support row deletion directly
  // This would require a more complex implementation or manual deletion
  console.log(`Delete product ${productId} - requires manual implementation`)
}

// Balances API
export async function getBalance(phone: string): Promise<number> {
  const rows = await readSheet("Balances")
  const balanceRow = rows.find((row, index) => index > 0 && row[0] === phone)
  return balanceRow ? Number.parseInt(balanceRow[1]) : 0
}

export async function updateBalance(phone: string, newBalance: number): Promise<void> {
  const rows = await readSheet("Balances")
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === phone)

  if (rowIndex !== -1) {
    await updateSheet("Balances", `A${rowIndex + 1}:B${rowIndex + 1}`, [[phone, newBalance]])
  } else {
    await writeSheet("Balances", [[phone, newBalance]])
  }
}

// Transactions API
export async function addTransaction(transaction: Omit<Transaction, "timestamp">): Promise<void> {
  const timestamp = new Date().toISOString()
  await writeSheet("Transactions", [
    [
      timestamp,
      transaction.type,
      transaction.phone,
      transaction.product_id,
      transaction.qty,
      transaction.price,
      transaction.total,
      transaction.note,
    ],
  ])
}

export async function getTransactions(): Promise<Transaction[]> {
  const rows = await readSheet("Transactions")
  if (rows.length <= 1) return []

  return rows.slice(1).map((row) => ({
    timestamp: row[0],
    type: row[1],
    phone: row[2],
    product_id: Number.parseInt(row[3]),
    qty: Number.parseInt(row[4]),
    price: Number.parseInt(row[5]),
    total: Number.parseInt(row[6]),
    note: row[7] || "",
  }))
}

// Charge Requests API
export async function getChargeRequests(): Promise<ChargeRequest[]> {
  const rows = await readSheet("ChargeRequests")
  if (rows.length <= 1) return []

  return rows.slice(1).map((row) => ({
    id: row[0],
    phone: row[1],
    amount: Number.parseInt(row[2]),
    approved: row[3] === "TRUE",
    requested_at: row[4],
    approved_at: row[5] || null,
  }))
}

export async function addChargeRequest(phone: string, amount: number): Promise<string> {
  const id = Date.now().toString()
  const requestedAt = new Date().toISOString()
  await writeSheet("ChargeRequests", [[id, phone, amount, "FALSE", requestedAt, ""]])
  return id
}

export async function approveChargeRequest(id: string): Promise<void> {
  const rows = await readSheet("ChargeRequests")
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === id)

  if (rowIndex !== -1) {
    const approvedAt = new Date().toISOString()
    const row = rows[rowIndex]
    await updateSheet("ChargeRequests", `A${rowIndex + 1}:F${rowIndex + 1}`, [
      [row[0], row[1], row[2], "TRUE", row[4], approvedAt],
    ])

    // Update user balance
    const phone = row[1]
    const amount = Number.parseInt(row[2])
    const currentBalance = await getBalance(phone)
    await updateBalance(phone, currentBalance + amount)
  }
}

// Admin Subscriptions API
export async function getAdminSubscriptions(): Promise<AdminSubscription[]> {
  const rows = await readSheet("AdminSubscriptions")
  if (rows.length <= 1) return []

  return rows.slice(1).map((row) => ({
    adminId: row[0],
    subscription: row[1],
  }))
}
