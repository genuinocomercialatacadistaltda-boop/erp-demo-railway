'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  productName: string;
  productImage: string | null;
  defaultPrice: number;
  customPrice: number | null;
  pointsPerUnit: number;
  quantity: number;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  
  // Form fields
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('DINHEIRO');

  useEffect(() => {
    const cartParam = searchParams?.get('cart');
    if (cartParam) {
      try {
        const parsedCart = JSON.parse(cartParam);
        setCart(parsedCart);
      } catch (error) {
        toast.error('Erro ao carregar carrinho');
        router.push('/client-customer/catalog');
      }
    } else {
      router.push('/client-customer/catalog');
    }

    loadProfile();
  }, [searchParams]);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/client-customer/profile');
      const data = await res.json();
      if (data.success) {
        setPointsBalance(data.profile.pointsBalance || 0);
        setDeliveryAddress(data.profile.address || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const getSubtotal = () => {
    return cart.reduce(
      (sum, item) => sum + (item.customPrice || item.defaultPrice) * item.quantity,
      0
    );
  };

  const getDiscount = () => {
    if (!usePoints) return 0;
    return Math.min(pointsToUse, getSubtotal());
  };

  const getTotal = () => {
    return getSubtotal() - getDiscount();
  };

  const getTotalPoints = () => {
    return Math.floor(
      cart.reduce((sum, item) => sum + item.pointsPerUnit * item.quantity, 0)
    );
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      toast.error('Por favor, informe o endereço de entrega');
      return;
    }

    setLoading(true);
    try {
      const items = cart.map((item) => ({
        catalogItemId: item.id,
        quantity: item.quantity,
      }));

      const res = await fetch('/api/client-customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          deliveryAddress,
          deliveryNotes,
          paymentMethod,
          usePoints,
          pointsToUse: usePoints ? pointsToUse : 0,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Pedido realizado com sucesso!');
        router.push('/client-customer/orders');
      } else {
        toast.error(data.message || 'Erro ao criar pedido');
      }
    } catch (error) {
      toast.error('Erro ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finalizar Pedido</h1>
        <p className="text-gray-600 mt-2">Revise seu pedido e confirme os dados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Itens do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.map((item) => {
                const price = item.customPrice || item.defaultPrice;
                return (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} x R$ {price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      R$ {(price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Dados de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Endereço de Entrega *</Label>
                <Input
                  id="address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Ponto de referência, instruções especiais..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle>Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['DINHEIRO', 'PIX', 'CARTÃO', 'FIADO'].map((method) => (
                  <label key={method} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="form-radio"
                    />
                    <span>{method}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>R$ {getSubtotal().toFixed(2)}</span>
              </div>

              {/* Points */}
              {pointsBalance > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="usePoints"
                      checked={usePoints}
                      onCheckedChange={(checked) => {
                        setUsePoints(checked as boolean);
                        if (!checked) setPointsToUse(0);
                      }}
                    />
                    <Label htmlFor="usePoints" className="cursor-pointer">
                      Usar pontos (disponível: {Math.floor(pointsBalance)})
                    </Label>
                  </div>
                  {usePoints && (
                    <Input
                      type="number"
                      min="0"
                      max={Math.min(pointsBalance, getSubtotal())}
                      value={pointsToUse}
                      onChange={(e) =>
                        setPointsToUse(
                          Math.min(
                            parseFloat(e.target.value) || 0,
                            Math.min(pointsBalance, getSubtotal())
                          )
                        )
                      }
                      placeholder="Quantos pontos usar?"
                    />
                  )}
                  {usePoints && pointsToUse > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto (pontos)</span>
                      <span>- R$ {getDiscount().toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-green-600">R$ {getTotal().toFixed(2)}</span>
              </div>

              <div className="text-sm text-gray-600 text-center">
                Você vai ganhar <span className="font-semibold">{getTotalPoints()}</span> pontos
              </div>

              <Button
                onClick={handlePlaceOrder}
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? 'Enviando...' : 'Confirmar Pedido'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ClientCustomerCheckout() {
  return (
    <Suspense fallback={
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
