
'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Eye, EyeOff, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface Product {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  priceWholesale: number
  category: string
  isVisible: boolean
  customPrice: number | null
  customerProductId: string | null
}

interface Customer {
  id: string
  name: string
  useCustomCatalog: boolean
}

export default function SellerCustomerCatalogPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [useCustomCatalog, setUseCustomCatalog] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'SELLER') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'SELLER') {
      fetchCatalog()
    }
  }, [session, status, router, customerId])

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`/api/sellers/customers/${customerId}/catalog`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao carregar catálogo')
        return
      }

      setCustomer(data.customer)
      setProducts(data.products)
      setUseCustomCatalog(data.customer.useCustomCatalog)
    } catch (error) {
      console.error('Error fetching catalog:', error)
      toast.error('Erro ao carregar catálogo')
    } finally {
      setLoading(false)
    }
  }

  const handleVisibilityToggle = (productId: string) => {
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
    setSaving(true)

    try {
      // Preparar apenas os produtos que foram modificados
      const modifiedProducts = products.map(p => ({
        productId: p.id,
        isVisible: p.isVisible,
        customPrice: p.customPrice
      }))

      const res = await fetch(`/api/sellers/customers/${customerId}/catalog`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCustomCatalog,
          products: modifiedProducts
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar catálogo')
        return
      }

      toast.success('Catálogo atualizado com sucesso!')
    } catch (error) {
      console.error('Error saving catalog:', error)
      toast.error('Erro ao salvar catálogo')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session || (session.user as any)?.userType !== 'SELLER') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Gerenciar Catálogo
            </h1>
            <p className="text-gray-600">
              Configure produtos e preços para <strong>{customer?.name}</strong>
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Configuração do Catálogo</CardTitle>
            <CardDescription>
              Ative ou desative o catálogo personalizado para este cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                checked={useCustomCatalog}
                onCheckedChange={setUseCustomCatalog}
                id="custom-catalog"
              />
              <Label htmlFor="custom-catalog">
                Usar catálogo personalizado
              </Label>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {useCustomCatalog 
                ? 'O cliente verá apenas os produtos que você marcar como visíveis' 
                : 'O cliente verá todos os produtos do catálogo padrão'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Produtos</CardTitle>
                <CardDescription>
                  {products.length} produtos disponíveis
                </CardDescription>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Imagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço Padrão</TableHead>
                    <TableHead>Preço Customizado</TableHead>
                    <TableHead className="text-center">Visível</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-100">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                              Sem foto
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground">
                              {product.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          R$ {product.priceWholesale.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.customPrice ?? ''}
                            onChange={(e) => handleCustomPriceChange(product.id, e.target.value)}
                            placeholder={product.priceWholesale.toFixed(2)}
                            className="w-32"
                          />
                        </div>
                        {product.customPrice && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {product.customPrice < product.priceWholesale 
                              ? '🔽 Desconto' 
                              : '🔼 Acréscimo'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVisibilityToggle(product.id)}
                          className={product.isVisible ? 'text-green-600' : 'text-gray-400'}
                        >
                          {product.isVisible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
