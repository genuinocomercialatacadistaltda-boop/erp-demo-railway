'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface CatalogItem {
  id: string;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  defaultPrice: number;
  customPrice: number | null;
  pointsPerUnit: number;
}

interface CartItem extends CatalogItem {
  quantity: number;
}

export default function ClientCustomerCatalog() {
  const router = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      const res = await fetch('/api/client-customer/catalog');
      const data = await res.json();

      if (data.success) {
        setItems(data.items);
      } else {
        toast.error('Erro ao carregar catálogo');
      }
    } catch (error) {
      toast.error('Erro ao carregar catálogo');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: CatalogItem) => {
    const existingItem = cart.find((i) => i.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.productName} adicionado ao carrinho`);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      cart
        .map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const getCartTotal = () => {
    return cart.reduce(
      (sum, item) => sum + (item.customPrice || item.defaultPrice) * item.quantity,
      0
    );
  };

  const getCartTotalPoints = () => {
    return Math.floor(
      cart.reduce((sum, item) => sum + item.pointsPerUnit * item.quantity, 0)
    );
  };

  const filteredItems = items.filter(
    (item) =>
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      (item.productDescription?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }
    // Navegar para página de checkout (implementar depois)
    router.push(`/client-customer/checkout?cart=${JSON.stringify(cart)}`);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo</h1>
          <p className="text-gray-600 mt-2">Escolha os produtos que deseja pedir</p>
        </div>
      </div>

      {/* Search */}
      <Input
        type="text"
        placeholder="Buscar produtos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Cart Summary */}
      {cart.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'} no carrinho
                </p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {getCartTotal().toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                  Você vai ganhar {getCartTotalPoints()} pontos
                </p>
              </div>
              <Button onClick={handleCheckout} size="lg">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Finalizar Pedido
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const price = item.customPrice || item.defaultPrice;
            const cartItem = cart.find((i) => i.id === item.id);
            const quantity = cartItem?.quantity || 0;

            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="relative aspect-video bg-gray-200">
                  {item.productImage ? (
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <span className="text-6xl">🍖</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg">{item.productName}</h3>
                  {item.productDescription && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {item.productDescription}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {price.toFixed(2)}
                      </p>
                      {item.pointsPerUnit > 0 && (
                        <p className="text-xs text-gray-500">
                          +{Math.floor(item.pointsPerUnit)} pontos
                        </p>
                      )}
                    </div>
                    {quantity === 0 ? (
                      <Button onClick={() => addToCart(item)} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => updateQuantity(item.id, -1)}
                          size="sm"
                          variant="outline"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold w-8 text-center">{quantity}</span>
                        <Button
                          onClick={() => updateQuantity(item.id, 1)}
                          size="sm"
                          variant="outline"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
