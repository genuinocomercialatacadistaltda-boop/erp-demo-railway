'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator, Plus, Trash2, Home, ArrowLeft, Package, DollarSign, TrendingUp, Download, Save, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

interface Insumo {
  id: string
  nome: string
  precoPacote: number
  quantidadeNoPacote: number
  unidadeMedida: string
  quantidadeProdutosQueFaz: number
  custoUnitario: number
  custoPorProduto: number
}

interface CompoundSupply {
  id: string
  name: string
  costPerUnit: number
  unit: string
  yieldAmount?: number
  SupplyRecipe?: {
    id: string
    yieldAmount: number
    yieldUnit: string
    estimatedCost: number
  }
}

interface CalculoComposto {
  id: string
  insumo: CompoundSupply
  custoPorUnidade: number // R$/kg ou R$/unidade
  unidade: string
  quantidadeUsadaPorProduto: number // em gramas ou unidades
  pesoProdutoFinal?: number // informativo
  rendimento: number // quantos produtos com 1 unidade
  custoPorProduto: number // custo do insumo por produto
}

export default function CalculadoraInsumosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [novoInsumo, setNovoInsumo] = useState({
    nome: '',
    precoPacote: '',
    quantidadeNoPacote: '',
    unidadeMedida: 'unidades',
    quantidadeProdutosQueFaz: ''
  })
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [insumoParaSalvar, setInsumoParaSalvar] = useState<Insumo | null>(null)
  const [categoriaEscolhida, setCategoriaEscolhida] = useState('EMBALAGEM')
  
  // Estados para insumos compostos
  const [compoundSupplies, setCompoundSupplies] = useState<CompoundSupply[]>([])
  const [loadingCompounds, setLoadingCompounds] = useState(false)
  const [calculosCompostos, setCalculosCompostos] = useState<CalculoComposto[]>([])
  const [novoCalculoComposto, setNovoCalculoComposto] = useState({
    supplyId: '',
    quantidadePorKg: '', // gramas por kg de produto (ex: 20g por kg)
    pesoProdutoFinal: '' // gramas do produto final (ex: 135g)
  })

  // Carregar insumos compostos ao montar
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCompoundSupplies()
    }
  }, [status])

  const fetchCompoundSupplies = async () => {
    try {
      setLoadingCompounds(true)
      console.log('[CALCULADORA] Carregando insumos compostos...')
      
      const res = await fetch('/api/supplies?hasRecipe=true')
      const data = await res.json()
      
      if (res.ok) {
        setCompoundSupplies(data)
        console.log('[CALCULADORA] Insumos compostos carregados:', data.length)
      } else {
        toast.error('Erro ao carregar insumos compostos')
      }
    } catch (error: any) {
      console.error('[CALCULADORA] Erro ao carregar compostos:', error)
      toast.error('Erro ao carregar insumos compostos')
    } finally {
      setLoadingCompounds(false)
    }
  }

  // Redirect if not authenticated or not admin
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || (session?.user as any)?.userType !== 'ADMIN') {
    router.push('/auth/login')
    return null
  }

  const calcularInsumo = () => {
    const precoPacote = parseFloat(novoInsumo.precoPacote)
    const quantidadeNoPacote = parseFloat(novoInsumo.quantidadeNoPacote)
    const quantidadeProdutosQueFaz = parseFloat(novoInsumo.quantidadeProdutosQueFaz)

    if (!novoInsumo.nome || !precoPacote || !quantidadeNoPacote || !quantidadeProdutosQueFaz) {
      toast.error('Preencha todos os campos')
      return
    }

    if (precoPacote <= 0 || quantidadeNoPacote <= 0 || quantidadeProdutosQueFaz <= 0) {
      toast.error('Os valores devem ser maiores que zero')
      return
    }

    // Custo unitário: quanto custa cada unidade do pacote
    const custoUnitario = precoPacote / quantidadeNoPacote

    // Custo por produto: preço do pacote dividido pela quantidade de produtos que faz
    const custoPorProduto = precoPacote / quantidadeProdutosQueFaz

    const novoItem: Insumo = {
      id: Date.now().toString(),
      nome: novoInsumo.nome,
      precoPacote,
      quantidadeNoPacote,
      unidadeMedida: novoInsumo.unidadeMedida,
      quantidadeProdutosQueFaz,
      custoUnitario,
      custoPorProduto
    }

    setInsumos([...insumos, novoItem])
    setNovoInsumo({
      nome: '',
      precoPacote: '',
      quantidadeNoPacote: '',
      unidadeMedida: 'unidades',
      quantidadeProdutosQueFaz: ''
    })
    toast.success(`Insumo "${novoItem.nome}" adicionado com sucesso!`)
  }

  const removerInsumo = (id: string) => {
    setInsumos(insumos.filter(i => i.id !== id))
    toast.success('Insumo removido')
  }

  const calcularInsumoComposto = () => {
    const quantidadePorKg = parseFloat(novoCalculoComposto.quantidadePorKg)
    const pesoProdutoFinal = parseFloat(novoCalculoComposto.pesoProdutoFinal)

    if (!novoCalculoComposto.supplyId || !quantidadePorKg || !pesoProdutoFinal) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (quantidadePorKg <= 0 || pesoProdutoFinal <= 0) {
      toast.error('Os valores devem ser maiores que zero')
      return
    }

    const insumoSelecionado = compoundSupplies.find(s => s.id === novoCalculoComposto.supplyId)
    if (!insumoSelecionado) {
      toast.error('Insumo não encontrado')
      return
    }

    console.log('[CALCULADORA_COMPOSTO] Insumo selecionado:', insumoSelecionado)
    console.log('[CALCULADORA_COMPOSTO] Quantidade por kg:', quantidadePorKg, 'g')
    console.log('[CALCULADORA_COMPOSTO] Peso do produto:', pesoProdutoFinal, 'g')

    // Custo por unidade (R$/kg ou R$/unidade)
    const custoPorUnidade = insumoSelecionado.costPerUnit

    // PASSO 1: Calcular quantos gramas de tempero usa por produto
    // Fórmula: (quantidadePorKg / 1000) * pesoProdutoFinal
    const gramaPorProduto = (quantidadePorKg / 1000) * pesoProdutoFinal

    console.log('[CALCULADORA_COMPOSTO] Gramas de tempero por produto:', gramaPorProduto, 'g')

    // Converter para unidade padrão (gramas para kg, etc)
    let fatorConversao = 1
    let unidadeCalculo = insumoSelecionado.unit

    // Se a unidade for kg e estamos usando gramas, precisamos converter
    if (insumoSelecionado.unit === 'kg') {
      fatorConversao = 1000 // 1kg = 1000g
      unidadeCalculo = 'kg'
    } else if (insumoSelecionado.unit === 'g') {
      fatorConversao = 1
      unidadeCalculo = 'g'
    } else if (insumoSelecionado.unit === 'un') {
      fatorConversao = 1
      unidadeCalculo = 'un'
    }

    // PASSO 2: Rendimento - quantos produtos consigo fazer com 1 unidade do tempero
    const rendimento = fatorConversao / gramaPorProduto

    // PASSO 3: Custo por produto = custo total / rendimento
    const custoPorProduto = custoPorUnidade / rendimento

    console.log('[CALCULADORA_COMPOSTO] Cálculos:', {
      custoPorUnidade,
      fatorConversao,
      gramaPorProduto,
      rendimento,
      custoPorProduto
    })

    const novoCalculo: CalculoComposto = {
      id: Date.now().toString(),
      insumo: insumoSelecionado,
      custoPorUnidade,
      unidade: unidadeCalculo,
      quantidadeUsadaPorProduto: gramaPorProduto, // Armazena o valor calculado
      pesoProdutoFinal: pesoProdutoFinal,
      rendimento,
      custoPorProduto
    }

    setCalculosCompostos([...calculosCompostos, novoCalculo])
    setNovoCalculoComposto({
      supplyId: '',
      quantidadePorKg: '',
      pesoProdutoFinal: ''
    })

    toast.success(`Cálculo de "${insumoSelecionado.name}" adicionado!`, {
      description: `${gramaPorProduto.toFixed(2)}g por produto | ${rendimento.toFixed(2)} produtos com 1 ${unidadeCalculo} | Custo: R$ ${custoPorProduto.toFixed(4)}/produto`
    })
  }

  const removerCalculoComposto = (id: string) => {
    setCalculosCompostos(calculosCompostos.filter(c => c.id !== id))
    toast.success('Cálculo removido')
  }

  const abrirDialogoCategoria = (insumo: Insumo) => {
    setInsumoParaSalvar(insumo)
    setShowCategoryDialog(true)
    
    // Sugerir categoria baseada no nome do insumo
    const nomeLower = insumo.nome.toLowerCase()
    if (nomeLower.includes('embalagem') || nomeLower.includes('saco') || nomeLower.includes('caixa')) {
      setCategoriaEscolhida('EMBALAGEM')
    } else if (nomeLower.includes('palito') || nomeLower.includes('espeto')) {
      setCategoriaEscolhida('DESCARTAVEIS')
    } else if (nomeLower.includes('energia') || nomeLower.includes('gás') || nomeLower.includes('agua')) {
      setCategoriaEscolhida('UTILIDADES')
    } else {
      setCategoriaEscolhida('OUTROS')
    }
  }

  const handleSalvarNoCatalogo = async () => {
    if (!insumoParaSalvar) return

    try {
      setSalvandoId(insumoParaSalvar.id)
      console.log('💾 [CALCULADORA] Salvando insumo no catálogo:', insumoParaSalvar.nome)

      // Mapear unidade de medida
      const unitMap: Record<string, string> = {
        'unidades': 'un',
        'gramas': 'g',
        'quilos': 'kg',
        'litros': 'L',
        'mililitros': 'mL'
      }

      const payload = {
        name: insumoParaSalvar.nome,
        category: categoriaEscolhida,
        costPerUnit: insumoParaSalvar.custoUnitario,
        unit: unitMap[insumoParaSalvar.unidadeMedida] || insumoParaSalvar.unidadeMedida,
        description: `Preço do pacote: R$ ${insumoParaSalvar.precoPacote.toFixed(2)} | Quantidade: ${insumoParaSalvar.quantidadeNoPacote} ${insumoParaSalvar.unidadeMedida}`,
        notes: `Calculado pela Calculadora de Insumos. Faz ${insumoParaSalvar.quantidadeProdutosQueFaz} produtos. Custo por produto: R$ ${insumoParaSalvar.custoPorProduto.toFixed(4)}`
      }

      console.log('📤 [CALCULADORA] Payload:', payload)

      const response = await fetch('/api/admin/pricing/supplies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar insumo')
      }

      const savedSupply = await response.json()
      console.log('✅ [CALCULADORA] Insumo salvo com sucesso:', savedSupply)

      toast.success(`Insumo "${insumoParaSalvar.nome}" adicionado ao catálogo!`, {
        description: `Categoria: ${categoriaEscolhida} | Custo unitário: R$ ${insumoParaSalvar.custoUnitario.toFixed(4)}`
      })

      setShowCategoryDialog(false)
      setInsumoParaSalvar(null)
    } catch (error: any) {
      console.error('❌ [CALCULADORA] Erro ao salvar:', error)
      toast.error('Erro ao salvar no catálogo', {
        description: error.message
      })
    } finally {
      setSalvandoId(null)
    }
  }

  const carregarExemplo = (tipo: 'palito' | 'embalagem' | 'arroz') => {
    if (tipo === 'palito') {
      setNovoInsumo({
        nome: 'Pacote de Palito',
        precoPacote: '3.00',
        quantidadeNoPacote: '50',
        unidadeMedida: 'unidades',
        quantidadeProdutosQueFaz: '50' // 50 palitos fazem 50 espetos
      })
    } else if (tipo === 'embalagem') {
      setNovoInsumo({
        nome: 'Pacote de Embalagem',
        precoPacote: '20.00',
        quantidadeNoPacote: '190',
        unidadeMedida: 'unidades',
        quantidadeProdutosQueFaz: '950' // 190 embalagens fazem 950 espetos (190 × 5)
      })
    } else if (tipo === 'arroz') {
      setNovoInsumo({
        nome: 'Pacote de Arroz',
        precoPacote: '20.00',
        quantidadeNoPacote: '5000',
        unidadeMedida: 'gramas',
        quantidadeProdutosQueFaz: '33' // 5000g ÷ 150g/jantinha = ~33 jantinhas
      })
    }
    toast.info(`Exemplo de ${tipo} carregado. Ajuste os valores conforme necessário.`)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals)
  }

  const custoTotalCalculado = insumos.reduce((sum, insumo) => sum + insumo.custoPorProduto, 0)
  const custoTotalCompostos = calculosCompostos.reduce((sum, calc) => sum + calc.custoPorProduto, 0)
  const custoTotalGeral = custoTotalCalculado + custoTotalCompostos

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-600 text-white rounded-xl">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Calculadora de Custo de Insumos</h1>
                <p className="text-gray-600 mt-1">Calcule o custo real de cada insumo por produto</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/admin'}
              >
                <Home className="h-4 w-4 mr-2" />
                Página Inicial
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/admin/precificacao/receitas'}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="simples" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="simples" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Insumos Simples
            </TabsTrigger>
            <TabsTrigger value="compostos" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Temperos/Receitas
            </TabsTrigger>
          </TabsList>

          {/* Aba: Insumos Simples */}
          <TabsContent value="simples">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário de Entrada */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Adicionar Insumo
                </CardTitle>
                <CardDescription>
                  Preencha os dados do insumo para calcular o custo por produto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Exemplos Rápidos */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => carregarExemplo('palito')}
                  >
                    Exemplo: Palito
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => carregarExemplo('embalagem')}
                  >
                    Exemplo: Embalagem
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => carregarExemplo('arroz')}
                  >
                    Exemplo: Arroz
                  </Button>
                </div>

                {/* Nome do Insumo */}
                <div>
                  <Label htmlFor="nome">Nome do Insumo *</Label>
                  <Input
                    id="nome"
                    value={novoInsumo.nome}
                    onChange={(e) => setNovoInsumo({ ...novoInsumo, nome: e.target.value })}
                    placeholder="Ex: Pacote de Palito, Arroz, Embalagem..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preço do Pacote */}
                  <div>
                    <Label htmlFor="precoPacote">Preço do Pacote (R$) *</Label>
                    <Input
                      id="precoPacote"
                      type="number"
                      step="0.01"
                      value={novoInsumo.precoPacote}
                      onChange={(e) => setNovoInsumo({ ...novoInsumo, precoPacote: e.target.value })}
                      placeholder="20.00"
                    />
                  </div>

                  {/* Quantidade no Pacote */}
                  <div>
                    <Label htmlFor="quantidadeNoPacote">Quantidade no Pacote *</Label>
                    <Input
                      id="quantidadeNoPacote"
                      type="number"
                      step="0.01"
                      value={novoInsumo.quantidadeNoPacote}
                      onChange={(e) => setNovoInsumo({ ...novoInsumo, quantidadeNoPacote: e.target.value })}
                      placeholder="190"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ex: 190 embalagens, 50 palitos, 5000 gramas
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Unidade de Medida */}
                  <div>
                    <Label htmlFor="unidadeMedida">Unidade de Medida *</Label>
                    <Select
                      value={novoInsumo.unidadeMedida}
                      onValueChange={(value) => setNovoInsumo({ ...novoInsumo, unidadeMedida: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unidades">Unidades</SelectItem>
                        <SelectItem value="gramas">Gramas (g)</SelectItem>
                        <SelectItem value="quilos">Quilos (kg)</SelectItem>
                        <SelectItem value="litros">Litros (L)</SelectItem>
                        <SelectItem value="mililitros">Mililitros (mL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantidade de Produtos que Faz */}
                  <div>
                    <Label htmlFor="quantidadeProdutos">Quantos Produtos Faz? *</Label>
                    <Input
                      id="quantidadeProdutos"
                      type="number"
                      step="0.01"
                      value={novoInsumo.quantidadeProdutosQueFaz}
                      onChange={(e) => setNovoInsumo({ ...novoInsumo, quantidadeProdutosQueFaz: e.target.value })}
                      placeholder="950"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ex: 950 espetos, 50 produtos, 33 jantinhas
                    </p>
                  </div>
                </div>

                <Button
                  onClick={calcularInsumo}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Calcular e Adicionar
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Insumos Calculados */}
            {insumos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Insumos Calculados ({insumos.length})</CardTitle>
                  <CardDescription>
                    Resultados dos cálculos de custo por produto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insumos.map((insumo) => (
                      <div
                        key={insumo.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-800 mb-2">
                              {insumo.nome}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500">Preço do Pacote</p>
                                <p className="font-semibold text-gray-800">
                                  {formatCurrency(insumo.precoPacote)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Qtd. no Pacote</p>
                                <p className="font-semibold text-gray-800">
                                  {formatNumber(insumo.quantidadeNoPacote)} {insumo.unidadeMedida}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Custo Unitário</p>
                                <p className="font-semibold text-blue-600">
                                  {formatCurrency(insumo.custoUnitario)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Custo/Produto</p>
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(insumo.custoPorProduto)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">Faz quantos produtos:</span>
                                  <span className="font-semibold text-orange-600">
                                    {formatNumber(insumo.quantidadeProdutosQueFaz, 0)} produtos
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">Custo unitário do insumo:</span>
                                  <span className="font-semibold text-gray-800">
                                    {formatCurrency(insumo.custoUnitario)}/{insumo.unidadeMedida}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirDialogoCategoria(insumo)}
                              disabled={salvandoId === insumo.id}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {salvandoId === insumo.id ? 'Salvando...' : 'Adicionar ao Catálogo'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerInsumo(insumo.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Resumo e Explicação */}
          <div className="space-y-6">
            {/* Resumo */}
            <Card className="bg-gradient-to-br from-orange-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Total de Insumos</p>
                    <p className="text-2xl font-bold text-gray-800">{insumos.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Custo Total/Produto</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatCurrency(custoTotalCalculado)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Soma de todos os insumos adicionados
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Como Funciona */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Como Funciona
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">1. Custo Unitário</h4>
                  <p className="text-gray-600">
                    Preço do Pacote ÷ Quantidade no Pacote
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ex: R$ 3,00 ÷ 50 palitos = R$ 0,06 por palito
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">2. Custo por Produto</h4>
                  <p className="text-gray-600">
                    Preço do Pacote ÷ Quantidade de Produtos que Faz
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ex: R$ 3,00 ÷ 50 espetos = R$ 0,06 por espeto
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">3. Rendimento</h4>
                  <p className="text-gray-600">
                    Quantos produtos você consegue fazer com esse pacote
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ex: 50 palitos = 50 espetos
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-orange-600 mb-2">💡 Dica</h4>
                  <p className="text-gray-600 text-xs">
                    Use os exemplos pré-configurados (Palito, Embalagem, Arroz) para começar rapidamente. Depois ajuste os valores conforme sua realidade.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Exemplo Prático */}
            <Card className="bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm">Exemplo: Embalagem</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p><strong>Pacote:</strong> R$ 20,00 (190 unidades)</p>
                <p><strong>Rendimento:</strong> 190 embalagens fazem 950 espetos</p>
                <p><strong>Cálculo:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Custo unitário: R$ 20,00 ÷ 190 = R$ 0,1053/embalagem</li>
                  <li>Custo por espeto: R$ 20,00 ÷ 950 = R$ 0,0211/espeto</li>
                  <li>Cada embalagem faz 5 espetos (190 × 5 = 950)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
          </TabsContent>

          {/* Aba: Temperos/Receitas (Insumos Compostos) */}
          <TabsContent value="compostos">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulário de Entrada - Compostos */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-orange-200 bg-orange-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <BookOpen className="h-5 w-5" />
                      Calcular Custo de Tempero/Receita
                    </CardTitle>
                    <CardDescription>
                      Selecione um tempero ou receita pronta e informe quanto usa por produto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingCompounds ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-2">Carregando temperos...</p>
                      </div>
                    ) : compoundSupplies.length === 0 ? (
                      <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed">
                        <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">Nenhum tempero/receita cadastrado</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Crie receitas em "Receitas de Insumos" primeiro
                        </p>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => window.location.href = '/admin/compras/receitas-insumos'}
                        >
                          Ir para Receitas
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Seletor de Tempero/Receita */}
                        <div>
                          <Label htmlFor="supply">Tempero/Receita *</Label>
                          <Select
                            value={novoCalculoComposto.supplyId}
                            onValueChange={(value) => setNovoCalculoComposto({ ...novoCalculoComposto, supplyId: value })}
                          >
                            <SelectTrigger id="supply">
                              <SelectValue placeholder="Selecione o tempero..." />
                            </SelectTrigger>
                            <SelectContent>
                              {compoundSupplies.map(supply => (
                                <SelectItem key={supply.id} value={supply.id}>
                                  🧂 {supply.name} - R$ {supply.costPerUnit.toFixed(2)}/{supply.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500 mt-1">
                            Temperos e receitas criadas no sistema
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Quantidade por KG */}
                          <div>
                            <Label htmlFor="quantidadePorKg">Quantos gramas usa por KG de produto? *</Label>
                            <Input
                              id="quantidadePorKg"
                              type="number"
                              step="0.01"
                              value={novoCalculoComposto.quantidadePorKg}
                              onChange={(e) => setNovoCalculoComposto({ ...novoCalculoComposto, quantidadePorKg: e.target.value })}
                              placeholder="Ex: 20"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Ex: 20g de tempero por kg de carne
                            </p>
                          </div>

                          {/* Peso do Produto Final */}
                          <div>
                            <Label htmlFor="pesoProdutoFinal">Peso do produto final (g) *</Label>
                            <Input
                              id="pesoProdutoFinal"
                              type="number"
                              step="0.01"
                              value={novoCalculoComposto.pesoProdutoFinal}
                              onChange={(e) => setNovoCalculoComposto({ ...novoCalculoComposto, pesoProdutoFinal: e.target.value })}
                              placeholder="Ex: 135"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Ex: espeto com 135g de carne
                            </p>
                          </div>
                        </div>

                        <Button
                          onClick={calcularInsumoComposto}
                          className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Calcular Tempero
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Lista de Cálculos Compostos */}
                {calculosCompostos.length > 0 && (
                  <Card className="border-green-200 bg-green-50/30">
                    <CardHeader>
                      <CardTitle className="text-green-800">
                        Temperos Calculados ({calculosCompostos.length})
                      </CardTitle>
                      <CardDescription>
                        Resultados dos cálculos de custo por produto
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {calculosCompostos.map((calc) => (
                          <div
                            key={calc.id}
                            className="border-2 border-green-200 bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                  🧂 {calc.insumo.name}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                  <div>
                                    <p className="text-gray-500">Custo Total</p>
                                    <p className="font-semibold text-gray-800">
                                      {formatCurrency(calc.custoPorUnidade)}/{calc.unidade}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Usa por produto</p>
                                    <p className="font-semibold text-blue-600">
                                      {formatNumber(calc.quantidadeUsadaPorProduto)} g
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Rendimento</p>
                                    <p className="font-semibold text-purple-600">
                                      {formatNumber(calc.rendimento, 2)} produtos
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 pt-3 border-t">
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500">Custo por produto:</span>
                                      <span className="font-bold text-green-600 text-lg">
                                        {formatCurrency(calc.custoPorProduto)}
                                      </span>
                                    </div>
                                    {calc.pesoProdutoFinal && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500">Peso do produto:</span>
                                        <span className="text-gray-700">
                                          {calc.pesoProdutoFinal}g
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                    💡 Com 1{calc.unidade} do tempero você faz {formatNumber(calc.rendimento, 0)} produtos
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removerCalculoComposto(calc.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Resumo - Compostos */}
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Resumo Temperos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600">Total de Temperos</p>
                        <p className="text-2xl font-bold text-gray-800">{calculosCompostos.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Custo Total/Produto</p>
                        <p className="text-3xl font-bold text-orange-600">
                          {formatCurrency(custoTotalCompostos)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Soma de todos os temperos calculados
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Exemplo Prático - Tempero */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-sm">Exemplo: Tempero Genuíno</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <p><strong>Custo:</strong> R$ 23,85 por kg</p>
                    <p><strong>Usa:</strong> 20g por kg de carne</p>
                    <p><strong>Peso do espeto:</strong> 135g de carne</p>
                    <p><strong>Cálculo:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                      <li>Tempero por espeto: (20g ÷ 1000g) × 135g = 2,7g</li>
                      <li>Rendimento: 1000g ÷ 2,7g = 370,37 espetos</li>
                      <li>Custo por espeto: R$ 23,85 ÷ 370,37 = R$ 0,064</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Ajuda */}
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Como funciona
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2 text-gray-700">
                    <p>
                      <strong>1.</strong> Selecione o tempero/receita que criou
                    </p>
                    <p>
                      <strong>2.</strong> Informe quantos gramas usa por KG de produto
                    </p>
                    <p>
                      <strong>3.</strong> Informe o peso do produto final em gramas
                    </p>
                    <p>
                      <strong>4.</strong> O sistema calcula automaticamente:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1 text-gray-600">
                      <li>Quantos gramas de tempero por produto</li>
                      <li>Quantos produtos faz com 1kg do tempero</li>
                      <li>Custo do tempero por produto</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Resumo Geral */}
        {(insumos.length > 0 || calculosCompostos.length > 0) && (
          <Card className="mt-6 bg-gradient-to-r from-orange-50 to-green-50 border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Calculator className="h-5 w-5" />
                Resumo Total (Simples + Temperos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Insumos Simples</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(custoTotalCalculado)}
                  </p>
                  <p className="text-xs text-gray-500">{insumos.length} itens</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Temperos/Receitas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(custoTotalCompostos)}
                  </p>
                  <p className="text-xs text-gray-500">{calculosCompostos.length} itens</p>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border-2 border-orange-300">
                  <p className="text-sm text-gray-600">Custo Total/Produto</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {formatCurrency(custoTotalGeral)}
                  </p>
                  <p className="text-xs text-gray-500">Todos os insumos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog para escolher categoria */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Save className="h-5 w-5 text-green-600" />
                Adicionar ao Catálogo de Insumos
              </DialogTitle>
              <DialogDescription>
                Escolha a categoria para o insumo "{insumoParaSalvar?.nome}"
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Resumo do Insumo */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nome:</span>
                  <span className="font-semibold">{insumoParaSalvar?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Custo Unitário:</span>
                  <span className="font-semibold text-green-600">
                    {insumoParaSalvar && formatCurrency(insumoParaSalvar.custoUnitario)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Unidade:</span>
                  <span className="font-semibold">{insumoParaSalvar?.unidadeMedida}</span>
                </div>
              </div>

              {/* Seletor de Categoria */}
              <div>
                <Label htmlFor="categoria">Categoria do Insumo *</Label>
                <Select
                  value={categoriaEscolhida}
                  onValueChange={setCategoriaEscolhida}
                >
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMBALAGEM">📦 Embalagem</SelectItem>
                    <SelectItem value="DESCARTAVEIS">🍴 Descartáveis</SelectItem>
                    <SelectItem value="UTILIDADES">💡 Utilidades (Energia, Gás, Água)</SelectItem>
                    <SelectItem value="MAO_DE_OBRA">👷 Mão de Obra</SelectItem>
                    <SelectItem value="OUTROS">📋 Outros</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  A categoria ajuda a organizar os insumos no sistema
                </p>
              </div>

              {/* Informações Adicionais */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>ℹ️ Informações:</strong>
                  <br />
                  • O insumo será salvo no catálogo global
                  <br />
                  • Poderá ser usado em receitas de produtos
                  <br />
                  • Pode ser editado posteriormente em "Catálogo de Insumos"
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryDialog(false)
                  setInsumoParaSalvar(null)
                }}
                disabled={salvandoId !== null}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvarNoCatalogo}
                disabled={salvandoId !== null}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {salvandoId !== null ? 'Salvando...' : 'Salvar no Catálogo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
