'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, User } from 'lucide-react'
import { HomeButton } from '@/components/home-button'

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  creditLimit: number
  sellerId: string
}

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  priceWholesale: number
  priceRetail: number
  quantityIncrement: number
  soldByWeight?: boolean
  bulkDiscountMinQty?: number | null
  bulkDiscountPrice?: number | null
}

interface CartItem {
  productId: string
  product: Product
  quantity: number
}

export default function PedidoFuncionarioPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [orderType, setOrderType] = useState<'WHOLESALE' | 'RETAIL'>('WHOLESALE')
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('PICKUP')
  const [deliveryDate, setDeliveryDate] = useState<string>('')
  const [deliveryTime, setDeliveryTime] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchEmployees()
    fetchProducts()
  }, [])

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/hr/employees')
      if (!res.ok) throw new Error('Erro ao buscar funcionários')
      const data = await res.json()
      
      // Filtrar apenas funcionários ativos com sellerId
      const activeWithSeller = data.filter((emp: any) => 
        emp.isActive && emp.sellerId && emp.status === 'ACTIVE'
      )
      
      setEmployees(activeWithSeller)
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error)
      toast.error('Erro ao carregar funcionários')
    } finally {
      setLoadingEmployees(false)
    }
  }

  const fetchProducts = async () => {
    try {
      console.log('[FRONTEND] Buscando produtos via /api/products/catalog...')
      const res = await fetch('/api/products/catalog')
      if (!res.ok) throw new Error('Erro ao buscar produtos')
      const data = await res.json()
      console.log('[FRONTEND] Dados recebidos:', {
        temPropriedadeProducts: 'products' in data,
        ehArray: Array.isArray(data.products),
        quantidade: data.products?.length || 0,
        materiaPrimas: data.products?.filter((p: any) => p.isRawMaterial).length || 0
      })
      setProducts(data.products || [])
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoadingProducts(false)
    }
  }

  const addItem = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id)
    if (existingItem) {
      updateQuantity(
        product.id,
        existingItem.quantity + (product.soldByWeight ? 0.1 : product.quantityIncrement)
      )
    } else {
      setCart([...cart, {
        productId: product.id,
        product,
        quantity: product.soldByWeight ? 0.1 : product.quantityIncrement
      }])
    }
  }

  const removeItem = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId))
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find(i => i.productId === productId)
    if (!item) return

    const minQty = item.product.soldByWeight ? 0.001 : item.product.quantityIncrement
    if (newQuantity < minQty) {
      removeItem(productId)
      return
    }

    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const getUnitPrice = (product: Product, quantity: number) => {
    // Aplicar desconto progressivo se configurado
    if (product.bulkDiscountMinQty && product.bulkDiscountPrice && quantity >= product.bulkDiscountMinQty) {
      return product.bulkDiscountPrice
    }
    return orderType === 'WHOLESALE' ? product.priceWholesale : product.priceRetail
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const unitPrice = getUnitPrice(item.product, item.quantity)
      return sum + (unitPrice * item.quantity)
    }, 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const handleSubmit = async () => {
    // Validações
    if (!selectedEmployee) {
      toast.error('Selecione um funcionário')
      return
    }

    if (cart.length === 0) {
      toast.error('Adicione pelo menos um produto ao carrinho')
      return
    }

    if (!deliveryDate) {
      toast.error('Informe a data de entrega/retirada')
      return
    }

    if (!paymentMethod) {
      toast.error('Selecione a forma de pagamento')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/employee-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.sellerId,
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          })),
          orderType,
          deliveryType,
          deliveryDate,
          deliveryTime: deliveryTime || null,
          paymentMethod,
          notes
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar pedido')
      }

      toast.success(`Pedido ${data.orderNumber} criado com sucesso!`)
      router.push('/admin/orders')
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error)
      toast.error(error.message || 'Erro ao criar pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const subtotal = calculateSubtotal()

  if (status === 'loading' || loadingEmployees || loadingProducts) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pedido para Funcionário</h1>
              <p className="text-gray-600 mt-1">Crie um pedido para um funcionário</p>
            </div>
          </div>
          <HomeButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda: Seleção de Funcionário e Produtos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Seleção de Funcionário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Selecionar Funcionário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedEmployee?.id || ''}
                  onValueChange={(value) => {
                    const employee = employees.find(e => e.id === value)
                    setSelectedEmployee(employee || null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(employee => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} - Limite: {formatCurrency(employee.creditLimit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedEmployee && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Funcionário Selecionado:</p>
                    <p className="text-lg font-bold text-blue-900">{selectedEmployee.name}</p>
                    <p className="text-sm text-blue-700">Email: {selectedEmployee.email}</p>
                    <p className="text-sm text-blue-700">Telefone: {selectedEmployee.phone}</p>
                    <p className="text-sm font-medium text-blue-900 mt-2">
                      Limite de Crédito: {formatCurrency(selectedEmployee.creditLimit)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lista de Produtos */}
            {selectedEmployee && (
              <Card>
                <CardHeader>
                  <CardTitle>Produtos Disponíveis</CardTitle>
                  <CardDescription>Busque e adicione produtos ao pedido</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-4"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => addItem(product)}
                      >
                        <div className="flex gap-3">
                          <div className="relative w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                            <Image
                              src={product.imageUrl || '/placeholder.png'}
                              alt={product.name}
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{product.name}</h4>
                            <p className="text-xs text-gray-600 truncate">{product.description}</p>
                            <p className="text-sm font-bold text-orange-600 mt-1">
                              {formatCurrency(orderType === 'WHOLESALE' ? product.priceWholesale : product.priceRetail)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Direita: Carrinho e Checkout */}
          <div className="space-y-6">
            {/* Carrinho */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrinho
                </CardTitle>
                <CardDescription>
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Carrinho vazio</p>
                ) : (
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.productId} className="flex items-center gap-3 pb-3 border-b">
                        <div className="relative w-12 h-12 bg-gray-100 rounded flex-shrink-0">
                          <Image
                            src={item.product.imageUrl || '/placeholder.png'}
                            alt={item.product.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs truncate">{item.product.name}</h4>
                          <p className="text-xs text-gray-600">
                            {formatCurrency(getUnitPrice(item.product, item.quantity))}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => updateQuantity(
                                item.productId,
                                item.quantity - (item.product.soldByWeight ? 0.1 : item.product.quantityIncrement)
                              )}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs w-10 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => updateQuantity(
                                item.productId,
                                item.quantity + (item.product.soldByWeight ? 0.1 : item.product.quantityIncrement)
                              )}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 w-5 p-0 text-red-600"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-sm">
                            {formatCurrency(getUnitPrice(item.product, item.quantity) * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="my-4" />

                <div className="space-y-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-orange-600">{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detalhes do Pedido */}
            {cart.length > 0 && selectedEmployee && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo de Pedido</Label>
                    <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WHOLESALE">Atacado</SelectItem>
                        <SelectItem value="RETAIL">Varejo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tipo de Entrega</Label>
                    <Select value={deliveryType} onValueChange={(value: any) => setDeliveryType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DELIVERY">Entrega</SelectItem>
                        <SelectItem value="PICKUP">Retirada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data de Entrega/Retirada *</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Horário (Opcional)</Label>
                    <Input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Forma de Pagamento *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="CASH">Dinheiro</SelectItem>
                        <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                        <SelectItem value="DEBIT">Débito</SelectItem>
                        <SelectItem value="CARD">Cartão (Genérico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Observações (Opcional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicione observações sobre o pedido..."
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || cart.length === 0}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? 'Finalizando...' : `Finalizar Pedido - ${formatCurrency(subtotal)}`}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
