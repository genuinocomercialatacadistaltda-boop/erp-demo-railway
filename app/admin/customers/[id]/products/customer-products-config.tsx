
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Package } from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  id: string
  name: string
  priceWholesale: number
  priceRetail: number
  customPrice: number | null
  isVisible: boolean
  hasCustomConfig: boolean
  imageUrl: string
  description: string
  type: 'product' | 'rawMaterial'
  isRawMaterial: boolean
}

interface CustomerProductsConfigProps {
  customer: {
    id: string
    name: string
    useCustomCatalog: boolean
  }
  products: Product[]
}

export function CustomerProductsConfig({ customer, products: initialProducts }: CustomerProductsConfigProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [useCustomCatalog, setUseCustomCatalog] = useState(customer.useCustomCatalog)
  const [products, setProducts] = useState(initialProducts)

  const handleToggleProduct = (productId: string) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, isVisible: !p.isVisible } : p
    ))
  }

  const handleCustomPriceChange = (productId: string, value: string) => {
    const price = value === '' ? null : parseFloat(value)
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, customPrice: price } : p
    ))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      console.log('🔧 Salvando configuração de catálogo...')
      
      // 🔧 CORREÇÃO: Separar produtos e matérias-primas corretamente
      const preparedProducts = products.map(p => {
        if (p.isRawMaterial || p.type === 'rawMaterial') {
          // Para matérias-primas, usar rawMaterialId
          return {
            id: p.id,
            rawMaterialId: p.id, // 🔧 Campo correto para matérias-primas
            customPrice: p.customPrice,
            isVisible: p.isVisible,
            type: 'rawMaterial',
            isRawMaterial: true
          }
        } else {
          // Para produtos, usar productId
          return {
            id: p.id,
            productId: p.id, // 🔧 Campo correto para produtos
            customPrice: p.customPrice,
            isVisible: p.isVisible,
            type: 'product',
            isRawMaterial: false
          }
        }
      })

      console.log('📦 Dados preparados:', {
        total: preparedProducts.length,
        produtos: preparedProducts.filter(p => p.type === 'product').length,
        materiasPrimas: preparedProducts.filter(p => p.type === 'rawMaterial').length
      })
      
      const response = await fetch(`/api/customers/${customer.id}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCustomCatalog,
          products: preparedProducts
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ Erro ao salvar:', errorData)
        throw new Error('Erro ao salvar')
      }

      console.log('✅ Configuração salva com sucesso!')
      toast.success('Configuração salva com sucesso!')
      router.push('/admin/customers')
      router.refresh()
    } catch (error) {
      console.error('❌ Erro ao salvar:', error)
      toast.error('Erro ao salvar configuração')
    } finally {
      setLoading(false)
    }
  }

  const visibleCount = products.filter(p => p.isVisible).length
  const customPriceCount = products.filter(p => p.customPrice !== null).length

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/customers')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Gerenciamento de Catálogo</h1>
        <p className="text-muted-foreground">
          Cliente: <span className="font-semibold">{customer.name}</span>
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuração de Catálogo</CardTitle>
          <CardDescription>
            Escolha como o cliente verá os produtos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="custom-catalog" className="text-base font-semibold">
                Usar Catálogo Personalizado
              </Label>
              <p className="text-sm text-muted-foreground">
                {useCustomCatalog 
                  ? 'Cliente verá apenas os produtos marcados como visíveis abaixo' 
                  : 'Cliente verá TODOS os produtos disponíveis (padrão)'}
              </p>
            </div>
            <Switch
              id="custom-catalog"
              checked={useCustomCatalog}
              onCheckedChange={setUseCustomCatalog}
            />
          </div>

          {useCustomCatalog && (
            <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{visibleCount}</span> produtos visíveis
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="font-semibold">{customPriceCount}</span> com preço personalizado
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos Disponíveis</CardTitle>
          <CardDescription>
            {useCustomCatalog 
              ? 'Selecione os produtos que aparecerão no catálogo e defina preços personalizados' 
              : 'Defina preços personalizados (opcionais). Todos os produtos aparecerão no catálogo.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                {useCustomCatalog && (
                  <Switch
                    checked={product.isVisible}
                    onCheckedChange={() => handleToggleProduct(product.id)}
                  />
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    {product.isRawMaterial && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                        Matéria-Prima
                      </Badge>
                    )}
                    {product.customPrice !== null && (
                      <Badge variant="secondary" className="text-xs">
                        Preço Personalizado
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Preço padrão: R$ {product.priceWholesale.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor={`price-${product.id}`} className="text-sm whitespace-nowrap">
                    Preço Personalizado:
                  </Label>
                  <Input
                    id={`price-${product.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={product.priceWholesale.toFixed(2)}
                    value={product.customPrice ?? ''}
                    onChange={(e) => handleCustomPriceChange(product.id, e.target.value)}
                    className="w-32"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 mt-6">
        <Button variant="outline" onClick={() => router.push('/admin/customers')}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </div>
    </div>
  )
}
