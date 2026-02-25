
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  ArrowLeft,
  Package,
  Plus,
  Search,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  ShoppingBag,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Eye,
  EyeOff,
  Store,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface ClientProduct {
  id: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  costPrice?: number;
  imageUrl?: string;
  isActive: boolean;
  trackInventory: boolean;
  showInPublicCatalog: boolean;
  Inventory?: {
    id: string;
    currentStock: number;
    minStock?: number;
    maxStock?: number;
    measurementUnit: string;
  };
}

export default function EstoquePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ClientProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewProductDialog, setShowNewProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ClientProduct | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'public'>('public'); // Filtro de catálogo - padrão mostra apenas públicos
  
  // Upload de imagem
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "BEBIDA",
    unitPrice: "",
    costPrice: "",
    initialStock: "",
    minStock: "",
    maxStock: "",
    measurementUnit: "UN",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated") {
      loadProducts();
    }
  }, [status, router]);

  useEffect(() => {
    filterProducts();
  }, [searchTerm, products, catalogFilter]);

  // Listener para atualização automática após ações críticas (ex: exclusão de pedidos)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stock_critical_update' && e.newValue) {
        console.log('🔄 Atualização crítica detectada! Recarregando estoque...');
        loadProducts();
        toast.success('Estoque atualizado automaticamente!');
      }
    };

    // Adiciona listener para mudanças no localStorage (entre abas/janelas)
    window.addEventListener('storage', handleStorageChange);

    // Também monitora mudanças na mesma aba via polling leve
    const checkInterval = setInterval(() => {
      const lastUpdate = localStorage.getItem('stock_critical_update');
      const lastChecked = sessionStorage.getItem('stock_last_checked') || '0';
      
      if (lastUpdate && lastUpdate !== lastChecked) {
        console.log('🔄 Atualização crítica detectada (mesma aba)! Recarregando estoque...');
        sessionStorage.setItem('stock_last_checked', lastUpdate);
        loadProducts();
        toast.success('Estoque atualizado automaticamente!');
      }
    }, 2000); // Verifica a cada 2 segundos

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/customer/products");

      if (!response.ok) {
        throw new Error("Erro ao carregar produtos");
      }

      const data = await response.json();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error("[LOAD_PRODUCTS_ERROR]", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCatalog = async () => {
    try {
      setSyncing(true);
      toast.loading("Sincronizando catálogo...", { id: "sync" });

      const response = await fetch("/api/customer/products/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erro ao sincronizar");
      }

      const result = await response.json();
      
      toast.success(
        `✅ Sincronização concluída! ${result.stats.created} criados, ${result.stats.updated} atualizados`,
        { id: "sync", duration: 4000 }
      );

      await loadProducts();
    } catch (error) {
      console.error("[SYNC_ERROR]", error);
      toast.error("Erro ao sincronizar catálogo", { id: "sync" });
    } finally {
      setSyncing(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Aplicar filtro de catálogo
    if (catalogFilter === 'public') {
      filtered = filtered.filter(product => product.showInPublicCatalog);
    }

    // Aplicar filtro de busca
    if (searchTerm) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Tipo de arquivo inválido. Use JPG, PNG ou WEBP.");
      return;
    }

    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Arquivo muito grande. Tamanho máximo: 5MB");
      return;
    }

    setSelectedImage(file);

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", selectedImage);
      
      if (editingProduct) {
        formData.append("productId", editingProduct.id);
      }

      const response = await fetch("/api/customer/products/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload");
      }

      const data = await response.json();
      return data.imageUrl;
    } catch (error: any) {
      console.error("[UPLOAD_IMAGE_ERROR]", error);
      toast.error(error.message || "Erro ao fazer upload da imagem");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.unitPrice) {
      toast.error("Nome e preço são obrigatórios");
      return;
    }

    try {
      // Fazer upload da imagem primeiro, se houver
      let imageUrl = editingProduct?.imageUrl || "";
      
      if (selectedImage) {
        const uploadedUrl = await handleUploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const payload = {
        ...formData,
        unitPrice: Number(formData.unitPrice),
        costPrice: formData.costPrice ? Number(formData.costPrice) : null,
        initialStock: formData.initialStock ? Number(formData.initialStock) : 0,
        minStock: formData.minStock ? Number(formData.minStock) : null,
        maxStock: formData.maxStock ? Number(formData.maxStock) : null,
        imageUrl: imageUrl || undefined,
      };

      const url = editingProduct
        ? `/api/customer/products/${editingProduct.id}`
        : "/api/customer/products";
      
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar produto");
      }

      toast.success(
        editingProduct ? "Produto atualizado!" : "Produto criado com sucesso!"
      );

      setShowNewProductDialog(false);
      setEditingProduct(null);
      resetForm();
      await loadProducts();
    } catch (error) {
      console.error("[SAVE_PRODUCT_ERROR]", error);
      toast.error("Erro ao salvar produto");
    }
  };

  const handleEdit = (product: ClientProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      category: product.category,
      unitPrice: product.unitPrice.toString(),
      costPrice: product.costPrice?.toString() || "",
      initialStock: product.Inventory?.currentStock.toString() || "",
      minStock: product.Inventory?.minStock?.toString() || "",
      maxStock: product.Inventory?.maxStock?.toString() || "",
      measurementUnit: product.Inventory?.measurementUnit || "UN",
    });
    
    // Carregar imagem existente para preview
    if (product.imageUrl) {
      setImagePreview(product.imageUrl);
    }
    
    setShowNewProductDialog(true);
  };

  const handleDelete = async (product: ClientProduct) => {
    if (!confirm(`Deseja realmente excluir "${product.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/customer/products/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir");
      }

      toast.success("Produto excluído!");
      await loadProducts();
    } catch (error: any) {
      console.error("[DELETE_PRODUCT_ERROR]", error);
      toast.error(error.message || "Erro ao excluir produto");
    }
  };

  const handleTogglePublic = async (product: ClientProduct) => {
    try {
      const response = await fetch(
        `/api/customer/products/${product.id}/toggle-public`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao atualizar visibilidade");
      }

      const newStatus = !product.showInPublicCatalog;
      toast.success(
        newStatus 
          ? "✅ Produto agora está visível na loja pública"
          : "🔒 Produto removido da loja pública"
      );

      await loadProducts();
    } catch (error) {
      console.error("[TOGGLE_PUBLIC_ERROR]", error);
      toast.error("Erro ao atualizar visibilidade");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "BEBIDA",
      unitPrice: "",
      costPrice: "",
      initialStock: "",
      minStock: "",
      maxStock: "",
      measurementUnit: "UN",
    });
    setSelectedImage(null);
    setImagePreview("");
  };

  const getStockStatus = (product: ClientProduct) => {
    if (!product.Inventory) {
      return {
        label: "Sem Estoque",
        color: "bg-slate-100 text-slate-600 border-slate-300",
        icon: <Package className="h-3 w-3" />,
      };
    }

    const { currentStock, minStock } = product.Inventory;

    if (minStock && currentStock <= minStock) {
      return {
        label: "Estoque Baixo",
        color: "bg-red-100 text-red-800 border-red-300",
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    }
    if (minStock && currentStock <= minStock * 1.5) {
      return {
        label: "Atenção",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: <TrendingDown className="h-3 w-3" />,
      };
    }
    return {
      label: "OK",
      color: "bg-green-100 text-green-800 border-green-300",
      icon: <BarChart3 className="h-3 w-3" />,
    };
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      ESPETO: "🍖 Espeto",
      BEBIDA: "🍺 Bebida",
      ACOMPANHAMENTO: "🍟 Acompanhamento",
      OUTRO: "📦 Outro",
    };
    return labels[category] || category;
  };

  const totalValue = products.reduce(
    (sum, product) =>
      sum + (product.costPrice || 0) * (product.Inventory?.currentStock || 0),
    0
  );

  const lowStockCount = products.filter(
    (p) =>
      p.Inventory &&
      p.Inventory.minStock &&
      p.Inventory.currentStock <= p.Inventory.minStock
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              BiStock - Gestão de Estoque
            </h1>
            <p className="text-slate-600 mt-1">
              Gerencie seus produtos e estoques
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/customer/gestao")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
        </div>


        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-6 bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">
                  {catalogFilter === 'public' ? 'Produtos no Catálogo Público' : 'Produtos no Meu Catálogo'}
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {filteredProducts.length}
                </p>
                {catalogFilter === 'all' && products.filter(p => p.showInPublicCatalog).length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {products.filter(p => p.showInPublicCatalog).length} no catálogo público
                  </p>
                )}
              </div>
              <ShoppingBag className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Valor Total</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {formatCurrency(totalValue)}
                </p>
              </div>
              <BarChart3 className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Estoque Baixo</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {lowStockCount}
                </p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-600 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Filtros de Catálogo */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-600 font-medium">Exibir:</span>
          <div className="flex gap-1 bg-white border-2 border-slate-200 rounded-md p-1">
            <Button
              size="sm"
              variant={catalogFilter === 'public' ? 'default' : 'ghost'}
              onClick={() => setCatalogFilter('public')}
              className={`h-8 ${catalogFilter === 'public' ? 'bg-green-600 text-white' : 'text-slate-600'}`}
            >
              <Store className="h-3 w-3 mr-1" />
              Meu Catálogo Público
              <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-900">
                {products.filter(p => p.showInPublicCatalog).length}
              </Badge>
            </Button>
            <Button
              size="sm"
              variant={catalogFilter === 'all' ? 'default' : 'ghost'}
              onClick={() => setCatalogFilter('all')}
              className={`h-8 ${catalogFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              <Package className="h-3 w-3 mr-1" />
              Todos (incluindo privados)
              <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-900">
                {products.length}
              </Badge>
            </Button>
          </div>
        </div>

        {/* Barra de Ações e Busca */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <Card className="flex-1 p-4 bg-white border-2 border-slate-200">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 outline-none text-slate-900"
              />
            </div>
          </Card>

          <Button
            onClick={() => {
              resetForm();
              setEditingProduct(null);
              setShowNewProductDialog(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>

          <Button
            onClick={handleSyncCatalog}
            disabled={syncing}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Catálogo
          </Button>
        </div>

        {/* Conteúdo */}
        {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-slate-600 mt-4">Carregando produtos...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <Card className="p-12 bg-white border-2 border-slate-200 text-center">
                <ShoppingBag className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">
                  {searchTerm
                    ? "Nenhum produto encontrado"
                    : "Nenhum produto cadastrado"}
                </p>
                <p className="text-slate-500 text-sm mt-2 mb-4">
                  {searchTerm
                    ? "Tente buscar com outros termos"
                    : "Cadastre produtos manualmente ou sincronize com seu catálogo"}
                </p>
                <Button
                  onClick={handleSyncCatalog}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Catálogo
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product);

                  return (
                    <Card
                      key={product.id}
                      className="p-5 bg-white border-2 border-slate-200 hover:border-blue-300 transition-all"
                    >
                      {/* Header do Card */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-lg">
                            {product.name}
                          </h3>
                          <p className="text-sm text-blue-600">
                            {getCategoryLabel(product.category)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTogglePublic(product)}
                            className={`h-8 w-8 p-0 ${
                              product.showInPublicCatalog
                                ? "text-green-600 hover:text-green-700"
                                : "text-gray-400 hover:text-gray-500"
                            }`}
                            title={
                              product.showInPublicCatalog
                                ? "Visível na loja pública (clique para ocultar)"
                                : "Oculto na loja pública (clique para mostrar)"
                            }
                          >
                            {product.showInPublicCatalog ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(product)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(product)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Descrição */}
                      {product.description && (
                        <p className="text-sm text-slate-600 mb-3">
                          {product.description}
                        </p>
                      )}

                      {/* Informações */}
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">
                            Preço de Venda:
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(product.unitPrice)}
                          </span>
                        </div>

                        {product.costPrice && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">
                              Custo:
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatCurrency(product.costPrice)}
                            </span>
                          </div>
                        )}

                        {product.Inventory && (
                          <>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                              <span className="text-sm text-slate-600">
                                Estoque:
                              </span>
                              <Badge
                                className={`${stockStatus.color} flex items-center gap-1`}
                              >
                                {stockStatus.icon}
                                {product.Inventory.currentStock}{" "}
                                {product.Inventory.measurementUnit}
                              </Badge>
                            </div>

                            {product.Inventory.minStock && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">
                                  Estoque Mínimo:
                                </span>
                                <span className="text-xs text-slate-500">
                                  {product.Inventory.minStock}{" "}
                                  {product.Inventory.measurementUnit}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={product.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {product.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        {product.trackInventory && (
                          <Badge variant="outline" className="text-xs">
                            Controla Estoque
                          </Badge>
                        )}
                        {product.showInPublicCatalog && (
                          <Badge 
                            className="text-xs bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            <Store className="h-3 w-3 mr-1" />
                            Na Loja
                          </Badge>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

      </div>

      {/* Dialog de Novo/Editar Produto */}
      {showNewProductDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewProductDialog(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nome do Produto *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Categoria *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="ESPETO">🍖 Espeto</option>
                      <option value="BEBIDA">🍺 Bebida</option>
                      <option value="ACOMPANHAMENTO">🍟 Acompanhamento</option>
                      <option value="OUTRO">📦 Outro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                {/* Upload de Imagem */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    📸 Foto do Produto
                  </label>
                  <div className="space-y-3">
                    {/* Preview da imagem */}
                    {imagePreview && (
                      <div className="relative w-32 h-32 border-2 border-slate-300 rounded-lg overflow-hidden">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Input de arquivo */}
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        id="product-image"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="product-image"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border-2 border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Package className="h-4 w-4" />
                        {imagePreview ? "Trocar Foto" : "Escolher Foto"}
                      </label>
                      {selectedImage && (
                        <span className="text-sm text-slate-600">
                          {selectedImage.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 5MB
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Preço de Venda *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.unitPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, unitPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Custo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-900 mb-3">
                    Controle de Estoque
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Estoque Inicial
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.initialStock}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            initialStock: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Estoque Mínimo
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.minStock}
                        onChange={(e) =>
                          setFormData({ ...formData, minStock: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Unidade
                      </label>
                      <select
                        value={formData.measurementUnit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            measurementUnit: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="UN">Unidade</option>
                        <option value="KG">Quilograma</option>
                        <option value="L">Litro</option>
                        <option value="PCT">Pacote</option>
                        <option value="CX">Caixa</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewProductDialog(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    disabled={uploadingImage}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Fazendo Upload...
                      </>
                    ) : (
                      editingProduct ? "Salvar Alterações" : "Criar Produto"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}