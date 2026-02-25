'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { ShoppingCart, ArrowLeft, AlertCircle, Truck, CreditCard, Percent, Minus, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { getDeliveryWarnings, getPickupWarnings, formatDateForInput, getMinDeliveryDate, getMinPickupDate, getOrderRulesSummary, type DeliveryType } from '@/lib/business-rules'
import { OrderConfirmationDialog } from '@/components/order-confirmation-dialog'
import { PixPaymentModal } from '@/components/pix-payment-modal'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  cpfCnpj: string
  city: string
  address: string | null
  creditLimit: number
  availableCredit: number
  customDiscount: number
  paymentTerms: number
  allowInstallments: boolean
  installmentOptions: string | null
  canPayWithBoleto?: boolean
  customerType?: 'NORMAL' | 'CONSUMIDOR_FINAL' | 'CASUAL'
}

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  priceWholesale: number
  priceRetail: number
  availableIn?: string
  quantityIncrement: number
  soldByWeight?: boolean
  bulkDiscountMinQty?: number | null
  bulkDiscountPrice?: number | null
  // 🏷️ Promoções
  isOnPromotion?: boolean
  promotionalPrice?: number | null
  isWeeklyPromotion?: boolean
}

interface CartItem {
  productId: string
  product: Product
  quantity: number
}

