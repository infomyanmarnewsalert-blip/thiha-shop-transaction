/* app/page.tsx */
"use client";

import {
  ShoppingCart,
  Wallet,
  CreditCard,
  Plus,
  Search,
  Edit,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getSavedPhone } from "@/lib/client-auth";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import BalanceGuard from "@/components/ui/BalanceGuard";
// ✅ 購入前の確認モーダルはそのまま維持（修正点の対象外）
import ConfirmModal from "@/components/ui/ConfirmModal";

// ブラウザ用 Supabase クライアント
import { createClient } from "@supabase/supabase-js";
const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

type Product = { id: number; name: string; price: number };
// ✅ 修正点：選択済みは product オブジェクト＋数量で保持（編集/削除しやすく）
type SelectedProduct = { id: string; product: Product; quantity: number };

export default function PurchasePage() {
  const { mutate } = useSWRConfig();

  // ====== 修正点：モーダル方式のための state 追加 ======
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    []
  );
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductInModal, setSelectedProductInModal] =
    useState<Product | null>(null);
  const [quantityInModal, setQuantityInModal] = useState(1);
  // ====== /修正点 ======

  const [balance, setBalance] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 電話番号は state に保持（BalanceGuard がゲート表示を担当）
  useEffect(() => {
    setPhone(getSavedPhone() ?? null);
  }, []);

  // BroadcastChannel でログイン完了を検知
  useEffect(() => {
    const bc = new BroadcastChannel("thiha-shop");
    const onMsg = (e: MessageEvent<any>) => {
      const msg = e.data || {};
      if (msg.type === "LOGIN_SUCCESS" || msg.type === "PHONE_SAVED") {
        const ph = msg.phone ?? getSavedPhone() ?? null;
        setPhone((prev) => (prev === ph ? prev : ph));
      }
    };
    bc.addEventListener("message", onMsg);
    return () => bc.removeEventListener("message", onMsg);
  }, []);

  // /api/balance の SWR キー
  const normalizedPhone = useMemo(
    () => (phone ? phone.replace(/\D/g, "") : null),
    [phone]
  );
  const balanceKey = useMemo(
    () =>
      normalizedPhone
        ? `/api/balance?phone=${encodeURIComponent(normalizedPhone)}`
        : null,
    [normalizedPhone]
  );

  // ログイン直後に /api/balance を即時取り直す
  useEffect(() => {
    if (!balanceKey) return;
    mutate(balanceKey);
  }, [balanceKey, mutate]);

  // /api/balance 取得
  const { data: balanceSnap } = useSWR(balanceKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshInterval: 0,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  // APIの残高を balance ステートへ反映
  useEffect(() => {
    if (!balanceSnap?.exists) return;
    const apiBal = Number(balanceSnap.balance);
    if (Number.isFinite(apiBal) && apiBal !== balance) {
      setBalance(apiBal);
    }
  }, [balanceSnap, balance]);

  // /api/products
  const {
    data: productsRaw,
    isLoading: loadingProducts,
    error: productsError,
    mutate: revalidateProducts,
  } = useSWR("/api/products", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 3000,
  });

  // Supabase Realtime
  useEffect(() => {
    const ch = supabaseBrowser
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Products" },
        () => revalidateProducts()
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(ch);
    };
  }, [revalidateProducts]);

  // 同一端末の他タブからの通知でも再取得
  useEffect(() => {
    const bc = new BroadcastChannel("thiha-shop");
    const onMsg = (e: MessageEvent<any>) => {
      if (e.data?.type === "PRODUCTS_CHANGED") revalidateProducts();
    };
    bc.addEventListener("message", onMsg);
    return () => bc.removeEventListener("message", onMsg);
  }, [revalidateProducts]);

  // API 正規化
  const products: Product[] = useMemo(() => {
    const list = Array.isArray(productsRaw)
      ? productsRaw
      : productsRaw?.items ?? [];
    return list.map((p: any) => ({
      id: Number(p.id),
      name: p.name,
      price: Number(p.price ?? 0),
    }));
  }, [productsRaw]);

  // ====== 修正点：検索対象のフィルタリング ======
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);
  // ====== /修正点 ======

  // ====== 修正点：モーダルの開閉・編集開始・確定・削除 ======
  const openProductModal = (editId?: string) => {
    if (editId) {
      const existing = selectedProducts.find((p) => p.id === editId);
      if (existing) {
        setSelectedProductInModal(existing.product);
        setQuantityInModal(existing.quantity);
        setEditingProductId(editId);
      }
    } else {
      setSelectedProductInModal(null);
      setQuantityInModal(1);
      setEditingProductId(null);
    }
    setSearchQuery("");
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedProductInModal(null);
    setQuantityInModal(1);
    setEditingProductId(null);
    setSearchQuery("");
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProductInModal(product);
  };

  const handleModalOk = () => {
    if (!selectedProductInModal) return;

    const newRow: SelectedProduct = {
      id: editingProductId || Date.now().toString(),
      product: selectedProductInModal,
      quantity: quantityInModal,
    };

    if (editingProductId) {
      setSelectedProducts((prev) =>
        prev.map((p) => (p.id === editingProductId ? newRow : p))
      );
    } else {
      setSelectedProducts((prev) => [...prev, newRow]);
    }
    closeProductModal();
  };

  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  };
  // ====== /修正点 ======

  const getTotalPrice = () => {
    return selectedProducts.reduce((total, item) => {
      return total + item.product.price * (item.quantity || 1);
    }, 0);
  };

  // ✅ 購入確認モーダル用：選択済み一覧（従来の ConfirmModal は維持）
  const getSelectedProductsList = () => {
    // ここでは集約せず、選択行をそのまま表示
    return selectedProducts.map((row) => ({
      id: row.product.id,
      name: row.product.name,
      price: row.product.price,
      quantity: row.quantity,
    }));
  };

  // レシートを閉じたら選択を初期化
  const handleReceiptClose = () => {
    setShowReceipt(false);
    setPurchaseData(null);
    setSelectedProducts([]); // モーダル方式のため空配列へ初期化
  };

  const handlePurchase = async () => {
    const selectedList = getSelectedProductsList();
    const totalPrice = getTotalPrice();

    if (selectedList.length === 0) {
      alert("商品を選択してください");
      return;
    }
    if (balance < totalPrice) {
      alert("残高が不足しています");
      return;
    }
    try {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          items: selectedList.map((it: any) => ({
            product_id: String(it.id),
            qty: Number(it.quantity),
            price: Number(it.price),
            total: Number(it.price) * Number(it.quantity),
          })),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        const newBal = Number(result.balance_after ?? balance - totalPrice);
        setBalance(newBal);

        // /api/balance を即時更新（SWRキャッシュ差し替え）
        if (balanceKey) {
          mutate(
            balanceKey,
            (prev: any) => ({ ...(prev ?? { exists: true }), balance: newBal }),
            { revalidate: false }
          );
          mutate(balanceKey);
        }

        // 他タブへ通知
        new BroadcastChannel("thiha-shop").postMessage({
          type: "BALANCE_CHANGED",
          phone,
          newBalance: newBal,
        });

        setPurchaseData({
          products: selectedList,
          totalPrice,
          timestamp: new Date().toLocaleString(),
          remainingBalance: newBal,
        });
        setShowReceipt(true);
      } else {
        alert(
          result?.error ? JSON.stringify(result.error) : "購入に失敗しました"
        );
      }
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("購入に失敗しました");
    }
  };

  if (showReceipt && purchaseData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Card className="border-2 border-primary">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black">購入完了</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                {purchaseData.products.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-sm">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold">
                      ¥{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      合計金額
                    </span>
                    <span className="font-bold text-lg">
                      ¥{purchaseData.totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    購入日時
                  </span>
                  <span className="text-sm">{purchaseData.timestamp}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">残高</span>
                  <span className="font-semibold text-primary">
                    ¥{purchaseData.remainingBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground px-2">
                管理者に証明画面を見せてください、その後OKボタンを押してください
              </div>

              <Button onClick={handleReceiptClose} className="w-full h-12">
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <BalanceGuard />
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border">
          <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-xl font-black text-center">商品購入</h1>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-6">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Wallet className="w-5 h-5 text-primary mr-2" />
                    <span className="font-semibold">現在の残高</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-lg font-bold px-3 py-1 bg-primary/10 text-primary"
                  >
                    ¥{balance.toLocaleString()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="mb-8">
              <Link href="/charge">
                <Button
                  variant="outline"
                  className="w-full h-12 bg透明 border-primary text-primary hover:bg-primary/10"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  残高をチャージする
                </Button>
              </Link>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">商品を選択</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {productsError && (
                  <p className="text-sm text-destructive">
                    商品の取得に失敗しました
                  </p>
                )}

                {/* ✅ 修正点：選択済み一覧（表形式・改行対応・編集/削除） */}
                {selectedProducts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground">
                      選択済み商品
                    </h3>
                    {selectedProducts.map((item) => (
                      <div key={item.id} className="bg-muted p-3 rounded-lg">
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-medium break-words leading-tight">
                              {item.product.name}
                            </p>
                          </div>
                          <div className="text-sm text-center min-w-[3rem]">
                            {item.quantity}個
                          </div>
                          <div className="text-sm font-semibold text-right min-w-[4rem]">
                            ¥
                            {(
                              item.product.price * item.quantity
                            ).toLocaleString()}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openProductModal(item.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProduct(item.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ✅ 修正点：「商品を追加」→ モーダル起動 */}
                <Button
                  variant="outline"
                  onClick={() => openProductModal()}
                  className="w-full h-12 border-dashed border-primary text-primary hover:bg-primary/10 bg-transparent"
                  disabled={loadingProducts}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  商品を追加
                </Button>

                {getTotalPrice() > 0 && (
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">合計金額</span>
                      <span className="text-lg font-bold text-primary">
                        ¥{getTotalPrice().toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* 購入ボタン（購入確認モーダルは現状維持） */}
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={getTotalPrice() === 0 || loadingProducts}
                  className="w-full h-12 text-lg font-semibold"
                >
                  購入する
                </Button>

                {/* 購入前確認モーダル（従来どおり） */}
                <ConfirmModal
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title="購入内容の確認"
                  description="以下の内容で購入します。よろしければ「購入確定」を押してください。"
                  confirmLabel="購入確定"
                  cancelLabel="戻る"
                  onConfirm={async () => {
                    setConfirmOpen(false);
                    await handlePurchase();
                  }}
                >
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-medium mb-2">購入商品</div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {getSelectedProductsList().map((it: any) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="mr-2 min-w-0">
                            <div className="font-medium break-words whitespace-normal">
                              {it.name}
                            </div>
                            <div className="opacity-70">
                              単価: ¥{Number(it.price).toLocaleString()} / 個数:{" "}
                              {it.quantity}
                            </div>
                          </div>
                          <div className="font-semibold shrink-0">
                            ¥
                            {(
                              Number(it.price) * Number(it.quantity)
                            ).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    <hr className="my-3" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">合計</span>
                      <span className="text-lg font-bold">
                        ¥{getTotalPrice().toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      残高: ¥{balance.toLocaleString()}
                    </div>
                  </div>
                </ConfirmModal>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* ✅ 修正点：商品選択モーダル本体 */}
        <Dialog open={showProductModal} onOpenChange={closeProductModal}>
          <DialogContent
            className="max-w-md w-[calc(100%-24px)] max-h-[80vh] overflow-hidden flex flex-col
              !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2"
          >
            <DialogHeader>
              <DialogTitle>
                {editingProductId ? "商品を編集" : "商品を選択"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* 追加 or 編集で分岐 */}
              {editingProductId ? (
                /* ====== 編集モード：検索UIは出さず、商品名を表示して数量のみ変更 ====== */
                <div className="space-y-3">
                  <div className="rounded-lg border p-3 bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">
                      商品
                    </div>
                    <div className="font-medium break-words leading-tight">
                      {selectedProductInModal?.name ?? "（商品名）"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ¥
                      {Number(
                        selectedProductInModal?.price ?? 0
                      ).toLocaleString()}
                    </div>
                  </div>

                  {/* 数量のみ変更可 */}
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <label className="text-sm font-medium">数量</label>
                      <div className="flex items-center gap-3 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setQuantityInModal(Math.max(1, quantityInModal - 1))
                          }
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>
                        <span className="font-semibold min-w-[2rem] text-center">
                          {quantityInModal}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setQuantityInModal(quantityInModal + 1)
                          }
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-sm">小計</span>
                        <span className="font-semibold">
                          ¥
                          {Number(
                            (selectedProductInModal?.price ?? 0) *
                              quantityInModal
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ====== 追加モード：検索→リスト→選択→数量 ====== */
                <>
                  {/* 検索バー */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="商品を検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* 商品リスト：検索入力があるときだけ表示 */}
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[200px]">
                    {searchQuery.trim() === "" ? (
                      <p className="text-center text-muted-foreground py-4">
                        検索して商品を表示します
                      </p>
                    ) : filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleProductSelect(product)}
                          className={`w-full p-3 text-left rounded-lg border transition-colors ${
                            selectedProductInModal?.id === product.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-muted"
                          }`}
                        >
                          <div className="space-y-1">
                            <p className="font-medium break-words leading-tight">
                              {product.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ¥{product.price.toLocaleString()}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        該当する商品が見つかりません
                      </p>
                    )}
                  </div>

                  {/* 数量選択（商品が選ばれている時だけ表示） */}
                  {selectedProductInModal && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <label className="text-sm font-medium">数量</label>
                        <div className="flex items-center gap-3 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setQuantityInModal(
                                Math.max(1, quantityInModal - 1)
                              )
                            }
                            className="h-8 w-8 p-0"
                          >
                            -
                          </Button>
                          <span className="font-semibold min-w-[2rem] text-center">
                            {quantityInModal}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setQuantityInModal(quantityInModal + 1)
                            }
                            className="h-8 w-8 p-0"
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div className="bg-muted p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-sm">小計</span>
                          <span className="font-semibold">
                            ¥
                            {Number(
                              (selectedProductInModal?.price ?? 0) *
                                quantityInModal
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ボタン */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={closeProductModal}
                  className="flex-1 bg-transparent"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleModalOk}
                  disabled={!selectedProductInModal}
                  className="flex-1"
                >
                  OK
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* ✅ /修正点 */}
      </div>
    </>
  );
}
