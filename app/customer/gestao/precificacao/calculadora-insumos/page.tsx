'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Calculator, Home, ArrowLeft, Save, RotateCcw, Info } from 'lucide-react'

interface CalculationResult {
  totalCost: number
  costPerUnit: number
  breakdown: {
    itemCost: number
    shippingCost: number
    taxCost: number
    otherCosts: number
  }
}

export default function ClientCalculadoraInsumosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Embalagem')
  const [purchasePrice, setPurchasePrice] = useState<number>(0)
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(1)
  const [shippingCost, setShippingCost] = useState<number>(0)
  const [taxPercent, setTaxPercent] = useState<number>(0)
  const [otherCosts, setOtherCosts] = useState<number>(0)
  const [unit, setUnit] = useState('unidade')
  const [notes, setNotes] = useState('')

  // Results
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user) {
      const userType = (session.user as any)?.userType
      if (userType !== 'CUSTOMER') {
        toast.error('Acesso não autorizado')
        router.push('/customer/gestao')
        return
      }
    }
  }, [status, session, router])

  const handleCalculate = () => {
    if (purchasePrice <= 0 || purchaseQuantity <= 0) {
      toast.error('Preço de compra e quantidade devem ser maiores que zero')
      return
    }

    const taxCost = (purchasePrice * taxPercent) / 100
    const totalCost = purchasePrice + shippingCost + taxCost + otherCosts
    const costPerUnit = totalCost / purchaseQuantity

    const calculationResult: CalculationResult = {
      totalCost,
      costPerUnit,
      breakdown: {
        itemCost: purchasePrice,
        shippingCost,
        taxCost,
        otherCosts
      }
    }

    setResult(calculationResult)
  }

  const handleReset = () => {
    setName('')
    setCategory('Embalagem')
    setPurchasePrice(0)
    setPurchaseQuantity(1)
    setShippingCost(0)
    setTaxPercent(0)
    setOtherCosts(0)
    setUnit('unidade')
    setNotes('')
    setResult(null)
  }

  const handleSaveToCatalog = async () => {
    if (!name) {
      toast.error('Informe o nome do insumo')
      return
    }

    if (!result) {
      toast.error('Calcule o custo antes de salvar')
      return
    }

    try {
      setLoading(true)

      const payload = {
        name,
        category,
        costPerUnit: result.costPerUnit,
        unit,
        notes,
        isActive: true
      }

      const response = await fetch('/api/client-management/pricing/supplies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success('Insumo salvo no catálogo com sucesso!')
        setShowSaveDialog(false)
        handleReset()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao salvar insumo')
      }
    } catch (error) {
      console.error('Erro ao salvar insumo:', error)
      toast.error('Erro ao salvar insumo')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Calculadora de Insumos</h1>
              <p className="text-gray-600">Calcule o custo unitário real dos seus insumos</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/customer/gestao')}
            >
              <Home className="mr-2 h-4 w-4" />
              Página Inicial
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Como usar esta calculadora:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Informe o preço de compra e a quantidade adquirida</li>
                <li>Adicione custos extras como frete, impostos e outros</li>
                <li>Clique em "Calcular" para ver o custo unitário real</li>
                <li>Salve no catálogo para usar em receitas futuras</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Dados do insumo a ser calculado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do Insumo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Caixa de Papelão"
                />
              </div>

              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Embalagem">Embalagem</SelectItem>
                    <SelectItem value="Utensílio">Utensílio</SelectItem>
                    <SelectItem value="Consumível">Consumível</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Unidade de Medida</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">unidade</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="pacote">pacote</SelectItem>
                    <SelectItem value="caixa">caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Compra</CardTitle>
              <CardDescription>
                Informações sobre a aquisição do insumo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço de Compra (R$) *</Label>
                  <Input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Label>Quantidade Comprada *</Label>
                  <Input
                    type="number"
                    value={purchaseQuantity}
                    onChange={(e) => setPurchaseQuantity(parseFloat(e.target.value) || 1)}
                    placeholder="1"
                    step="1"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <Label>Frete (R$)</Label>
                <Input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <Label>Impostos (%)</Label>
                <Input
                  type="number"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  step="0.1"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Percentual sobre o preço de compra
                </p>
              </div>

              <div>
                <Label>Outros Custos (R$)</Label>
                <Input
                  type="number"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Taxas, embalagem, manuseio, etc.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre fornecedor, qualidade, etc..."
                className="w-full min-h-[100px] p-2 border rounded-md"
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleCalculate}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              size="lg"
            >
              <Calculator className="mr-2 h-5 w-5" />
              Calcular Custo
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Limpar
            </Button>
          </div>
        </div>

        {/* Results */}
        {result ? (
          <div className="space-y-6">
            {/* Main Result */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800">Custo Unitário Calculado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-green-600 mb-2">
                    {formatCurrency(result.costPerUnit)}
                  </div>
                  <p className="text-gray-700">por {unit}</p>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Custos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Preço do Item:</span>
                  <span className="font-semibold">
                    {formatCurrency(result.breakdown.itemCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Frete:</span>
                  <span className="font-semibold">
                    {formatCurrency(result.breakdown.shippingCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Impostos ({taxPercent}%):</span>
                  <span className="font-semibold">
                    {formatCurrency(result.breakdown.taxCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Outros Custos:</span>
                  <span className="font-semibold">
                    {formatCurrency(result.breakdown.otherCosts)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t-2">
                  <span className="font-bold text-gray-800">Custo Total:</span>
                  <span className="font-bold text-lg text-orange-600">
                    {formatCurrency(result.totalCost)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantidade:</span>
                  <span className="font-semibold">{purchaseQuantity} {unit}(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Custo por {unit}:</span>
                  <span className="font-bold text-green-600 text-lg">
                    {formatCurrency(result.costPerUnit)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Save to Catalog */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">Salvar no Catálogo</CardTitle>
                <CardDescription className="text-blue-700">
                  Adicione este insumo ao catálogo global para usar em receitas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-white rounded space-y-1 text-sm">
                  <p><strong>Nome:</strong> {name || '(sem nome)'}</p>
                  <p><strong>Categoria:</strong> {category}</p>
                  <p><strong>Custo Unitário:</strong> {formatCurrency(result.costPerUnit)}/{unit}</p>
                </div>
                <Button
                  onClick={() => setShowSaveDialog(true)}
                  disabled={!name}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Save className="mr-2 h-5 w-5" />
                  Salvar no Catálogo
                </Button>
                {!name && (
                  <p className="text-xs text-blue-700 text-center">
                    Informe o nome do insumo para salvar
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">Nenhum cálculo realizado</p>
              <p className="text-gray-500 text-sm">
                Preencha os dados à esquerda e clique em "Calcular Custo"
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Salvamento</DialogTitle>
            <DialogDescription>
              Deseja salvar este insumo no catálogo global?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="p-3 bg-gray-50 rounded space-y-1 text-sm">
              <p><strong>Nome:</strong> {name}</p>
              <p><strong>Categoria:</strong> {category}</p>
              <p><strong>Custo Unitário:</strong> {result && formatCurrency(result.costPerUnit)}/{unit}</p>
              {notes && <p><strong>Observações:</strong> {notes}</p>}
            </div>

            <p className="text-sm text-gray-600">
              Este insumo ficará disponível para uso em receitas futuras.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveToCatalog}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
