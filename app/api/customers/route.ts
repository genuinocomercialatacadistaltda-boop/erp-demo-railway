
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'
import bcrypt from 'bcryptjs'
import { productSelect } from '@/lib/product-select'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Only admin can view all customers
    if (user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 🔧 NOVOS FILTROS AVANÇADOS
    const { searchParams } = new URL(request.url);
    const paymentTermsFilter = searchParams.get('paymentTerms'); // "30", "15", "7", etc.
    const creditLimitFilter = searchParams.get('creditLimit'); // "none", "above5000", "above10000"
    const inactivityDays = searchParams.get('inactivityDays'); // "15", "30", "60", "90"
    const neverOrdered = searchParams.get('neverOrdered'); // "true"
    const noCustomCatalog = searchParams.get('noCustomCatalog'); // "true"
    const isActiveFilter = searchParams.get('isActive'); // "true", "false", null (all)
    
    // 🆕 FILTRO POR DATA DE CADASTRO
    const startDateParam = searchParams.get('startDate'); // "2026-01-01"
    const endDateParam = searchParams.get('endDate'); // "2026-01-31"
    const monthParam = searchParams.get('month'); // "2026-01" (atalho para mês específico)
    
    // Construir filtro de data de criação
    let createdAtFilter: any = undefined;
    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      createdAtFilter = {
        gte: startDate,
        lte: endDate
      };
    } else if (monthParam) {
      // Formato: "2026-01"
      const [year, month] = monthParam.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Último dia do mês
      createdAtFilter = {
        gte: startDate,
        lte: endDate
      };
    }

    // 🆕 Buscar clientes normais
    const customers = await prisma.customer.findMany({
      where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      include: {
        Seller: {
          select: {
            name: true
          }
        },
        User: {
          select: {
            id: true,
            email: true,
            userType: true
          }
        },
        Order: {
          where: {
            paymentStatus: 'UNPAID'
          },
          select: {
            id: true,
            total: true,
            status: true,
            paymentStatus: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        // 🔧 Incluir TODOS recebíveis (incluindo CANCELLED) para evitar duplicação
        Receivable: {
          orderBy: {
            dueDate: 'asc'
          }
        },
        // 🔧 Incluir TODOS boletos para verificação de duplicação correta
        Boleto: {
          orderBy: {
            dueDate: 'asc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // 🆕 Buscar funcionários com limite de crédito (que fazem pedidos como clientes)
    const employees = await prisma.employee.findMany({
      where: {
        creditLimit: {
          gt: 0
        }
      },
      include: {
        orders: {
          where: {
            paymentStatus: 'UNPAID'
          },
          select: {
            id: true,
            total: true,
            status: true,
            paymentStatus: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        receivables: {
          orderBy: {
            dueDate: 'asc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log('🔥🔥🔥 [CUSTOMERS API V2] Clientes carregados:', customers.length)
    console.log('🏠🏠🏠 [CUSTOMERS API V2] Funcionários carregados:', employees.length)
    
    // Serialize customers with correct availableCredit calculation
    const serializedCustomers = customers.map((customer: any) => {
      // Calcular crédito usado (recebíveis pendentes + boletos pendentes + pedidos confirmados/pendentes)
      
      // 💰 Receivables pendentes SEM boleto (para evitar duplicação com boletos)
      const receivablesWithoutBoleto = customer.Receivable.filter((r: any) => 
        !r.boletoId && (r.status === 'PENDING' || r.status === 'OVERDUE')
      )
      const pendingReceivables = receivablesWithoutBoleto.reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      
      // 🔍 LOG para cliente Thaís
      if (customer.name.toLowerCase().includes('thais') || customer.name.toLowerCase().includes('thaís')) {
        console.log('🔥 [THAIS] Nome:', customer.name)
        console.log('🔥 [THAIS] Total Orders carregados:', customer.Order?.length || 0)
        console.log('🔥 [THAIS] Total Receivables:', customer.Receivable?.length || 0)
        console.log('🔥 [THAIS] Total Boletos:', customer.Boleto?.length || 0)
        console.log('🔥 [THAIS] Receivables pendentes:', receivablesWithoutBoleto.length)
        console.log('🔥 [THAIS] Pending Receivables SUM:', pendingReceivables)
      }
      
      // 🧾 Boletos pendentes (PENDING ou OVERDUE)
      const boletosFiltered = customer.Boleto.filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE')
      const pendingBoletos = boletosFiltered.reduce((sum: number, b: any) => sum + Number(b.amount), 0)
      
      // 🔍 LOG para cliente Thaís (continuação)
      if (customer.name.toLowerCase().includes('thais') || customer.name.toLowerCase().includes('thaís')) {
        console.log('🔥 [THAIS] Boletos pendentes:', boletosFiltered.length)
        console.log('🔥 [THAIS] Pending Boletos SUM:', pendingBoletos)
      }
      
      // 🔧 CORREÇÃO CRÍTICA: Contar apenas pedidos não pagos (UNPAID) SEM boleto E SEM receivable
      // Order NÃO tem campo boletoId, então verificamos se existe Boleto ou Receivable com orderId
      const ordersFiltered = customer.Order.filter((order: any) => {
        if (order.paymentStatus !== 'UNPAID') return false
        
        // Verificar se existe um boleto para este pedido
        const hasBoleto = customer.Boleto.some((b: any) => b.orderId === order.id)
        
        // Verificar se existe QUALQUER receivable para este pedido (com ou sem boleto)
        const hasReceivable = customer.Receivable.some((r: any) => r.orderId === order.id)
        
        // Incluir apenas orders que NÃO têm boleto E NÃO têm receivable (para evitar duplicação)
        return !hasBoleto && !hasReceivable
      })
      const pendingOrders = ordersFiltered.reduce((sum: number, o: any) => sum + Number(o.total), 0)
      
      // 🔍 LOG para cliente Thaís (final)
      if (customer.name.toLowerCase().includes('thais') || customer.name.toLowerCase().includes('thaís')) {
        console.log('🔥 [THAIS] Orders filtrados (UNPAID sem boleto/receivable):', ordersFiltered.length)
        console.log('🔥 [THAIS] Pending Orders SUM:', pendingOrders)
        console.log('🔥 [THAIS] ===================================')
        console.log('🔥 [THAIS] TOTAL USADO:', pendingReceivables + pendingBoletos + pendingOrders)
        console.log('🔥 [THAIS] LIMITE:', customer.creditLimit)
        console.log('🔥 [THAIS] DISPONÍVEL CALCULADO:', Number(customer.creditLimit) - (pendingReceivables + pendingBoletos + pendingOrders))
        console.log('🔥 [THAIS] ===================================')
      }
      
      const totalUsed = pendingReceivables + pendingBoletos + pendingOrders
      const correctAvailableCredit = Number(customer.creditLimit) - totalUsed
      
      return {
        ...customer,
        creditLimit: Number(customer.creditLimit),
        availableCredit: correctAvailableCredit, // ✅ Cálculo dinâmico correto
        customDiscount: Number(customer.customDiscount),
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        // Retornar apenas pedidos UNPAID (já filtrados pelo where do Prisma)
        Order: customer.Order.map((order: any) => ({
          ...order,
          total: Number(order.total),
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString()
        })),
        // Remover Receivable e Boleto do retorno (foram usados apenas para cálculo)
        Receivable: undefined,
        Boleto: undefined
      }
    })

    // 🆕 FUNCIONÁRIOS: Serializar com limite FIXO de R$ 300
    const EMPLOYEE_CREDIT_LIMIT = 300
    
    const serializedEmployees = employees.map((employee: any) => {
      // 🔥 CORREÇÃO: Evitar duplicação entre Orders e Receivables
      // Se um receivable tem orderId, significa que já está representado pela Order
      
      const orders = employee.orders || []
      const receivables = employee.receivables || []
      
      // IDs de ordens não pagas
      const unpaidOrderIds = orders
        .filter((o: any) => o.paymentStatus === 'UNPAID')
        .map((o: any) => o.id)
      
      // Receivables pendentes que NÃO estão vinculados a uma ordem não paga
      const pendingReceivablesNotInOrders = receivables
        .filter((r: any) => {
          const isPending = r.status === 'PENDING' || r.status === 'OVERDUE'
          const isAlreadyCountedInOrder = r.orderId && unpaidOrderIds.includes(r.orderId)
          return isPending && !isAlreadyCountedInOrder
        })
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      
      // Total de ordens não pagas
      const pendingOrders = orders
        .filter((o: any) => o.paymentStatus === 'UNPAID')
        .reduce((sum: number, o: any) => sum + Number(o.total), 0)
      
      const totalUsed = pendingReceivablesNotInOrders + pendingOrders
      const availableCredit = EMPLOYEE_CREDIT_LIMIT - totalUsed
      
      console.log(`👷 [EMPLOYEE] ${employee.name}: Limite R$ ${EMPLOYEE_CREDIT_LIMIT}, Usado R$ ${totalUsed} (Orders: ${pendingOrders}, Receivables s/ dup: ${pendingReceivablesNotInOrders}), Disponível R$ ${availableCredit}`)
      
      return {
        id: employee.id,
        name: employee.name,
        phone: employee.phone || '',
        cpfCnpj: employee.cpf || '',
        city: '',
        address: '',
        email: employee.email || '',
        creditLimit: EMPLOYEE_CREDIT_LIMIT, // ✅ LIMITE FIXO R$ 300
        availableCredit: availableCredit,
        customDiscount: 0,
        isBlocked: false,
        isActive: true, // ✅ Funcionários sempre ativos
        userType: 'EMPLOYEE',
        isEmployee: true, // Flag para identificar funcionários
        createdAt: employee.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: employee.updatedAt?.toISOString() || new Date().toISOString(),
        Order: (employee.orders || []).map((order: any) => ({
          ...order,
          total: Number(order.total),
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt?.toISOString() || new Date().toISOString()
        }))
      }
    })
    
    // Combinar clientes + funcionários
    let allCustomers = [...serializedCustomers, ...serializedEmployees]
    console.log(`📊 [CUSTOMERS API] Total ANTES DOS FILTROS: ${allCustomers.length} (Clientes: ${serializedCustomers.length}, Funcionários: ${serializedEmployees.length})`)

    // 🔧 APLICAR FILTROS AVANÇADOS
    
    // Filtro 1: Status Ativo/Inativo
    if (isActiveFilter !== null) {
      const isActiveBoolean = isActiveFilter === 'true'
      allCustomers = allCustomers.filter(c => c.isActive === isActiveBoolean || c.isEmployee)
      console.log(`🔧 Filtro isActive=${isActiveBoolean}: ${allCustomers.length} restantes`)
    }
    
    // Filtro 2: Prazo de pagamento
    if (paymentTermsFilter) {
      const terms = parseInt(paymentTermsFilter)
      allCustomers = allCustomers.filter(c => c.paymentTerms === terms)
      console.log(`🔧 Filtro paymentTerms=${terms}: ${allCustomers.length} restantes`)
    }
    
    // Filtro 3: Limite de crédito
    if (creditLimitFilter) {
      if (creditLimitFilter === 'none') {
        allCustomers = allCustomers.filter(c => Number(c.creditLimit) === 0)
        console.log(`🔧 Filtro creditLimit=none: ${allCustomers.length} restantes`)
      } else if (creditLimitFilter === 'above5000') {
        allCustomers = allCustomers.filter(c => Number(c.creditLimit) >= 5000)
        console.log(`🔧 Filtro creditLimit>=5000: ${allCustomers.length} restantes`)
      } else if (creditLimitFilter === 'above10000') {
        allCustomers = allCustomers.filter(c => Number(c.creditLimit) >= 10000)
        console.log(`🔧 Filtro creditLimit>=10000: ${allCustomers.length} restantes`)
      }
    }
    
    // Filtro 4: Clientes que nunca compraram
    if (neverOrdered === 'true') {
      allCustomers = allCustomers.filter(c => !c.Order || c.Order.length === 0)
      console.log(`🔧 Filtro neverOrdered: ${allCustomers.length} restantes`)
    }
    
    // Filtro 5: Clientes sem catálogo personalizado
    if (noCustomCatalog === 'true') {
      // Buscar IDs de clientes que TEM produtos personalizados
      const customerIds = allCustomers
        .filter(c => !c.isEmployee)
        .map(c => c.id)
      
      if (customerIds.length > 0) {
        const customersWithCatalog = await prisma.customerProduct.findMany({
          where: {
            customerId: { in: customerIds }
          },
          select: {
            customerId: true
          },
          distinct: ['customerId']
        })
        
        const customerIdsWithCatalog = new Set(customersWithCatalog.map(cp => cp.customerId))
        
        // Filtrar apenas clientes SEM catálogo personalizado
        allCustomers = allCustomers.filter(c => {
          if (c.isEmployee) return true // Não filtrar funcionários
          return !customerIdsWithCatalog.has(c.id)
        })
        
        console.log(`🔧 Filtro noCustomCatalog: ${allCustomers.length} restantes`)
      }
    }
    
    // Filtro 6: Clientes inativos há X dias (requer busca adicional)
    if (inactivityDays) {
      const days = parseInt(inactivityDays)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      
      // Buscar todos os pedidos dos clientes para verificar última compra
      const customerIds = allCustomers
        .filter(c => !c.isEmployee)
        .map(c => c.id)
      
      if (customerIds.length > 0) {
        const latestOrders = await prisma.order.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customerIds },
            status: { not: 'CANCELLED' }
          },
          _max: {
            createdAt: true
          }
        })
        
        const activeCustomerIds = new Set(
          latestOrders
            .filter(o => o._max.createdAt && o._max.createdAt > cutoffDate)
            .map(o => o.customerId)
        )
        
        allCustomers = allCustomers.filter(c => {
          if (c.isEmployee) return true // Não filtrar funcionários
          return !activeCustomerIds.has(c.id)
        })
        
        console.log(`🔧 Filtro inactivityDays>=${days}: ${allCustomers.length} restantes`)
      }
    }

    console.log(`📊 [CUSTOMERS API] Total APÓS FILTROS: ${allCustomers.length}`)

    const timestamp = Date.now()
    return NextResponse.json(allCustomers, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-API-Version': 'V3-WITH-EMPLOYEES-' + timestamp,
        'X-Build-Time': String(timestamp)
      }
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Only admin can create customers
    if (user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      email,
      phone,
      cpfCnpj,
      city,
      address,
      creditLimit,
      customDiscount,
      paymentTerms,
      allowInstallments,
      installmentOptions,
      canPayWithBoleto,
      password,
      sellerId,
      birthDate,
      referredBy
    } = body

    // Sem validações - aceita tudo

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email: email || null,
        phone: phone || '',
        cpfCnpj: cpfCnpj || '',
        city: city || '',
        address: address || null,
        creditLimit: parseFloat(creditLimit) || 0,
        availableCredit: parseFloat(creditLimit) || 0,
        customDiscount: parseFloat(customDiscount) || 0,
        paymentTerms: parseInt(paymentTerms) || 30,
        allowInstallments: allowInstallments || false,
        installmentOptions: installmentOptions || null,
        canPayWithBoleto: canPayWithBoleto !== false, // Default true
        sellerId: sellerId || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        referredBy: referredBy || null,
        useCustomCatalog: true, // Sempre ativo
        updatedAt: new Date()
      }
    })

    // Buscar todos os produtos ativos de atacado
    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        availableIn: {
          in: ['WHOLESALE', 'BOTH']
        }
      },
      select: productSelect
    })

    // Criar todos os produtos como visíveis para o cliente
    if (allProducts.length > 0) {
      await prisma.customerProduct.createMany({
        data: allProducts.map((product: any) => ({
          id: crypto.randomUUID(),
          customerId: customer.id,
          productId: product.id,
          customPrice: null,
          isVisible: true, // Todos visíveis
          updatedAt: new Date()
        }))
      })
    }

    // Create user account for the customer (only if email and password are provided)
    let customerUser = null
    if (email && password) {
      const hashedPassword = await bcrypt.hash(password, 12)
      customerUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email,
          name,
          password: hashedPassword,
          userType: 'CUSTOMER',
          customerId: customer.id,
          updatedAt: new Date()
        }
      })
    }

    // Serialize customer
    const serializedCustomer = {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      availableCredit: Number(customer.availableCredit),
      customDiscount: Number(customer.customDiscount),
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      user: customerUser ? {
        id: customerUser.id,
        email: customerUser.email,
        userType: customerUser.userType
      } : null
    }

    return NextResponse.json(serializedCustomer)
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