export default function AdminOrderCheckoutPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [deliveryDate, setDeliveryDate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [secondaryPaymentMethod, setSecondaryPaymentMethod] = useState<string>('NONE')
  const [primaryPaymentAmount, setPrimaryPaymentAmount] = useState<string>('')
  const [secondaryPaymentAmount, setSecondaryPaymentAmount] = useState<string>('')
  const [boletoInstallments, setBoletoInstallments] = useState<string>('avista')
  const [discountAmount, setDiscountAmount] = useState<string>('')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('FIXED')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [rulesSummary, setRulesSummary] = useState<any>(null)
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false)
  const [exemptDeliveryFee, setExemptDeliveryFee] = useState(false)
  const [exemptCardFee, setExemptCardFee] = useState(false)
  const [exemptBoletoFee, setExemptBoletoFee] = useState(false)
  const [casualCustomerName, setCasualCustomerName] = useState('')
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('') // 🔧 LEGACY: Mantido para compatibilidade
  const [primaryBankAccount, setPrimaryBankAccount] = useState<string>('') // 🆕 Conta para método primário
  const [secondaryBankAccount, setSecondaryBankAccount] = useState<string>('') // 🆕 Conta para método secundário
  const [coraAccounts, setCoraAccounts] = useState<{account: string, name: string}[]>([]) // 🏦 Contas Cora disponíveis
  const [selectedCoraAccount, setSelectedCoraAccount] = useState<string>('GENUINO') // 🏦 Conta Cora selecionada (padrão: GENUINO)
  const [cashReceivedAmount, setCashReceivedAmount] = useState<string>('') // 💵 Valor recebido em dinheiro (para registrar na conta bancária)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'ADMIN') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'ADMIN') {
      loadFromLocalStorage()
    }
  }, [session, status, router])

  // 🔧 Selecionar parcelamento automaticamente quando cliente tem opção de 4 parcelas
  useEffect(() => {
    if (paymentMethod === 'BOLETO' && selectedCustomer?.allowInstallments && selectedCustomer?.installmentOptions) {
      const days = selectedCustomer.installmentOptions.split(',').map(d => d.trim()).filter(d => d)
      
      console.log('[CHECKOUT_BOLETO] Cliente com parcelamento habilitado:', {
        customer: selectedCustomer.name,
        installmentOptions: selectedCustomer.installmentOptions,
        totalDays: days.length
      })
      
      // Se tem 4 dias configurados (7,14,21,28), selecionar automaticamente 4x
      if (days.length === 4 && boletoInstallments === 'avista') {
        const value = `4x-${days.join('-')}`
        console.log('[CHECKOUT_BOLETO] ✅ Selecionando automaticamente 4 parcelas:', value)
        setBoletoInstallments(value)
      }
    }
  }, [paymentMethod, selectedCustomer, boletoInstallments])

  // Selecionar conta bancária automaticamente baseado no método de pagamento
  useEffect(() => {
    if (!paymentMethod || bankAccounts.length === 0) return

    // Dinheiro → Conta de Dinheiro
    if (paymentMethod === 'CASH') {
      const dinheiroAccount = bankAccounts.find(acc => 
        acc.name.toLowerCase().includes('dinheiro') || acc.name.toLowerCase().includes('caixa')
      )
      if (dinheiroAccount) {
        setSelectedBankAccount(dinheiroAccount.id)
      }
    }
    // Crédito ou Débito → Conta do Itaú
    else if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT') {
      const itauAccount = bankAccounts.find(acc => 
        acc.name.toLowerCase().includes('itaú') || acc.name.toLowerCase().includes('itau')
      )
      if (itauAccount) {
        setSelectedBankAccount(itauAccount.id)
      }
    }
    // PIX → Limpar (vai perguntar)
    else if (paymentMethod === 'PIX') {
      setSelectedBankAccount('')
    }
    // Boleto → Não precisa conta bancária
    else if (paymentMethod === 'BOLETO') {
      setSelectedBankAccount('')
    }
  }, [paymentMethod, bankAccounts])

  const loadFromLocalStorage = async () => {
    try {
      const customerData = localStorage.getItem('admin_order_customer')
      const cartData = localStorage.getItem('admin_order_cart')

      if (!customerData || !cartData) {
        toast.error('Dados do pedido não encontrados')
        router.push('/admin/orders/new/select')
        return
      }

      const parsedCustomer = JSON.parse(customerData)
      
      // 🔄 ATUALIZAR dados do cliente com valores frescos do servidor
      // Isso garante que mudanças feitas no cadastro (ex: canPayWithBoleto) sejam refletidas
      try {
        const customerRes = await fetch(`/api/customers/${parsedCustomer.id}`)
        if (customerRes.ok) {
          const freshCustomerData = await customerRes.json()
          // Mesclar dados frescos mantendo dados do localStorage que não existem no servidor
          const updatedCustomer = { ...parsedCustomer, ...freshCustomerData }
          setSelectedCustomer(updatedCustomer)
          console.log('✅ Dados do cliente atualizados do servidor:', {
            name: updatedCustomer.name,
            canPayWithBoleto: updatedCustomer.canPayWithBoleto,
            creditLimit: updatedCustomer.creditLimit
          })
        } else {
          setSelectedCustomer(parsedCustomer)
        }
      } catch (error) {
        console.log('⚠️ Não foi possível atualizar dados do cliente, usando cache')
        setSelectedCustomer(parsedCustomer)
      }
      
      const parsedCart = JSON.parse(cartData) as CartItem[]
      
      // 🔄 CRÍTICO: Atualizar dados dos produtos com valores frescos do servidor
      // IMPORTANTE: Usar catálogo PERSONALIZADO do cliente para manter preços customizados
      try {
        const productIds = parsedCart.map(item => item.productId)
        if (productIds.length > 0) {
          // ✅ FIX: Buscar do catálogo personalizado do cliente, não do catálogo geral
          const customerId = parsedCustomer.id
          const isEmployee = parsedCustomer.isEmployee || false
          
          let productsRes
          if (isEmployee) {
            // Funcionários usam catálogo completo
            productsRes = await fetch('/api/products/catalog')
          } else {
            // Clientes usam catálogo personalizado
            productsRes = await fetch(`/api/customers/catalog?customerId=${customerId}`)
          }
          
          if (productsRes.ok) {
            const productsData = await productsRes.json()
            const allProducts = productsData.products || []
            
            // Atualizar cada item do carrinho com dados frescos do servidor (incluindo preços personalizados)
            const updatedCart = parsedCart.map(item => {
              const freshProduct = allProducts.find((p: Product) => p.id === item.productId)
              if (freshProduct) {
                console.log(`🔄 Atualizando produto ${freshProduct.name}: priceWholesale=${freshProduct.priceWholesale}, promotionalPrice=${freshProduct.promotionalPrice}`)
                return {
                  ...item,
                  product: {
                    ...item.product,
                    priceWholesale: freshProduct.priceWholesale,
                    priceRetail: freshProduct.priceRetail,
                    isOnPromotion: freshProduct.isOnPromotion,
                    promotionalPrice: freshProduct.promotionalPrice,
                    bulkDiscountMinQty: freshProduct.bulkDiscountMinQty,
                    bulkDiscountPrice: freshProduct.bulkDiscountPrice
                  }
                }
              }
              return item
            })
            
            setCart(updatedCart)
            // Atualizar localStorage com dados frescos
            localStorage.setItem('admin_order_cart', JSON.stringify(updatedCart))
            console.log('✅ Carrinho atualizado com preços do catálogo personalizado')
          } else {
            setCart(parsedCart)
          }
        } else {
          setCart(parsedCart)
        }
      } catch (err) {
        console.error('❌ Erro ao atualizar preços dos produtos:', err)
        setCart(parsedCart)
      }
      
      // Buscar contas bancárias
      try {
        const accountsRes = await fetch('/api/financial/bank-accounts')
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json()
          console.log('📊 Dados de contas bancárias:', accountsData)
          
          // A API retorna { accounts: [...] }
          if (accountsData.accounts && Array.isArray(accountsData.accounts)) {
            setBankAccounts(accountsData.accounts.filter((acc: any) => acc.isActive))
          } else {
            console.error('❌ Formato inesperado:', accountsData)
            setBankAccounts([])
          }
        } else {
          console.error('❌ Erro ao buscar contas:', accountsRes.status)
          setBankAccounts([])
        }
      } catch (err) {
        console.error('❌ Erro ao carregar contas bancárias:', err)
        setBankAccounts([])
      }
      
      // 🏦 Buscar contas Cora disponíveis
      try {
        const coraRes = await fetch('/api/cora/accounts')
        if (coraRes.ok) {
          const coraData = await coraRes.json()
          console.log('🏦 Contas Cora disponíveis:', coraData)
          if (coraData.accounts && Array.isArray(coraData.accounts)) {
            setCoraAccounts(coraData.accounts)
            if (coraData.defaultAccount) {
              setSelectedCoraAccount(coraData.defaultAccount)
            }
          }
        }
      } catch (err) {
        console.error('❌ Erro ao carregar contas Cora:', err)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      toast.error('Erro ao carregar dados do pedido')
      router.push('/admin/orders/new/select')
    }
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const cartItem = cart.find(item => item.productId === productId)
    const increment = cartItem?.product.quantityIncrement || 1
    const soldByWeight = cartItem?.product.soldByWeight || false
    
    // Se vendido por peso, permite decimais; senão, arredonda para múltiplos do incremento
    let adjustedQuantity: number
    if (soldByWeight) {
      // Para produtos vendidos por peso, mantém até 3 casas decimais e não aplica incremento
      adjustedQuantity = Math.round(quantity * 1000) / 1000
      adjustedQuantity = Math.max(0.001, adjustedQuantity)
    } else {
      // Para produtos por unidade, arredonda para múltiplos do incremento
      adjustedQuantity = Math.max(increment, Math.round(quantity / increment) * increment)
    }

    if (adjustedQuantity <= 0) {
      setCart(cart.filter(item => item.productId !== productId))
    } else {
      setCart(cart.map(item =>
        item.productId === productId ? { ...item, quantity: adjustedQuantity } : item
      ))
    }

    // Update localStorage
    const updatedCart = cart.map(item =>
      item.productId === productId ? { ...item, quantity: adjustedQuantity } : item
    ).filter(item => item.quantity > 0)
    localStorage.setItem('admin_order_cart', JSON.stringify(updatedCart))
  }

  const removeItem = (productId: string) => {
    const item = cart.find(c => c.productId === productId)
    const updatedCart = cart.filter(item => item.productId !== productId)
    setCart(updatedCart)
    localStorage.setItem('admin_order_cart', JSON.stringify(updatedCart))
    if (item) {
      toast.success(`${item.product.name} removido do carrinho`)
    }
  }

  const handleQuantityInputChange = (productId: string, value: string) => {
    const cartItem = cart.find(item => item.productId === productId)
    const soldByWeight = cartItem?.product.soldByWeight || false
    
    // Substituir vírgula por ponto para aceitar formato brasileiro (1,2 → 1.2)
    const normalizedValue = value.replace(',', '.')
    
    // Se vendido por peso, usa parseFloat; senão, usa parseInt
    const numValue = soldByWeight ? (parseFloat(normalizedValue) || 0) : (parseInt(normalizedValue) || 0)
    
    if (numValue > 0) {
      updateQuantity(productId, numValue)
    }
  }

  // Função para calcular preço unitário com desconto progressivo
  const getUnitPrice = (product: Product, quantity: number) => {
    // 🏷️ PRIORIDADE DE PREÇOS (igual ao backend):
    // 1. Promoção (maior prioridade) - MAS NÃO SE APLICA A BOLETO!
    // 2. MENOR PREÇO entre catálogo personalizado e desconto por quantidade
    // 3. Só catálogo personalizado
    // 4. Só desconto progressivo por quantidade
    // 5. Preço base (atacado)
    
    // 1️⃣ Se produto está em promoção → usar preço promocional
    // ⚠️ PROMOÇÃO NÃO SE APLICA A BOLETO! (regra do backend)
    const isBoletoPayment = paymentMethod === 'BOLETO'
    if (product.isOnPromotion && product.promotionalPrice && !isBoletoPayment) {
      return product.promotionalPrice
    }
    
    const hasCustomPrice = (product as any).hasCustomPrice
    const customPrice = hasCustomPrice ? product.priceWholesale : null
    const hasBulkDiscount = product.bulkDiscountMinQty && product.bulkDiscountPrice && quantity >= product.bulkDiscountMinQty
    const bulkDiscountPrice = hasBulkDiscount ? product.bulkDiscountPrice : null
    
    // 2️⃣ Se tem AMBOS catálogo E desconto por quantidade → usar o MENOR
    if (customPrice && bulkDiscountPrice) {
      return Math.min(customPrice, bulkDiscountPrice)
    }
    
    // 3️⃣ Se só tem catálogo personalizado → usar catálogo
    if (customPrice) {
      return customPrice
    }
    
    // 4️⃣ Se só tem desconto por quantidade → usar desconto
    if (bulkDiscountPrice) {
      return bulkDiscountPrice
    }
    
    // 5️⃣ Preço base
    return product.priceWholesale
  }
  
  // 🆕 Verificar se carrinho tem itens em promoção
  const hasPromotionalItems = () => {
    return cart.some(item => item.product.isOnPromotion && item.product.promotionalPrice)
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => {
      if (!item.product) return sum
      const unitPrice = getUnitPrice(item.product, item.quantity)
      return sum + (unitPrice * item.quantity)
    }, 0)

    const customDiscountValue = selectedCustomer?.customDiscount || 0
    
    // Calcula o desconto manual baseado no tipo
    let manualDiscountValue = 0
    const discountInput = parseFloat(discountAmount) || 0
    
    if (discountInput > 0) {
      if (discountType === 'PERCENTAGE') {
        // Desconto percentual aplicado sobre o subtotal (antes do desconto customizado)
        manualDiscountValue = subtotal * (discountInput / 100)
      } else {
        // Desconto fixo em R$
        manualDiscountValue = discountInput
      }
    }
    
    const totalDiscountValue = customDiscountValue + manualDiscountValue
    
    let total = subtotal - totalDiscountValue

    // 🏷️ REGRA: Se tem item em promoção + cartão → taxa de cartão é OBRIGATÓRIA (não pode isentar)
    const hasPromo = cart.some(item => item.product?.isOnPromotion && item.product?.promotionalPrice)
    const isCardPayment = paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT'
    const forceCardFee = hasPromo && isCardPayment  // Forçar taxa se promoção + cartão
    
    let cardFee = 0
    if (!exemptCardFee || forceCardFee) {
      if (paymentMethod === 'CREDIT_CARD') {
        cardFee = total * 0.035
      } else if (paymentMethod === 'DEBIT') {
        cardFee = total * 0.01
      }

      if (secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE') {
        if (secondaryPaymentMethod === 'CREDIT_CARD') {
          cardFee += (parseFloat(secondaryPaymentAmount) || 0) * 0.035
        } else if (secondaryPaymentMethod === 'DEBIT') {
          cardFee += (parseFloat(secondaryPaymentAmount) || 0) * 0.01
        }
      }
    }

    // 🎫 Taxa de Boleto - R$ 2,50
    let boletoFee = 0
    if (!exemptBoletoFee) {
      if (paymentMethod === 'BOLETO') {
        boletoFee = 2.50
      }
      // Também verifica método secundário
      if (secondaryPaymentMethod === 'BOLETO') {
        boletoFee += 2.50
      }
    }

    total += cardFee + boletoFee

    return { subtotal, customDiscountValue, manualDiscountValue, totalDiscountValue, cardFee, boletoFee, total }
  }

  const handleProceedToReview = () => {
    console.log('🔴 [handleProceedToReview] INICIANDO VALIDAÇÕES...')
    console.log('🔴 customerType:', selectedCustomer?.customerType)
    console.log('🔴 paymentMethod:', paymentMethod)
    console.log('🔴 deliveryDate:', deliveryDate)
    console.log('🔴 primaryBankAccount:', primaryBankAccount)
    console.log('🔴 isAlreadyPaid:', isAlreadyPaid)
    console.log('🔴 selectedCoraAccount:', selectedCoraAccount)
    
    // 🆕 Validação para Cliente Avulso
    if (selectedCustomer?.customerType === 'CASUAL' && !casualCustomerName.trim()) {
      console.log('🔴 ERRO: Nome do cliente avulso não preenchido')
      toast.error('Digite o nome do cliente avulso')
      return
    }

    // CONSUMIDOR FINAL não precisa de data de entrega (venda de loja)
    if (selectedCustomer?.customerType !== 'CONSUMIDOR_FINAL' && !deliveryDate) {
      console.log('🔴 ERRO: Data de entrega não selecionada')
      toast.error('Selecione a data de entrega/retirada')
      return
    }
    console.log('🔴 ✅ Data de entrega OK')

    if (!paymentMethod) {
      console.log('🔴 ERRO: Método de pagamento não selecionado')
      toast.error('Selecione a forma de pagamento')
      return
    }
    console.log('🔴 ✅ Método de pagamento OK')

    // 🆕 Validação de Conta Bancária Separada por Método
    // Se tiver pagamento combinado, validar conta para cada método
    if (secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE') {
      console.log('🔴 Validando pagamento COMBINADO...')
      // Validar valores
      const primary = parseFloat(primaryPaymentAmount) || 0
      const secondary = parseFloat(secondaryPaymentAmount) || 0
      const { total } = calculateTotals()

      if (Math.abs(primary + secondary - total) > 0.01) {
        toast.error('A soma dos pagamentos deve ser igual ao total')
        return
      }

      // Validar conta bancária do método primário
      // PIX via Cora (não marcado como "já pago") não precisa de conta prévia
      const isPrimaryPixViaCora = paymentMethod === 'PIX' && !isAlreadyPaid
      const primaryNeedsBankAccount = paymentMethod !== 'BOLETO' && !isPrimaryPixViaCora
      if (primaryNeedsBankAccount && !primaryBankAccount) {
        toast.error(`Selecione a conta bancária para o método primário (${paymentMethod})`)
        return
      }

      // Validar conta bancária do método secundário
      // PIX via Cora (não marcado como "já pago") não precisa de conta prévia
      const isSecondaryPixViaCora = secondaryPaymentMethod === 'PIX' && !isAlreadyPaid
      const secondaryNeedsBankAccount = secondaryPaymentMethod !== 'BOLETO' && !isSecondaryPixViaCora
      if (secondaryNeedsBankAccount && !secondaryBankAccount) {
        toast.error(`Selecione a conta bancária para o método secundário (${secondaryPaymentMethod})`)
        return
      }
    } else {
      console.log('🔴 Validando pagamento SIMPLES (sem combinado)...')
      // Sem pagamento combinado: validação simples
      // 🔧 BOLETO usa Cora (não precisa de conta bancária prévia)
      // 🔧 PIX: Se for via modal Cora (não marcado como "já pago"), não precisa de conta bancária
      //         Se for marcado como "já pago" (PIX externo, ex: Mercado Pago), PRECISA de conta bancária
      const isBoleto = paymentMethod === 'BOLETO'
      const isPixViaCora = paymentMethod === 'PIX' && !isAlreadyPaid // PIX via modal Cora
      const needsBankAccount = !isBoleto && !isPixViaCora
      
      console.log('🔴 isBoleto:', isBoleto)
      console.log('🔴 isPixViaCora:', isPixViaCora)
      console.log('🔴 needsBankAccount:', needsBankAccount)
      console.log('🔴 primaryBankAccount:', primaryBankAccount)
      
      if (needsBankAccount && !primaryBankAccount) {
        console.log('🔴 ERRO: Conta bancária não selecionada')
        toast.error('Selecione a conta bancária que recebeu o pagamento')
        return
      }
      console.log('🔴 ✅ Validação de conta bancária OK')
    }

    console.log('🔴 ✅ Todas validações de conta passaram!')

    if (paymentMethod === 'BOLETO') {
      console.log('🔴 Validando BOLETO...')
      const boletoAmount = secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE'
        ? (parseFloat(primaryPaymentAmount) || 0)
        : calculateTotals().total
      
      console.log('🔴 boletoAmount:', boletoAmount)
      console.log('🔴 availableCredit:', selectedCustomer?.availableCredit)

      if (selectedCustomer && selectedCustomer.availableCredit < boletoAmount) {
        console.log('🔴 ERRO: Limite insuficiente')
        toast.error(`Limite insuficiente. Disponível: R$ ${selectedCustomer.availableCredit.toFixed(2)}`)
        return
      }
      console.log('🔴 ✅ Limite de crédito OK')
    }

    // 🆕 CONSUMIDOR FINAL: finalizar direto sem confirmação
    if (selectedCustomer?.customerType === 'CONSUMIDOR_FINAL') {
      console.log('🛒 Consumidor Final: finalizando pedido direto sem confirmação')
      handleConfirmOrder()
      return
    }

    console.log('🔴 ✅ TODAS VALIDAÇÕES PASSARAM! Abrindo dialog de confirmação...')

    const { total } = calculateTotals()
    const packageCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    
    let deliveryTypeForRules: DeliveryType = 'pickup'
    if (deliveryType === 'DELIVERY') {
      deliveryTypeForRules = 'delivery_gurupi'
    }

    const summary = getOrderRulesSummary(
      deliveryTypeForRules,
      total,
      packageCount,
      new Date()
    )

    // Se isentar taxa de entrega, ajustar o summary
    if (exemptDeliveryFee) {
      summary.totalFee = 0
    }

    setRulesSummary(summary)
    console.log('🔴 ✅ setShowConfirmDialog(true) sendo chamado!')
    setShowConfirmDialog(true)
  }

  const handleConfirmOrder = async () => {
    // 💜 Se é PIX (primário ou secundário), abrir modal de PIX primeiro
    // EXCETO se o pagamento já foi marcado como pago (isAlreadyPaid)
    const isPrimaryPix = paymentMethod === 'PIX'
    const isSecondaryPix = secondaryPaymentMethod === 'PIX'
    
    // 🔧 CORREÇÃO: Se isAlreadyPaid está marcado, não abrir modal PIX (pagamento já foi feito externamente)
    const shouldOpenPixModal = (isPrimaryPix || isSecondaryPix) && !isAlreadyPaid
    
    console.log('🎯 [handleConfirmOrder] CHAMADO!')
    console.log('🎯 [handleConfirmOrder] paymentMethod:', paymentMethod)
    console.log('🎯 [handleConfirmOrder] isPrimaryPix:', isPrimaryPix)
    console.log('🎯 [handleConfirmOrder] isSecondaryPix:', isSecondaryPix)
    console.log('🎯 [handleConfirmOrder] isAlreadyPaid:', isAlreadyPaid)
    console.log('🎯 [handleConfirmOrder] shouldOpenPixModal:', shouldOpenPixModal)
    console.log('🎯 [handleConfirmOrder] customerType:', selectedCustomer?.customerType)
    
    if (shouldOpenPixModal) {
      console.log('🎯 [handleConfirmOrder] ✅ ABRINDO MODAL PIX!')
      setShowConfirmDialog(false)
      setShowPixModal(true)
      return
    }
    
    console.log('🎯 [handleConfirmOrder] ❌ NÃO ABRE MODAL PIX - criando pedido direto')
    // Continuar com criação do pedido normalmente
    await createOrder()
  }

  const handlePixPaymentConfirmed = async (confirmedPixChargeId: string, netAmount: number) => {
    setShowPixModal(false)
    await createOrder(confirmedPixChargeId)
  }

  const createOrder = async (confirmedPixChargeId?: string) => {
    setSubmitting(true)

    try {
      const { total, customDiscountValue, manualDiscountValue, totalDiscountValue } = calculateTotals()
      
      // Para CONSUMIDOR FINAL, usar data atual já que é venda de loja
      const finalDeliveryDate = selectedCustomer?.customerType === 'CONSUMIDOR_FINAL' 
        ? new Date().toISOString().split('T')[0] 
        : deliveryDate
      
      // 🆕 Para CONSUMIDOR_FINAL ou PIX CONFIRMADO, sempre marcar como pago
      const finalIsAlreadyPaid = selectedCustomer?.customerType === 'CONSUMIDOR_FINAL' 
        ? true 
        : (confirmedPixChargeId ? true : isAlreadyPaid) // 💜 PIX confirmado = já pago
      
      // 🆕 Determinar contas bancárias (separadas para pagamento combinado)
      const hasCombinedPayment = secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE'
      const finalPrimaryBankAccountId = primaryBankAccount && primaryBankAccount.trim() !== '' 
        ? primaryBankAccount 
        : null
      const finalSecondaryBankAccountId = secondaryBankAccount && secondaryBankAccount.trim() !== '' 
        ? secondaryBankAccount 
        : null

      // 🔍 LOG DE DEBUG: Ver parcelamento sendo enviado
      console.log('[CHECKOUT_SUBMIT] Dados do parcelamento:', {
        boletoInstallments,
        willSendToAPI: boletoInstallments && boletoInstallments !== 'avista' ? boletoInstallments : null,
        paymentMethod,
        customerHasInstallments: selectedCustomer?.allowInstallments,
        installmentOptions: selectedCustomer?.installmentOptions
      })

      // 🆕 Para CONSUMIDOR_FINAL, deliveryType deve ser NULL (venda de balcão, não é entrega)
      const finalDeliveryType = selectedCustomer?.customerType === 'CONSUMIDOR_FINAL' 
        ? null 
        : deliveryType

      // 🆕 Detectar se é funcionário
      const isEmployeeOrder = (selectedCustomer as any)?.isEmployee === true
      const employeeId = (selectedCustomer as any)?.employeeId

      // 🔧 CORREÇÃO: Se PIX foi confirmado mas paymentMethod está vazio, forçar "PIX"
      const finalPaymentMethod = confirmedPixChargeId && !paymentMethod ? 'PIX' : paymentMethod
      
      console.log('💳 [CHECKOUT] paymentMethod original:', paymentMethod, '| final:', finalPaymentMethod, '| pixChargeId:', confirmedPixChargeId)
      
      // 🔒 VALIDAÇÃO: Enviar preços calculados pelo frontend para o backend verificar
      const orderData = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          expectedUnitPrice: getUnitPrice(item.product, item.quantity) // 🔒 Preço esperado pelo frontend
        })),
        expectedSubtotal: subtotal, // 🔒 Subtotal esperado pelo frontend
        customerId: isEmployeeOrder ? null : selectedCustomer?.id, // 🆕 Null se for funcionário
        orderType: 'WHOLESALE',
        deliveryType: finalDeliveryType,
        deliveryDate: finalDeliveryDate,
        deliveryTime: finalDeliveryType === 'DELIVERY' ? '16:00-18:00' : null,
        deliveryFee: rulesSummary?.totalFee || 0,
        paymentMethod: finalPaymentMethod,
        secondaryPaymentMethod: secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' ? secondaryPaymentMethod : null,
        primaryPaymentAmount: secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' ? parseFloat(primaryPaymentAmount) : null,
        secondaryPaymentAmount: secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' ? parseFloat(secondaryPaymentAmount) : null,
        boletoInstallments: boletoInstallments && boletoInstallments !== 'avista' ? boletoInstallments : null,
        coraAccount: paymentMethod === 'BOLETO' ? selectedCoraAccount : null, // 🏦 Conta Cora selecionada
        // 🔧 CORREÇÃO: Enviar discountPercent OU discountAmount dependendo do tipo
        discountPercent: discountType === 'PERCENTAGE' ? parseFloat(discountAmount) || 0 : 0,
        discountAmount: discountType === 'FIXED' ? manualDiscountValue : 0,
        notes: notes,
        isAlreadyPaid: finalIsAlreadyPaid,
        // 🆕 Incluir nome do cliente casual se for CASUAL
        casualCustomerName: selectedCustomer?.customerType === 'CASUAL' ? casualCustomerName.trim() : undefined,
        // 🆕 Contas bancárias separadas (para pagamento combinado)
        primaryBankAccountId: finalPrimaryBankAccountId,
        secondaryBankAccountId: hasCombinedPayment ? finalSecondaryBankAccountId : null,
        // ⚠️ IMPORTANTE: Incluir flag de isenção de taxa de cartão
        exemptCardFee: exemptCardFee,
        // 🎫 IMPORTANTE: Incluir flag de isenção de taxa de boleto
        exemptBoletoFee: exemptBoletoFee,
        boletoFee: boletoFee, // Valor da taxa de boleto
        // 🆕 FUNCIONÁRIO: Enviar dados do funcionário para a API
        isEmployee: isEmployeeOrder,
        employeeId: isEmployeeOrder ? employeeId : null,
        // 💳 PIX: Enviar pixChargeId se pagamento foi via PIX
        pixChargeId: confirmedPixChargeId || null,
        pixPaid: confirmedPixChargeId ? true : false,
        // 💵 Valor recebido em dinheiro (para registrar na conta bancária)
        cashReceivedAmount: cashReceivedAmount ? parseFloat(cashReceivedAmount) : null
      }

      console.log('🔍 Dados do pedido:', {
        customerType: selectedCustomer?.customerType,
        isAlreadyPaid: finalIsAlreadyPaid,
        primaryBankAccountId: finalPrimaryBankAccountId,
        secondaryBankAccountId: finalSecondaryBankAccountId,
        hasCombinedPayment,
        paymentMethod,
        paymentMethodType: typeof paymentMethod,
        paymentMethodLength: paymentMethod?.length,
        isEmployee: isEmployeeOrder,
        employeeId: employeeId,
        pixChargeId: confirmedPixChargeId
      })
      
      // 🔧 DEBUG: Ver valor exato do orderData.paymentMethod
      console.log('💳 [DEBUG] paymentMethod enviado:', JSON.stringify(orderData.paymentMethod))

      if (isEmployeeOrder) {
        console.log('🏠 Pedido de FUNCIONÁRIO detectado! Tratando como CLIENTE na API /api/admin/orders')
        console.log('   employeeId:', employeeId)
        console.log('   Nome:', selectedCustomer?.name)
      }

      // Sempre usar a mesma API de orders
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar pedido')
        setSubmitting(false)
        return
      }

      // Fechar o diálogo apenas após sucesso
      setShowConfirmDialog(false)

      // Limpar localStorage
      localStorage.removeItem('admin_order_customer')
      localStorage.removeItem('admin_order_cart')

      toast.success('Pedido criado com sucesso!')
      
      // ✅ Pequeno delay antes do redirect para evitar erros de client-side durante a navegação
      setTimeout(() => {
        router.push('/admin/orders')
      }, 100)
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Erro ao criar pedido')
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
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

  const { subtotal, customDiscountValue, manualDiscountValue, totalDiscountValue, cardFee, boletoFee, total } = calculateTotals()
  const minDate = deliveryType === 'DELIVERY' ? getMinDeliveryDate() : getMinPickupDate()
  const warnings = deliveryType === 'DELIVERY' 
    ? getDeliveryWarnings(deliveryDate ? new Date(deliveryDate) : null)
    : getPickupWarnings(deliveryDate ? new Date(deliveryDate) : null)

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/admin/orders/new/select')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden">
                <Image 
                  src="/logo.jpg" 
                  alt="[SUA EMPRESA]" 
                  fill 
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-lg font-semibold text-gray-900">
                Finalizar Pedido - Admin
              </h1>
            </div>
            
            <div className="w-20"></div>
          </div>
        </header>

        {/* Progress Indicator */}
        <div className="bg-white border-b">
          <div className="container mx-auto max-w-6xl px-4 py-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white">
                  ✓
                </div>
                <span className="font-medium hidden sm:inline">Cliente & Produtos</span>
              </div>
              <div className="w-12 h-0.5 bg-red-600" />
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600 text-white">
                  2
                </div>
                <span className="font-medium hidden sm:inline">Entrega & Pagamento</span>
              </div>
            </div>
          </div>
        </div>

        <main className="container mx-auto max-w-6xl px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Customer Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-semibold">{selectedCustomer?.name}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer?.email}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer?.phone}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer?.city}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 🆕 Campo de Nome para Cliente Avulso */}
                {selectedCustomer?.customerType === 'CASUAL' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-600">
                        📝 Nome do Cliente Avulso
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Alert className="bg-blue-50 border-blue-200 mb-4">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          Este é um <strong>Cliente Avulso (Encomenda)</strong>. Digite o nome do cliente para identificação no pedido.
                        </AlertDescription>
                      </Alert>
                      <div>
                        <Label htmlFor="casualName" className="text-base">
                          Nome do Cliente *
                        </Label>
                        <Input
                          id="casualName"
                          type="text"
                          placeholder="Ex: João Silva"
                          value={casualCustomerName}
                          onChange={(e) => setCasualCustomerName(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Delivery Details - ESCONDIDO para CONSUMIDOR FINAL */}
                {selectedCustomer?.customerType !== 'CONSUMIDOR_FINAL' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-red-600" />
                        Detalhes da Entrega
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Tipo</Label>
                        <RadioGroup value={deliveryType} onValueChange={(v: any) => setDeliveryType(v)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="DELIVERY" id="delivery" />
                            <Label htmlFor="delivery">Entrega</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="PICKUP" id="pickup" />
                            <Label htmlFor="pickup">Retirada</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div>
                        <Label htmlFor="deliveryDate">Data de {deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'} *</Label>
                        <Input
                          id="deliveryDate"
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          min={formatDateForInput(minDate)}
                        />
                      </div>

                      {warnings.length > 0 && (
                        <div className="space-y-2">
                          {warnings.map((warning, idx) => (
                            <Alert key={idx}>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">{warning}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}

                      <div>
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Observações adicionais..."
                          rows={3}
                        />
                      </div>

                      {/* Checkbox: Isentar taxa de entrega */}
                      {deliveryType === 'DELIVERY' && (
                        <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <Checkbox
                            id="exemptDeliveryFee"
                            checked={exemptDeliveryFee}
                            onCheckedChange={(checked) => setExemptDeliveryFee(checked as boolean)}
                          />
                          <Label htmlFor="exemptDeliveryFee" className="text-sm font-medium cursor-pointer">
                            🚚 Isentar taxa de entrega
                          </Label>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Aviso para CONSUMIDOR FINAL */}
                {selectedCustomer?.customerType === 'CONSUMIDOR_FINAL' && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 flex-shrink-0 text-xl">
                          🏪
                        </div>
                        <div>
                          <h4 className="font-semibold text-amber-900 mb-2">Venda de Loja - Consumidor Final</h4>
                          <p className="text-sm text-amber-700 mb-2">
                            Este é um cliente <strong>Consumidor Final</strong>. Esta é uma venda de balcão.
                          </p>
                          <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
                            <li>Não precisa selecionar entrega/retirada</li>
                            <li>Pedido marcado como entregue automaticamente</li>
                            <li>Pagamento deve ser feito na hora</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-red-600" />
                      Forma de Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="discountAmount">Desconto Adicional</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            id="discountAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            placeholder={discountType === 'PERCENTAGE' ? '0.00' : '0.00'}
                          />
                        </div>
                        <Select value={discountType} onValueChange={(value: 'PERCENTAGE' | 'FIXED') => setDiscountType(value)}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FIXED">R$</SelectItem>
                            <SelectItem value="PERCENTAGE">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {discountType === 'PERCENTAGE' ? 
                          `Desconto percentual será calculado sobre o subtotal` : 
                          `Desconto fixo em reais`}. Desconto base do cliente ({formatCurrency(selectedCustomer?.customDiscount || 0)}) será aplicado automaticamente.
                      </p>
                    </div>

                    <div>
                      <Label>Método de Pagamento *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Dinheiro</SelectItem>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="DEBIT">Débito (+ 1% taxa)</SelectItem>
                          <SelectItem value="CREDIT_CARD">Crédito (+ 3,5% taxa)</SelectItem>
                          {selectedCustomer && selectedCustomer.creditLimit > 0 && selectedCustomer.canPayWithBoleto !== false && (
                            <SelectItem value="BOLETO">Boleto</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentMethod === 'BOLETO' && selectedCustomer?.allowInstallments && selectedCustomer?.installmentOptions && (
                      <div>
                        <Label>Parcelamento do Boleto</Label>
                        <Select value={boletoInstallments} onValueChange={setBoletoInstallments}>
                          <SelectTrigger className="border-orange-500">
                            <SelectValue placeholder="À vista" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="avista">À vista (1 boleto)</SelectItem>
                            {(() => {
                              const days = selectedCustomer.installmentOptions.split(',').map(d => d.trim()).filter(d => d)
                              const options = []
                              for (let i = 2; i <= days.length; i++) {
                                const selectedDays = days.slice(0, i)
                                const isMaxInstallments = i === days.length
                                options.push({
                                  value: `${i}x-${selectedDays.join('-')}`,
                                  label: `${i}x - ${selectedDays.join(', ')} dias${isMaxInstallments ? ' ⭐ (Padrão do Cliente)' : ''}`
                                })
                              }
                              return options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))
                            })()}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Cliente configurado para parcelamento em {selectedCustomer.installmentOptions.split(',').length} vezes
                        </p>
                      </div>
                    )}

                    {/* 🏦 Seletor de Conta Cora para BOLETO */}
                    {paymentMethod === 'BOLETO' && coraAccounts.length > 1 && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-blue-800 font-semibold flex items-center gap-2">
                          🏦 Conta Bancária para Boleto
                        </Label>
                        <div className="flex gap-2 mt-2">
                          {coraAccounts.map((acc) => (
                            <button
                              key={acc.account}
                              type="button"
                              onClick={() => setSelectedCoraAccount(acc.account)}
                              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                                selectedCoraAccount === acc.account
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-100'
                              }`}
                            >
                              {acc.name}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          O boleto será gerado na conta: <strong>{coraAccounts.find(a => a.account === selectedCoraAccount)?.name || selectedCoraAccount}</strong>
                        </p>
                      </div>
                    )}



                    {paymentMethod && (
                      <div className="pt-4 border-t">
                        <Label className="mb-2 block">Pagamento Combinado (Opcional)</Label>
                        <div className="space-y-3">
                          <div className="space-y-2 p-3 bg-gray-50 rounded border">
                            <Label className="text-xs font-semibold">Método Primário: {paymentMethod}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={primaryPaymentAmount}
                              onChange={(e) => setPrimaryPaymentAmount(e.target.value)}
                              placeholder={formatCurrency(total)}
                            />
                            {/* 🆕 Conta bancária para método primário */}
                            {paymentMethod !== 'BOLETO' && (
                              <div>
                                <Label className="text-xs">Conta Bancária (Método Primário) *</Label>
                                <Select value={primaryBankAccount} onValueChange={setPrimaryBankAccount}>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Selecione a conta *" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.isArray(bankAccounts) && bankAccounts.length > 0 ? (
                                      bankAccounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                          {account.name} - {account.bankName || 'Sem banco'}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="no-accounts" disabled>
                                        Nenhuma conta bancária disponível
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          
                          <Select value={secondaryPaymentMethod} onValueChange={setSecondaryPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="+ Outro método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">Nenhum</SelectItem>
                              <SelectItem value="CASH">Dinheiro</SelectItem>
                              <SelectItem value="PIX">PIX</SelectItem>
                              <SelectItem value="DEBIT">Débito</SelectItem>
                              <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                            </SelectContent>
                          </Select>

                          {secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' && (
                            <div className="space-y-2 p-3 bg-gray-50 rounded border">
                              <Label className="text-xs font-semibold">Método Secundário: {secondaryPaymentMethod}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={secondaryPaymentAmount}
                                onChange={(e) => setSecondaryPaymentAmount(e.target.value)}
                                placeholder="R$ 0,00"
                              />
                              {/* 🆕 Conta bancária para método secundário */}
                              <div>
                                <Label className="text-xs">Conta Bancária (Método Secundário) *</Label>
                                <Select value={secondaryBankAccount} onValueChange={setSecondaryBankAccount}>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Selecione a conta *" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.isArray(bankAccounts) && bankAccounts.length > 0 ? (
                                      bankAccounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                          {account.name} - {account.bankName || 'Sem banco'}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="no-accounts" disabled>
                                        Nenhuma conta bancária disponível
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Checkbox: Pedido já pago? */}
                    <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <Checkbox
                        id="isAlreadyPaid"
                        checked={isAlreadyPaid}
                        onCheckedChange={(checked) => setIsAlreadyPaid(checked as boolean)}
                      />
                      <Label htmlFor="isAlreadyPaid" className="text-sm font-medium cursor-pointer">
                        ✅ Pedido já foi pago (não irá para contas a receber)
                      </Label>
                    </div>

                    {/* 💵 Campo para valor recebido em dinheiro */}
                    {isAlreadyPaid && (paymentMethod === 'CASH' || secondaryPaymentMethod === 'CASH') && (
                      <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg space-y-2">
                        <Label className="text-sm font-semibold text-yellow-800">
                          💵 Valor Recebido em Dinheiro
                        </Label>
                        <p className="text-xs text-yellow-700">
                          Informe o valor que você recebeu (ex: R$ 70,00 para um pedido de R$ 69,96)
                        </p>
                        <Input
                          type="number"
                          step="0.01"
                          value={cashReceivedAmount}
                          onChange={(e) => setCashReceivedAmount(e.target.value)}
                          placeholder={`Ex: ${Math.ceil(total)}`}
                          className="bg-white border-yellow-400"
                        />
                        {cashReceivedAmount && parseFloat(cashReceivedAmount) > 0 && (
                          <p className="text-xs text-green-700 font-medium">
                            💰 Troco: {formatCurrency(parseFloat(cashReceivedAmount) - total)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Checkbox: Isentar taxa de cartão */}
                    {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT' || 
                      secondaryPaymentMethod === 'CREDIT_CARD' || secondaryPaymentMethod === 'DEBIT') && (
                      <div className="flex items-center space-x-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <Checkbox
                          id="exemptCardFee"
                          checked={exemptCardFee}
                          onCheckedChange={(checked) => setExemptCardFee(checked as boolean)}
                        />
                        <Label htmlFor="exemptCardFee" className="text-sm font-medium cursor-pointer">
                          💳 Isentar taxa de cartão
                        </Label>
                      </div>
                    )}

                    {/* Checkbox: Isentar taxa de boleto */}
                    {(paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO') && (
                      <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <Checkbox
                          id="exemptBoletoFee"
                          checked={exemptBoletoFee}
                          onCheckedChange={(checked) => setExemptBoletoFee(checked as boolean)}
                        />
                        <Label htmlFor="exemptBoletoFee" className="text-sm font-medium cursor-pointer">
                          🎫 Isentar taxa de boleto (R$ 2,50)
                        </Label>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleProceedToReview}
                  className="w-full h-12 bg-red-600 hover:bg-red-700"
                  disabled={!paymentMethod || (selectedCustomer?.customerType !== 'CONSUMIDOR_FINAL' && !deliveryDate) || submitting}
                >
                  {selectedCustomer?.customerType === 'CONSUMIDOR_FINAL' ? 'Finalizar Venda' : 'Revisar e Confirmar Pedido'}
                </Button>
              </motion.div>
            </div>

            {/* Cart Summary */}
            <div className="lg:sticky lg:top-24 h-fit">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-red-600" />
                    Resumo do Carrinho
                  </CardTitle>
                  <CardDescription>
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* 🏷️ Aviso de Promoções */}
                  {cart.some(item => item.product.isOnPromotion && item.product.promotionalPrice) && (
                    (() => {
                      const isCardPayment = paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT'
                      const isBoleto = paymentMethod === 'BOLETO'
                      return (
                        <Alert className={`mb-4 ${isCardPayment ? 'border-blue-500 bg-blue-50' : isBoleto ? 'border-orange-500 bg-orange-50' : 'border-green-500 bg-green-50'}`}>
                          <AlertCircle className={`h-4 w-4 ${isCardPayment ? 'text-blue-600' : isBoleto ? 'text-orange-600' : 'text-green-600'}`} />
                          <AlertDescription className="text-sm">
                            {isBoleto ? (
                              <span className="font-medium text-orange-700">
                                ⚠️ Preços promocionais <strong>não se aplicam</strong> a Boleto. Selecione PIX ou Dinheiro para manter o desconto.
                              </span>
                            ) : isCardPayment ? (
                              <span className="font-medium text-blue-700">
                                💳 Preços promocionais aplicados! <strong>Taxa de cartão obrigatória</strong> para itens em promoção.
                              </span>
                            ) : (
                              <span className="font-medium text-green-700">
                                ✓ Preços promocionais aplicados automaticamente!
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )
                    })()
                  )}
                  
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {cart.map(item => {
                      // 🏷️ Boleto não tem promoção, mas CARTÃO agora tem (com taxa obrigatória)
                      const isBoleto = paymentMethod === 'BOLETO'
                      const isPromotionActive = item.product.isOnPromotion && 
                        item.product.promotionalPrice && 
                        !isBoleto  // Promoção ativa para tudo EXCETO boleto
                      
                      return (
                      <div key={item.productId} className={`flex items-center gap-4 pb-3 border-b ${isPromotionActive ? 'bg-orange-50/50 p-2 rounded-lg border border-orange-200' : ''}`}>
                        <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={item.product.imageUrl || '/placeholder.png'}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                          />
                          {/* 🏷️ Badge de promoção */}
                          {item.product.isOnPromotion && (
                            <div className="absolute top-0 left-0 bg-orange-500 text-white text-[8px] px-1 py-0 rounded-br font-bold">
                              %
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
                          {/* 🏷️ Preço com promoção visual */}
                          {item.product.isOnPromotion && item.product.promotionalPrice ? (
                            <div className="flex items-center gap-2">
                              {isPromotionActive ? (
                                <>
                                  <span className="text-xs text-gray-400 line-through">
                                    {formatCurrency(item.product.priceWholesale)}
                                  </span>
                                  <span className="text-xs font-bold text-green-600">
                                    {formatCurrency(item.product.promotionalPrice)}
                                  </span>
                                  <span className="text-[10px] text-green-500 font-medium">✓ Promo</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs font-bold text-gray-700">
                                    {formatCurrency(item.product.priceWholesale)}
                                  </span>
                                  <span className="text-[10px] text-orange-500 font-medium">(sem desconto - Boleto)</span>
                                </>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-600">{formatCurrency(getUnitPrice(item.product, item.quantity))}</p>
                          )}
                          {/* Mostrar indicadores de preço */}
                          {(() => {
                            const hasCustomPrice = (item.product as any).hasCustomPrice
                            const customPrice = hasCustomPrice ? item.product.priceWholesale : null
                            const hasBulkDiscount = item.product.bulkDiscountMinQty && item.product.bulkDiscountPrice && item.quantity >= item.product.bulkDiscountMinQty
                            const bulkDiscountPrice = hasBulkDiscount ? item.product.bulkDiscountPrice : null
                            
                            // Caso 1: Tem catálogo E desconto por quantidade, desconto é menor
                            if (customPrice && bulkDiscountPrice && bulkDiscountPrice < customPrice) {
                              return (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded mt-0.5">
                                  💰 Desconto por qtd aplicado (melhor que catálogo)
                                </span>
                              )
                            }
                            // Caso 2: Tem catálogo E desconto, mas catálogo é menor/igual
                            if (customPrice && bulkDiscountPrice && bulkDiscountPrice >= customPrice) {
                              return (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mt-0.5">
                                  📋 Preço do catálogo (melhor que desconto)
                                </span>
                              )
                            }
                            // Caso 3: Só tem catálogo
                            if (customPrice && !hasBulkDiscount) {
                              return (
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                    📋 Preço do catálogo
                                  </span>
                                  {item.product.bulkDiscountMinQty && item.product.bulkDiscountPrice && (
                                    <span className="text-xs text-gray-500">
                                      Desconto a partir de {item.product.bulkDiscountMinQty} un
                                    </span>
                                  )}
                                </div>
                              )
                            }
                            // Caso 4: Só tem desconto por quantidade (sem catálogo)
                            if (!hasCustomPrice && bulkDiscountPrice) {
                              return (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded mt-0.5">
                                  💰 Desconto aplicado!
                                </span>
                              )
                            }
                            // Caso 5: Não tem catálogo, mas tem desconto disponível (quantidade não atingida)
                            if (!hasCustomPrice && item.product.bulkDiscountMinQty && item.product.bulkDiscountPrice && item.quantity < item.product.bulkDiscountMinQty) {
                              return (
                                <span className="text-xs text-gray-500 mt-0.5">
                                  Desconto a partir de {item.product.bulkDiscountMinQty} un
                                </span>
                              )
                            }
                            return null
                          })()}
                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                const decrement = item.product.soldByWeight ? 0.1 : (item.product.quantityIncrement || 1)
                                updateQuantity(item.productId, item.quantity - decrement)
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={item.quantity}
                              onChange={(e) => handleQuantityInputChange(item.productId, e.target.value)}
                              className="w-12 h-6 text-center text-xs p-0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                const increment = item.product.soldByWeight ? 0.1 : (item.product.quantityIncrement || 1)
                                updateQuantity(item.productId, item.quantity + increment)
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {/* 🏷️ Total com destaque promocional */}
                          {isPromotionActive ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-gray-400 line-through">
                                {formatCurrency(item.product.priceWholesale * item.quantity)}
                              </span>
                              <p className="font-bold text-sm text-orange-600">
                                {formatCurrency(getUnitPrice(item.product, item.quantity) * item.quantity)}
                              </p>
                            </div>
                          ) : (
                            <p className="font-bold text-sm">
                              {formatCurrency(getUnitPrice(item.product, item.quantity) * item.quantity)}
                            </p>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    
                    {customDiscountValue > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          Desconto Cliente
                        </span>
                        <span>-{formatCurrency(customDiscountValue)}</span>
                      </div>
                    )}

                    {manualDiscountValue > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto Adicional</span>
                        <span>-{formatCurrency(manualDiscountValue)}</span>
                      </div>
                    )}

                    {cardFee > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          Taxa de cartão
                        </span>
                        <span>+{formatCurrency(cardFee)}</span>
                      </div>
                    )}

                    {/* 🎫 Taxa de Boleto */}
                    {boletoFee > 0 && (
                      <div className="flex justify-between text-sm text-blue-600">
                        <span className="flex items-center gap-1">
                          🎫 Taxa Boleto
                        </span>
                        <span>+{formatCurrency(boletoFee)}</span>
                      </div>
                    )}

                    {/* 🏷️ Economia potencial com PIX/Dinheiro - só mostra quando Boleto/Cartão */}
                    {cart.some(item => item.product.isOnPromotion && item.product.promotionalPrice) && 
                     (paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT' || paymentMethod === 'CARD') && (
                      (() => {
                        const normalSubtotal = cart.reduce((sum, item) => {
                          return sum + (item.product.priceWholesale * item.quantity)
                        }, 0)
                        const promotionalSubtotal = cart.reduce((sum, item) => {
                          const price = (item.product.isOnPromotion && item.product.promotionalPrice) 
                            ? item.product.promotionalPrice 
                            : item.product.priceWholesale
                          return sum + (price * item.quantity)
                        }, 0)
                        const potentialSavings = normalSubtotal - promotionalSubtotal
                        
                        if (potentialSavings > 0) {
                          return (
                            <div className="flex justify-between text-sm text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-200">
                              <span className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Você economizaria com PIX/Dinheiro
                              </span>
                              <span className="font-bold">-{formatCurrency(potentialSavings)}</span>
                            </div>
                          )
                        }
                        return null
                      })()
                    )}

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-red-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {rulesSummary && (
        <OrderConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          onConfirm={handleConfirmOrder}
          rulesSummary={rulesSummary}
          totalValue={total}
          isLoading={submitting}
        />
      )}

      {/* Modal de Pagamento PIX */}
      <PixPaymentModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        onPaymentConfirmed={handlePixPaymentConfirmed}
        amount={(() => {
          // Pagamento combinado: PIX é secundário
          if (secondaryPaymentMethod === 'PIX') {
            return parseFloat(secondaryPaymentAmount) || 0
          }
          // Pagamento combinado: PIX é primário
          if (paymentMethod === 'PIX' && secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE') {
            return parseFloat(primaryPaymentAmount) || 0
          }
          // PIX único método
          return total
        })()}
        description={`Pedido Admin - ${selectedCustomer?.name || 'Cliente'}`}
        customerId={selectedCustomer?.id}
        customerName={selectedCustomer?.name}
        customerDocument={selectedCustomer?.cpfCnpj}
        createdBy={session?.user?.id}
      />
    </>
  )
}
