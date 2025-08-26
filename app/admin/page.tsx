"use client";

import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useState, useEffect } from "react";
import { fetcher } from "@/lib/fetcher";
import {
  CreditCard,
  Package,
  BarChart3,
  Check,
  Edit,
  Trash2,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AdminChargeRequest = {
  id: string;
  phone: string;
  amount: number;
  approved: boolean;
  requested_at?: string;
  approved_at?: string;
  currentBalance?: number;
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("charge");
  const [notification, setNotification] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({ name: "", price: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 変わりにくい商品は immutable（初回のみ取得・手動で再取得する）
  const {
    data: productsRaw,
    isLoading: loadingProducts,
    mutate: refetchProducts,
  } = useSWRImmutable("/api/products", fetcher);

  // チャージリクエストは通常SWR（自動再検証は全OFF）
  const {
    data: chargeRaw,
    isLoading: loadingCR,
    mutate: refetchCharge,
  } = useSWR("/api/charge-requests?status=all", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 10_000,
    refreshInterval: 0,
    shouldRetryOnError: false,
  });

  // /api/products は {items: []} でも [] でもOKにする & 画面の型に合わせて整形
  const products: any[] = (
    Array.isArray(productsRaw) ? productsRaw : productsRaw?.items ?? []
  ).map((p: any) => ({
    id: p.id ?? p.uuid,
    name: p.name,
    price: Number(p.price ?? 0),
  }));

  // /api/charge-requests も同様に整形（既存と同じキーへ正規化）
  const requests: AdminChargeRequest[] = (
    Array.isArray(chargeRaw) ? chargeRaw : chargeRaw?.items ?? []
  ).map((r: any) => ({
    id: r.id ?? r.request_id ?? r.uuid,
    phone: r.phone ?? r.phone_number ?? r.Users?.phone_number,
    amount: Number(r.amount ?? 0),
    approved:
      typeof r.approved === "boolean"
        ? r.approved
        : String(r.approved).toLowerCase() === "true",
    requested_at: r.requested_at ?? r.createdAt ?? r.created_at ?? "",
    approved_at: r.approved_at ?? r.approvedAt ?? "",
    currentBalance: r.currentBalance ?? r.balance,
  }));

  const handleApprove = async (requestId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/charge-requests", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: requestId }),
      });

      const result = await response.json();
      if (result.success) {
        await refetchCharge(); // ← 一括で最新化（同キーのみ）
        setNotification("チャージリクエストを承認しました");
        setTimeout(() => setNotification(""), 3000);
      } else {
        setNotification("承認に失敗しました");
        setTimeout(() => setNotification(""), 3000);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      setNotification("承認に失敗しました");
      setTimeout(() => setNotification(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProduct = async (product: any) => {
    try {
      const response = await fetch("/api/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
          body: JSON.stringify({
            id: product.id,
            name: product.name,
            price: product.price,
          }),
      });

      const result = await response.json();
      if (result.success) {
        await refetchProducts(); // ← 最新化
        setEditingProduct(null);
        setEditingProduct(null);
        setNotification("商品を更新しました");
        setTimeout(() => setNotification(""), 3000);
      }
    } catch (error) {
      console.error("Product update failed:", error);
      setNotification("商品の更新に失敗しました");
      setTimeout(() => setNotification(""), 3000);
    }
  };

  const handleDeleteProduct = (productId: number) => {
    setNotification("商品の削除は手動で行ってください");
    setTimeout(() => setNotification(""), 3000);
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newProduct.name,
          price: Number(newProduct.price),
        }),
      });

      const result = await response.json();
      if (result.success) {
        await refetchProducts(); // ← 最新化
        setNewProduct({ name: "", price: "" });
        setNotification("商品を追加しました");
        setTimeout(() => setNotification(""), 3000);
      }
    } catch (error) {
      console.error("Product addition failed:", error);
      setNotification("商品の追加に失敗しました");
      setTimeout(() => setNotification(""), 3000);
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingRequests = requests.filter((req) => !req.approved);
  const processedRequests = requests.filter((req) => req.approved);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black">管理者ダッシュボード</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {notification && (
          <Alert className="mb-6 border-primary bg-primary/5">
            <AlertDescription className="text-primary">
              {notification}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            variant={activeTab === "charge" ? "default" : "outline"}
            onClick={() => setActiveTab("charge")}
            className="h-16 flex flex-col gap-1"
          >
            <CreditCard className="w-6 h-6" />
            <span>チャージリクエスト管理</span>
          </Button>
          <Button
            variant={activeTab === "products" ? "default" : "outline"}
            onClick={() => setActiveTab("products")}
            className="h-16 flex flex-col gap-1"
          >
            <Package className="w-6 h-6" />
            <span>商品管理</span>
          </Button>
          <Button
            variant={activeTab === "analytics" ? "default" : "outline"}
            onClick={() => setActiveTab("analytics")}
            className="h-16 flex flex-col gap-1"
          >
            <BarChart3 className="w-6 h-6" />
            <span>売上分析</span>
          </Button>
        </div>

        {/* Charge Request Management */}
        {activeTab === "charge" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">
                チャージリクエスト管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending">
                    承認待ち ({pendingRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="processed">処理済み</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4 mt-6">
                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      承認待ちのリクエストはありません
                    </div>
                  ) : (
                    pendingRequests.map((request) => (
                      <Card
                        key={request.id}
                        className="border-2 border-primary/20"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {request.phone}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="bg-primary/10 text-primary"
                                >
                                  承認待ち
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                チャージ額: ¥{request.amount.toLocaleString()} |
                                現在残高: ¥
                                {request.currentBalance?.toLocaleString() ||
                                  "0"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.requested_at}
                              </div>
                            </div>
                            <Button
                              onClick={() => handleApprove(request.id)}
                              size="sm"
                              className="h-8"
                              disabled={isLoading}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              承認
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="processed" className="space-y-4 mt-6">
                  {processedRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      処理済みのリクエストはありません
                    </div>
                  ) : (
                    processedRequests.map((request) => (
                      <Card key={request.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {request.phone}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="bg-green-100 text-green-800"
                                >
                                  承認済み
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                チャージ額: ¥{request.amount.toLocaleString()} |
                                現在残高: ¥
                                {request.currentBalance?.toLocaleString() ||
                                  "0"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                リクエスト: {request.requested_at} | 承認:{" "}
                                {request.approved_at}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* ... existing code for products and analytics tabs ... */}
        {activeTab === "products" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black">商品管理</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      商品追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新しい商品を追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">商品名</Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) =>
                            setNewProduct((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="price">価格</Label>
                        <Input
                          id="price"
                          type="number"
                          value={newProduct.price}
                          onChange={(e) =>
                            setNewProduct((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button onClick={handleAddProduct} className="w-full">
                        追加
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="商品名で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left py-3 px-4">商品名</th>
                        <th className="text-left py-3 px-4">価格</th>
                        <th className="text-right py-3 px-4">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.id}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="py-3 px-4">{product.name}</td>
                          <td className="py-3 px-4">
                            ¥{product.price.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingProduct(product)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>商品を編集</DialogTitle>
                                  </DialogHeader>
                                  {editingProduct && (
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="edit-name">
                                          商品名
                                        </Label>
                                        <Input
                                          id="edit-name"
                                          value={editingProduct.name}
                                          onChange={(e) =>
                                            setEditingProduct((prev: any) => ({
                                              ...prev,
                                              name: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-price">価格</Label>
                                        <Input
                                          id="edit-price"
                                          type="number"
                                          value={editingProduct.price}
                                          onChange={(e) =>
                                            setEditingProduct((prev: any) => ({
                                              ...prev,
                                              price: Number(e.target.value),
                                            }))
                                          }
                                        />
                                      </div>
                                      <Button
                                        onClick={() =>
                                          handleEditProduct(editingProduct)
                                        }
                                        className="w-full"
                                      >
                                        更新
                                      </Button>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredProducts.length === 0 && searchTerm && (
                <div className="text-center py-8 text-muted-foreground">
                  「{searchTerm}」に一致する商品が見つかりません
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "analytics" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">売上分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  詳細な売上分析はLooker Studioで確認できます
                </p>
                <Button asChild>
                  <a
                    href="https://lookerstudio.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Looker Studioを開く
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
