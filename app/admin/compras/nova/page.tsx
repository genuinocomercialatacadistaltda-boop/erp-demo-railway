
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Save, Home } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

interface RawMaterial {
  id: string
  name: string
  sku: string | null
  measurementUnit: string
  currentStock: number
  minStock: number | null
  costPerUnit: number | null
}

interface Supplier {
  id: string
  name: string
  cnpj: string
  email: string
  phone: string
}

interface BankAccount {
  id: string
  name: string
  balance: number
  isActive: boolean
}

interface CreditCard {
  id: string
  name: string
  limit: number
  availableLimit: number
  closingDay: number
  dueDay: number
}

interface PurchaseItem {
  materialId: string
  materialName?: string
  quantity: number
  unitPrice: number
  total: number
}

interface Supply {
  id: string
  name: string
  category: string
  unit: string
  currentStock: number
  costPerUnit: number
  sku?: string
}

interface SupplyItem {
  supplyId: string
  supplyName?: string
  quantity: number
  unitPrice: number
  total: number
}

interface Product {
  id: string
  name: string
  sku: string | null
  priceWholesale: number
  priceRetail: number
  currentStock: number
}

interface ProductItem {
  productId: string
  productName?: string
  quantity: number
  unitPrice: number
  total: number
}

export default function NovaCompraPage() {
  const router = useRouter()
  const { data: session, status } = useSession() || {}
  
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [supplyCategories, setSupplyCategories] = useState<{id: string, name: string}[]>([]) // Categorias de insumos (Temperos/Embalagens)
  
  const [supplierId, setSupplierId] = useState("")
  const [bankAccountId, setBankAccountId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("BOLETO")
  const [creditCardId, setCreditCardId] = useState("")
  const [installments, setInstallments] = useState(1)
  const [purchaseDate, setPurchaseDate] = useState('');
  const [installmentDueDates, setInstallmentDueDates] = useState<string[]>(['']) // Datas de vencimento por parcela

  // Inicializa data após montagem do componente para evitar erro de hidratação
  useEffect(() => {
    try {
      setPurchaseDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Erro ao inicializar data:', error);
      setPurchaseDate('2025-11-26');
    }
  }, []);
  const [dueDate, setDueDate] = useState("")
  
  // Atualizar array de datas quando o número de parcelas mudar (apenas para boleto)
  useEffect(() => {
    if (paymentMethod === 'BOLETO' && installments > 1) {
      setInstallmentDueDates(prev => {
        const newDates = [...prev];
        // Expandir ou reduzir o array conforme necessário
        while (newDates.length < installments) {
          newDates.push('');
        }
        return newDates.slice(0, installments);
      });
    } else {
      setInstallmentDueDates(['']);
    }
  }, [installments, paymentMethod]);
  const [notes, setNotes] = useState("")
  const [taxAmount, setTaxAmount] = useState(0) // Valor do imposto da nota
  const [isPaid, setIsPaid] = useState(false)
  const [items, setItems] = useState<PurchaseItem[]>([
    { materialId: "", quantity: 1, unitPrice: 0, total: 0 }
  ])
  const [supplyItems, setSupplyItems] = useState<SupplyItem[]>([
    { supplyId: "", quantity: 1, unitPrice: 0, total: 0 }
  ])
  const [supplyCategoryId, setSupplyCategoryId] = useState("") // Categoria para insumos (Temperos ou Embalagens)
  const [productItems, setProductItems] = useState<ProductItem[]>([
    { productId: "", quantity: 1, unitPrice: 0, total: 0 }
  ])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    } else if (status === "authenticated") {
      loadData()
    }
  }, [status, router])

  const loadData = async () => {
    try {
      // Carregar matérias-primas
      const materialsRes = await fetch("/api/raw-materials")
      if (materialsRes.ok) {
        const data = await materialsRes.json()
        setMaterials(data)
      }

      // 🆕 Carregar insumos
      const suppliesRes = await fetch("/api/supplies")
      if (suppliesRes.ok) {
        const data = await suppliesRes.json()
        setSupplies(data)
      }

      // 🆕 Carregar produtos acabados (para revenda, ex: carvão)
      const productsRes = await fetch("/api/products")
      if (productsRes.ok) {
        const data = await productsRes.json()
        // Filtrar apenas produtos ativos
        const activeProducts = (data.products || data).filter((p: any) => p.isActive !== false)
        setProducts(activeProducts)
      }

      // Carregar fornecedores
      const suppliersRes = await fetch("/api/financial/suppliers")
      if (suppliersRes.ok) {
        const data = await suppliersRes.json()
        setSuppliers(data)
      }

      // Carregar contas bancárias
      const bankAccountsRes = await fetch("/api/financial/bank-accounts")
      if (bankAccountsRes.ok) {
        const data = await bankAccountsRes.json()
        console.log("📊 Contas bancárias recebidas:", data)
        // API retorna { accounts: [...] }
        const accountsList = data.accounts || []
        const activeAccounts = accountsList.filter((account: BankAccount) => account.isActive)
        console.log("✅ Contas ativas:", activeAccounts)
        setBankAccounts(activeAccounts)
      } else {
        console.error("❌ Erro ao carregar contas:", bankAccountsRes.status)
      }

      // 💳 Carregar cartões de crédito
      const creditCardsRes = await fetch("/api/financial/credit-cards")
      if (creditCardsRes.ok) {
        const data = await creditCardsRes.json()
        console.log("💳 Cartões recebidos:", data)
        const cardsList = data.cards || []
        setCreditCards(cardsList)
      } else {
        console.error("❌ Erro ao carregar cartões:", creditCardsRes.status)
      }

      // 📦 Carregar categorias de insumos (Temperos e Embalagens)
      const categoriesRes = await fetch("/api/financial/categories")
      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        // API retorna { categories: [...] }
        const allCategories = data.categories || data || []
        // Filtrar apenas as categorias de insumos
        const supplyCategs = allCategories.filter((cat: any) => 
          cat.name?.toLowerCase() === 'temperos' || 
          cat.name?.toLowerCase() === 'embalagens'
        )
        console.log("📦 Categorias de insumos encontradas:", supplyCategs)
        setSupplyCategories(supplyCategs)
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast.error("Erro ao carregar dados do formulário")
    }
  }

  const addItem = () => {
    setItems([...items, { materialId: "", quantity: 1, unitPrice: 0, total: 0 }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Se mudou a matéria-prima, atualizar o preço
    if (field === "materialId" && value) {
      const material = materials.find(m => m.id === value)
      if (material) {
        newItems[index].unitPrice = material.costPerUnit || 0
        newItems[index].materialName = material.name
      }
    }
    
    // Recalcular total do item
    newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
    
    setItems(newItems)
  }

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  // 🆕 Funções para gerenciar insumos
  const addSupplyItem = () => {
    setSupplyItems([...supplyItems, { supplyId: "", quantity: 1, unitPrice: 0, total: 0 }])
  }

  const removeSupplyItem = (index: number) => {
    if (supplyItems.length > 1) {
      setSupplyItems(supplyItems.filter((_, i) => i !== index))
    }
  }

  const updateSupplyItem = (index: number, field: keyof SupplyItem, value: string | number) => {
    const newItems = [...supplyItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Se mudou o insumo, atualizar o preço
    if (field === "supplyId" && value) {
      const supply = supplies.find(s => s.id === value)
      if (supply) {
        newItems[index].unitPrice = supply.costPerUnit || 0
        newItems[index].supplyName = supply.name
      }
    }
    
    // Recalcular total do item
    newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
    
    setSupplyItems(newItems)
  }

  const getTotalSuppliesAmount = () => {
    return supplyItems.reduce((sum, item) => sum + item.total, 0)
  }

  // 🆕 Funções para gerenciar produtos acabados
  const addProductItem = () => {
    setProductItems([...productItems, { productId: "", quantity: 1, unitPrice: 0, total: 0 }])
  }

  const removeProductItem = (index: number) => {
    if (productItems.length > 1) {
      setProductItems(productItems.filter((_, i) => i !== index))
    }
  }

  const updateProductItem = (index: number, field: keyof ProductItem, value: string | number) => {
    const newItems = [...productItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Se mudou o produto, atualizar o preço
    if (field === "productId" && value) {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].unitPrice = product.priceWholesale || 0
        newItems[index].productName = product.name
      }
    }
    
    // Recalcular total do item
    newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
    
    setProductItems(newItems)
  }

  const getTotalProductsAmount = () => {
    return productItems.reduce((sum, item) => sum + item.total, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log("🎯 SUBMIT INICIADO - handleSubmit foi chamado")
    console.log("📋 Estado atual do formulário:", {
      supplierId,
      bankAccountId,
      paymentMethod,
      purchaseDate,
      dueDate,
      items,
      isPaid,
      loading
    })
    
    console.log("📊 Fornecedores carregados:", suppliers.length)
    console.log("📊 Lista de fornecedores:", suppliers.map(s => ({
      id: s.id,
      name: s.name,
      cnpj: s.cnpj
    })))
    
    // Prevenir duplo submit
    if (loading) {
      console.log("⚠️ Submit bloqueado - já está processando")
      return
    }
    
    // Setar loading ANTES das validações para prevenir cliques múltiplos
    setLoading(true)
    
    try {
      // Validações
      console.log("🔍 Validando fornecedor... supplierId =", supplierId, "tipo:", typeof supplierId)
      
      if (!supplierId || supplierId.trim() === "") {
        console.log("❌ VALIDAÇÃO FALHOU: Fornecedor não selecionado")
        console.log("Fornecedores disponíveis:", suppliers.length)
        toast.error("Por favor, selecione um fornecedor")
        setLoading(false)
        return
      }
      console.log("✅ Fornecedor OK:", supplierId)
      
      // Validar cartão de crédito se for o método de pagamento
      if (paymentMethod === "CARTAO_CREDITO") {
        if (!creditCardId || creditCardId.trim() === "") {
          console.log("❌ VALIDAÇÃO FALHOU: Cartão de crédito não selecionado")
          toast.error("Por favor, selecione um cartão de crédito")
          setLoading(false)
          return
        }
        console.log("✅ Cartão de crédito OK:", creditCardId)
      } else {
        // Para outros métodos, validar conta bancária
        if (!bankAccountId || bankAccountId.trim() === "") {
          console.log("❌ VALIDAÇÃO FALHOU: Conta bancária não selecionada")
          toast.error("Por favor, selecione uma conta bancária")
          setLoading(false)
          return
        }
        console.log("✅ Conta bancária OK:", bankAccountId)
      }
      
      if (!dueDate) {
        console.log("❌ VALIDAÇÃO FALHOU: Data de vencimento não informada")
        toast.error("Por favor, informe a data de vencimento")
        setLoading(false)
        return
      }
      console.log("✅ Data de vencimento OK:", dueDate)
      
      const validItems = items.filter(item => item.materialId && item.quantity > 0)
      const validSupplyItems = supplyItems.filter(item => item.supplyId && item.quantity > 0)
      const validProductItems = productItems.filter(item => item.productId && item.quantity > 0)
      
      if (validItems.length === 0 && validSupplyItems.length === 0 && validProductItems.length === 0) {
        console.log("❌ VALIDAÇÃO FALHOU: Nenhum item válido")
        toast.error("Adicione pelo menos um item (matéria-prima, insumo ou produto acabado)")
        setLoading(false)
        return
      }
      
      // 🏷️ Validar categoria obrigatória para compras de insumos
      if (validSupplyItems.length > 0 && !supplyCategoryId) {
        console.log("❌ VALIDAÇÃO FALHOU: Categoria de insumos não selecionada")
        toast.error("Selecione a categoria da despesa (Temperos ou Embalagens) para compras de insumos")
        setLoading(false)
        return
      }
      console.log("✅ Itens válidos OK:", validItems.length, "matérias-primas +", validSupplyItems.length, "insumos +", validProductItems.length, "produtos acabados")
      
      console.log("✅ TODAS VALIDAÇÕES PASSARAM - Iniciando envio para API...")
      
      const payload = {
        supplierId,
        bankAccountId: paymentMethod === "CARTAO_CREDITO" ? null : bankAccountId,
        creditCardId: paymentMethod === "CARTAO_CREDITO" ? creditCardId : null,
        installments: (paymentMethod === "CARTAO_CREDITO" || paymentMethod === "BOLETO") ? installments : 1,
        installmentDueDates: (paymentMethod === "BOLETO" && installments > 1) ? installmentDueDates : null, // Datas individuais por parcela
        totalAmount: getTotalAmount() + getTotalSuppliesAmount() + getTotalProductsAmount() + taxAmount,
        taxAmount: taxAmount || 0,
        paymentMethod,
        purchaseDate,
        dueDate,
        status: isPaid ? "PAID" : "PENDING",
        notes: notes || null,
        supplyCategoryId: validSupplyItems.length > 0 ? supplyCategoryId : null, // 🏷️ Categoria para insumos
        items: validItems.map(item => ({
          rawMaterialId: item.materialId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        })),
        supplyItems: validSupplyItems.map(item => ({
          supplyId: item.supplyId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        })),
        productItems: validProductItems.map(item => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        }))
      }
      
      console.log("📦 Payload completo:", JSON.stringify(payload, null, 2))
      
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      console.log("📡 Status da resposta da API:", response.status)
      console.log("📡 Status text:", response.statusText)
      
      if (response.ok) {
        const result = await response.json()
        console.log("✅ SUCESSO! Compra criada:", result)
        toast.success("Compra registrada com sucesso!")
        
        // Aguardar um pouco antes de redirecionar
        setTimeout(() => {
          console.log("🔄 Redirecionando para histórico...")
          window.location.href = "/admin/compras/historico"
        }, 1000)
      } else {
        const error = await response.json()
        console.error("❌ ERRO DA API:", error)
        toast.error(error.error || "Erro ao registrar compra")
        setLoading(false) // Reativar botão em caso de erro
      }
    } catch (error: any) {
      console.error("💥 ERRO CRÍTICO NO SUBMIT:", error)
      console.error("Stack trace:", error?.stack)
      toast.error(`Erro ao registrar compra: ${error?.message || "Erro desconhecido"}`)
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.href = "/admin/compras"}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Nova Compra</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.href = "/admin"}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Página Inicial
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Informações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
              <CardDescription>Dados principais da compra</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Fornecedor *</Label>
                  <Select 
                    value={supplierId} 
                    onValueChange={(value) => {
                      console.log("🏢 Fornecedor selecionado:", value)
                      console.log("🏢 Fornecedor ID capturado:", value)
                      setSupplierId(value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          Nenhum fornecedor cadastrado
                        </div>
                      ) : (
                        suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.cnpj})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {supplierId && (
                    <div className="text-xs text-green-600">
                      ✓ Fornecedor selecionado: {suppliers.find(s => s.id === supplierId)?.name}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccount">Conta Bancária *</Label>
                  <Select 
                    value={bankAccountId} 
                    onValueChange={(value) => {
                      console.log("💳 Conta selecionada:", value)
                      console.log("💳 Conta ID capturado:", value)
                      setBankAccountId(value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          Nenhuma conta ativa encontrada
                        </div>
                      ) : (
                        bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} (R$ {account.balance.toFixed(2)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {bankAccountId && (
                    <div className="text-xs text-green-600">
                      ✓ Conta selecionada: {bankAccounts.find(a => a.id === bankAccountId)?.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                  <Select 
                    value={paymentMethod || undefined} 
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                      <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Data da Compra</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Data de Vencimento *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* 💳 CAMPOS PARA CARTÃO DE CRÉDITO */}
              {paymentMethod === "CARTAO_CREDITO" && (
                <div className="grid md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    <Label htmlFor="creditCard">Cartão de Crédito *</Label>
                    <Select 
                      value={creditCardId} 
                      onValueChange={setCreditCardId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cartão" />
                      </SelectTrigger>
                      <SelectContent>
                        {creditCards.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Nenhum cartão cadastrado
                          </div>
                        ) : (
                          creditCards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.name} - Limite: R$ {card.limit.toFixed(2)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {creditCardId && (
                      <div className="text-xs text-green-600">
                        ✓ Cartão selecionado: {creditCards.find(c => c.id === creditCardId)?.name}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="installments">Número de Parcelas</Label>
                    <Select 
                      value={installments.toString()} 
                      onValueChange={(value) => setInstallments(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {installments > 1 && (
                      <div className="text-xs text-blue-600">
                        💳 Será dividido em {installments} faturas mensais
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 📄 PARCELAMENTO PARA BOLETO */}
              {paymentMethod === "BOLETO" && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="installments">Número de Parcelas (Boletos)</Label>
                    <Select 
                      value={installments.toString()} 
                      onValueChange={(value) => setInstallments(parseInt(value))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {installments > 1 && (
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-yellow-800">
                        📅 Informe a data de vencimento de cada parcela:
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        {installmentDueDates.map((date, index) => (
                          <div key={index} className="space-y-1">
                            <Label className="text-xs text-yellow-700">
                              Parcela {index + 1}/{installments}
                            </Label>
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) => {
                                const newDates = [...installmentDueDates];
                                newDates[index] = e.target.value;
                                setInstallmentDueDates(newDates);
                              }}
                              className="bg-white"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-yellow-700">
                        📄 Serão criadas {installments} despesas com as datas de vencimento informadas acima
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="taxAmount">Valor do Imposto da Nota (ICMS, IPI, etc.)</Label>
                <Input
                  id="taxAmount"
                  type="number"
                  step="any"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o valor total de impostos da nota fiscal (opcional)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre a compra..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                <Checkbox
                  id="isPaid"
                  checked={isPaid}
                  onCheckedChange={(checked) => setIsPaid(checked as boolean)}
                />
                <label
                  htmlFor="isPaid"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span>✅ Compra já foi paga</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Marque esta opção se a compra já foi quitada. Ela será registrada automaticamente nas contas a pagar.
                  </p>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Itens da Compra */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Itens da Compra</CardTitle>
                  <CardDescription>Adicione os itens comprados</CardDescription>
                </div>
                <Button type="button" onClick={addItem} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Matéria-Prima</Label>
                      <Select
                        value={item.materialId || undefined}
                        onValueChange={(value) => updateItem(index, "materialId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground">
                              Nenhuma matéria-prima cadastrada
                            </div>
                          )}
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name} ({material.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Preço Unit.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Total</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={`R$ ${item.total.toFixed(2)}`}
                          disabled
                          className="bg-muted"
                        />
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col items-end pt-4 border-t space-y-2">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Subtotal Matérias-Primas</p>
                    <p className="text-lg font-semibold">R$ {getTotalAmount().toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 📦 INSUMOS */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-purple-700">📦 Insumos</CardTitle>
                  <CardDescription>Materiais de consumo e embalagens (palitos, embalagens, guardanapos, etc.)</CardDescription>
                </div>
                <Button type="button" onClick={addSupplyItem} variant="outline" size="sm" className="border-purple-500 text-purple-600 hover:bg-purple-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Insumo
                </Button>
              </div>
              {/* 🏷️ Categoria do Insumo - obrigatório se tiver insumos */}
              {supplyItems.some(item => item.supplyId) && (
                <div className="mt-4 p-3 bg-purple-100 rounded-lg border border-purple-300">
                  <Label className="text-purple-800 font-semibold">Categoria da Despesa *</Label>
                  <Select
                    value={supplyCategoryId || undefined}
                    onValueChange={(value) => setSupplyCategoryId(value)}
                  >
                    <SelectTrigger className="mt-2 bg-white">
                      <SelectValue placeholder="Selecione: Temperos ou Embalagens" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplyCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-purple-600 mt-1">Obrigatório para compras de insumos</p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supplyItems.map((item, index) => (
                  <div key={index} className="grid md:grid-cols-5 gap-4 p-4 border border-purple-200 rounded-lg bg-purple-50/50">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Insumo</Label>
                      <Select
                        value={item.supplyId || undefined}
                        onValueChange={(value) => updateSupplyItem(index, "supplyId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplies.length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground">
                              Nenhum insumo cadastrado
                            </div>
                          )}
                          {supplies.map((supply) => (
                            <SelectItem key={supply.id} value={supply.id}>
                              {supply.name} {supply.sku ? `(${supply.sku})` : ''} - {supply.unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateSupplyItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Preço Unit. (Custo)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) => updateSupplyItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Total</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={`R$ ${item.total.toFixed(2)}`}
                          disabled
                          className="bg-muted"
                        />
                        {supplyItems.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeSupplyItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col items-end pt-4 border-t space-y-2">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Subtotal Insumos</p>
                    <p className="text-lg font-semibold text-purple-600">R$ {getTotalSuppliesAmount().toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 🆕 Produtos Acabados (Revenda) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-orange-700">📦 Produtos Acabados (Revenda)</CardTitle>
                  <CardDescription>Produtos que você compra pronto para revender (ex: carvão, gelo, etc.)</CardDescription>
                </div>
                <Button type="button" onClick={addProductItem} variant="outline" size="sm" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productItems.map((item, index) => (
                  <div key={index} className="grid md:grid-cols-5 gap-4 p-4 border border-orange-200 rounded-lg bg-orange-50/50">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Produto</Label>
                      <Select
                        value={item.productId || undefined}
                        onValueChange={(value) => updateProductItem(index, "productId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground">
                              Nenhum produto cadastrado
                            </div>
                          )}
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} {product.sku ? `(${product.sku})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateProductItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Preço Unit. (Custo)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) => updateProductItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Total</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={`R$ ${item.total.toFixed(2)}`}
                          disabled
                          className="bg-muted"
                        />
                        {productItems.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeProductItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col items-end pt-4 border-t space-y-2">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Subtotal Produtos Acabados</p>
                    <p className="text-lg font-semibold text-orange-600">R$ {getTotalProductsAmount().toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Total */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle>💰 Resumo da Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Matérias-Primas:</span>
                  <span>R$ {getTotalAmount().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Insumos:</span>
                  <span>R$ {getTotalSuppliesAmount().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produtos Acabados:</span>
                  <span className="text-orange-600">R$ {getTotalProductsAmount().toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impostos:</span>
                    <span className="text-orange-600">+ R$ {taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t text-lg font-bold">
                  <span>TOTAL:</span>
                  <span className="text-green-600">R$ {(getTotalAmount() + getTotalSuppliesAmount() + getTotalProductsAmount() + taxAmount).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.href = "/admin/compras"}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              onClick={(e) => {
                console.log("🔘 BOTÃO CLICADO - onClick disparado")
                console.log("Tipo do botão:", (e.target as HTMLButtonElement).type)
                console.log("Loading:", loading)
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Registrar Compra"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
