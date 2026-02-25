export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { BoletoStatus } from '@prisma/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    console.log('🚨🚨🚨 [API VERSION 4.0 - DEPLOYED AT ' + new Date().toISOString() + '] 🚨🚨🚨')
    console.log('[ADMIN_CUSTOMERS_HEALTH] 🔍 Iniciando busca de saúde financeira de todos os clientes...')

    if (!session || !session.user) {
      console.log('[ADMIN_CUSTOMERS_HEALTH] ❌ Sessão não encontrada')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userType = (session.user as any).userType

    console.log('[ADMIN_CUSTOMERS_HEALTH] 👤 Usuário logado:', {
      userType
    })

    if (userType !== 'ADMIN') {
      console.log('[ADMIN_CUSTOMERS_HEALTH] ❌ Usuário não é admin')
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    console.log('[ADMIN_CUSTOMERS_HEALTH] 🏪 Buscando TODOS os clientes do sistema...')

    // Buscar TODOS os clientes do sistema com suas informações financeiras
    const customers = await prisma.customer.findMany({
      include: {
        Boleto: {
          // 🎯 Buscar TODOS os boletos (incluindo PAID) para verificar se pedido já tem boleto
          orderBy: {
            dueDate: 'asc'
          }
        },
        Receivable: {
          // 🎯 Buscar TODOS os receivables (incluindo CANCELLED) para verificar se pedido já tem receivable
          // IMPORTANTE: Receivables CANCELLED não serão contados no crédito, mas precisam ser carregados
          // para evitar que pedidos com receivables cancelados sejam contados como "sem receivable"
          orderBy: {
            dueDate: 'asc'
          }
        },
        Order: {
          where: {
            paymentStatus: 'UNPAID'
          }
        }
      }
    })

    console.log('[ADMIN_CUSTOMERS_HEALTH] 📊 Clientes encontrados:', customers.length)
    if (customers.length > 0) {
      console.log('[ADMIN_CUSTOMERS_HEALTH] 👥 Primeiros 3 clientes:', customers.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        city: c.city,
        sellerId: c.sellerId
      })))
    }

    console.log('[ADMIN_CUSTOMERS_HEALTH] 👷 Buscando funcionários com limite de crédito...')
    
    // Buscar funcionários que têm limite de crédito ou recebem adiantamento
    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { creditLimit: { gt: 0 } },
          { receivesAdvance: true }
        ],
        isActive: true
      },
      include: {
        receivables: {
          orderBy: {
            dueDate: 'asc'
          }
        },
        orders: {
          where: {
            paymentStatus: 'UNPAID'
          },
          select: {
            id: true,
            total: true,
            paymentStatus: true
          }
        }
      }
    })

    console.log('[ADMIN_CUSTOMERS_HEALTH] 👷 Funcionários encontrados:', employees.length)
    
    // ✅ LIMITE FIXO DE R$ 300 PARA TODOS FUNCIONÁRIOS
    const EMPLOYEE_CREDIT_LIMIT = 300
    
    // Transformar funcionários no formato de clientes para unificar o processamento
    const employeesAsCustomers = employees.map((emp: any) => ({
      id: emp.id,
      name: `${emp.name} (Funcionário)`,
      email: emp.email || null,
      phone: emp.phone || null,
      address: emp.address || null,
      city: null,
      state: null,
      cpfCnpj: emp.cpf,
      creditLimit: EMPLOYEE_CREDIT_LIMIT, // ✅ LIMITE FIXO R$ 300
      availableCredit: EMPLOYEE_CREDIT_LIMIT, // Será recalculado depois
      isActive: emp.isActive,
      isEmployee: true, // 🔥 Flag para identificar funcionários
      employeeNumber: emp.employeeNumber,
      position: emp.position,
      Boleto: [], // Funcionários não têm boletos
      Receivable: emp.receivables || [],
      Order: emp.orders || [] // Incluir pedidos não pagos
    }))

    console.log('[ADMIN_CUSTOMERS_HEALTH] 📦 Funcionários transformados:', employeesAsCustomers.length)
    
    // Unir clientes e funcionários
    const allCustomers = [...customers, ...employeesAsCustomers]
    console.log('[ADMIN_CUSTOMERS_HEALTH] 🎯 Total de clientes + funcionários:', allCustomers.length)

    // Helper function to get START of current day in Brasília timezone
    // Retorna a data de hoje normalizada para comparação (sem horas)
    function getBrasiliaToday() {
      const now = new Date()
      // Subtrair 3 horas para obter horário de Brasília (UTC-3)
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
      
      // Pegar ano, mês e dia em horário de Brasília
      const year = brasiliaTime.getUTCFullYear()
      const month = brasiliaTime.getUTCMonth()
      const day = brasiliaTime.getUTCDate()
      
      // ⚠️ IMPORTANTE: Retornar 00:00:00 UTC do dia de hoje para comparação correta
      // Isso garante que vencimentos no mesmo dia (ex: 15/01 00:00 UTC) não sejam 
      // considerados vencidos quando comparados com hoje (15/01)
      const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      return todayStart
    }
    
    const brasiliaToday = getBrasiliaToday()
    console.log('[ADMIN_CUSTOMERS_HEALTH] 📅 Data de hoje para comparação:', brasiliaToday.toISOString())
    
    // Função auxiliar para traduzir status de inglês para português
    function translateStatus(status: string, dueDate: Date | string | null): string {
      // Traduções padrão
      const translations: { [key: string]: string } = {
        'PENDING': 'PENDENTE',
        'OVERDUE': 'ATRASADO',
        'PAID': 'PAGO',
        'CANCELLED': 'CANCELADO'
      }
      
      // Se não tem data válida, retornar tradução direta
      if (!dueDate) {
        return translations[status] || status
      }
      
      try {
        const dueDateObj = new Date(dueDate)
        
        // Verificar se a data é válida
        if (isNaN(dueDateObj.getTime())) {
          return translations[status] || status
        }
        
        // Normalizar para 00:00:00 UTC do dia do vencimento
        const dueDateDay = new Date(Date.UTC(
          dueDateObj.getUTCFullYear(),
          dueDateObj.getUTCMonth(), 
          dueDateObj.getUTCDate(),
          0, 0, 0, 0  // ⚠️ Usar 00:00 UTC para comparação consistente
        ))
        
        // Se está PENDING mas venceu (data ANTERIOR ao dia de hoje), é ATRASADO
        // ⚠️ Vencimentos no DIA DE HOJE não são considerados vencidos
        if (status === 'PENDING' && dueDateDay < brasiliaToday) {
          return 'ATRASADO'
        }
        
        return translations[status] || status
      } catch {
        return translations[status] || status
      }
    }
    
    // Processar dados dos clientes e funcionários
    const customersFinancial = allCustomers.map((customer: any) => {
      const openBoletos = customer.Boleto.filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE')
      // Um boleto só está vencido se a data de vencimento for ANTERIOR ao dia de hoje
      // ⚠️ Vencimentos no DIA DE HOJE não são considerados vencidos
      const overdueBoletos = customer.Boleto.filter((b: any) => {
        if (!b.dueDate) return false
        try {
          const boletoDate = new Date(b.dueDate)
          if (isNaN(boletoDate.getTime())) return false
          // Normalizar para 00:00:00 UTC do dia
          const boletoDay = new Date(Date.UTC(
            boletoDate.getUTCFullYear(),
            boletoDate.getUTCMonth(), 
            boletoDate.getUTCDate(),
            0, 0, 0, 0  // ⚠️ Usar 00:00 UTC para comparação consistente
          ))
          // Considera vencido APENAS se for ANTERIOR ao dia de hoje
          return (b.status === 'OVERDUE' || b.status === 'PENDING') && boletoDay < brasiliaToday
        } catch {
          return false
        }
      })
      
      // Processar receivables (contas a receber)
      // ⚠️ IMPORTANTE: Não contar receivables que já têm boletoId, pois eles já são representados pelo boleto
      const openReceivables = customer.Receivable.filter((r: any) => 
        (r.status === 'PENDING' || r.status === 'OVERDUE') && 
        !r.boletoId  // <-- Ignora receivables vinculados a boletos para evitar duplicidade
      )
      const overdueReceivables = customer.Receivable.filter((r: any) => {
        if (r.boletoId) return false  // <-- Ignora receivables vinculados a boletos
        if (!r.dueDate) return false
        
        try {
          const receivableDate = new Date(r.dueDate)
          if (isNaN(receivableDate.getTime())) return false
          // Normalizar para 00:00:00 UTC do dia
          const receivableDay = new Date(Date.UTC(
            receivableDate.getUTCFullYear(),
            receivableDate.getUTCMonth(), 
            receivableDate.getUTCDate(),
            0, 0, 0, 0  // ⚠️ Usar 00:00 UTC para comparação consistente
          ))
          // Considera vencido APENAS se for ANTERIOR ao dia de hoje
          return (r.status === 'OVERDUE' || r.status === 'PENDING') && receivableDay < brasiliaToday
        } catch {
          return false
        }
      })
      
      // 🔥 CORREÇÃO: Total em Débito deve mostrar APENAS valores ATRASADOS, não todos os pendentes
      const totalDebt = overdueBoletos.reduce((sum: number, b: any) => sum + b.amount, 0) +
                        overdueReceivables.reduce((sum: number, r: any) => sum + r.amount, 0)
      
      // ✅ CALCULAR availableCredit DINAMICAMENTE (não usar o valor do BD que está desatualizado)
      // Recebíveis pendentes/atrasados que não são boletos (para evitar duplicação)
      const pendingReceivablesAmount = customer.Receivable
        .filter((r: any) => (r.status === 'PENDING' || r.status === 'OVERDUE') && !r.boletoId)
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      
      // 🧾 Boletos pendentes (PENDING ou OVERDUE)
      const pendingBoletosAmount = customer.Boleto
        .filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE')
        .reduce((sum: number, b: any) => sum + Number(b.amount), 0)
      
      // Pedidos não pagos (excluir pedidos com boleto OU receivable para evitar duplicação)
      // Order NÃO tem campo boletoId, então verificamos se existe Boleto ou Receivable com orderId
      const unpaidOrdersAmount = customer.Order
        .filter((o: any) => {
          if (o.paymentStatus !== 'UNPAID') return false
          
          // Verificar se existe um boleto para este pedido
          const hasBoleto = customer.Boleto.some((b: any) => b.orderId === o.id)
          
          // Verificar se existe QUALQUER receivable para este pedido (com ou sem boleto)
          const hasReceivable = customer.Receivable.some((r: any) => r.orderId === o.id)
          
          // Incluir apenas orders que NÃO têm boleto E NÃO têm receivable (para evitar duplicação)
          return !hasBoleto && !hasReceivable
        })
        .reduce((sum: number, o: any) => sum + Number(o.total), 0)
      
      const totalUsed = pendingReceivablesAmount + pendingBoletosAmount + unpaidOrdersAmount
      const dynamicAvailableCredit = Number(customer.creditLimit) - totalUsed
      
      // 🔍 DEBUG: Log específico para cliente "joao marcos"
      if (customer.name.toLowerCase().includes('joao marcos')) {
        console.log(`🎯 [JOAO MARCOS] Limite: ${customer.creditLimit} | EM USO: ${totalUsed} | Disponível: ${dynamicAvailableCredit}`)
        console.log(`   Receivables: ${pendingReceivablesAmount} | Boletos: ${pendingBoletosAmount} | Orders: ${unpaidOrdersAmount}`)
      }
      
      // 🔧 Função auxiliar para converter data com segurança
      const safeToISOString = (dateValue: any): string | null => {
        if (!dateValue) return null;
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return null;
          return date.toISOString();
        } catch {
          return null;
        }
      };

      const boletos = customer.Boleto.map((boleto: any) => {
        let installmentInfo = undefined
        if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
          installmentInfo = `Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
        }

        // Traduzir status para português com lógica de timezone
        const translatedStatus = translateStatus(boleto.status, boleto.dueDate)

        return {
          id: boleto.id,
          boletoNumber: boleto.boletoNumber,
          amount: boleto.amount,
          dueDate: safeToISOString(boleto.dueDate),
          status: translatedStatus,  // ✅ Status já traduzido
          installmentInfo
        }
      })

      const receivables = customer.Receivable.map((receivable: any) => {
        let installmentInfo = undefined
        if (receivable.isInstallment && receivable.installmentNumber && receivable.totalInstallments) {
          installmentInfo = `Parcela ${receivable.installmentNumber}/${receivable.totalInstallments}`
        }

        // Traduzir status para português com lógica de timezone
        const translatedStatus = translateStatus(receivable.status, receivable.dueDate)

        return {
          id: receivable.id,
          description: receivable.description,
          amount: receivable.amount,
          dueDate: safeToISOString(receivable.dueDate),
          paymentDate: safeToISOString(receivable.paymentDate),
          status: translatedStatus,  // ✅ Status já traduzido
          paymentMethod: receivable.paymentMethod,
          installmentInfo,
          boletoId: receivable.boletoId || null
        }
      })

      // Mapear pedidos não pagos
      // 🎯 FILTRAR: Excluir pedidos que JÁ têm receivable ou boleto vinculado
      const pendingOrders = customer.Order
        .filter((order: any) => {
          if (order.paymentStatus !== 'UNPAID') return false
          
          // Verificar se existe receivable vinculado a este pedido
          const hasReceivable = customer.Receivable.some((r: any) => r.orderId === order.id)
          
          // Verificar se existe boleto vinculado a este pedido
          const hasBoleto = customer.Boleto.some((b: any) => b.orderId === order.id)
          
          // Só incluir se for UNPAID E NÃO tem receivable E NÃO tem boleto
          // (ou seja, pedido que ainda não foi processado financeiramente)
          return !hasReceivable && !hasBoleto
        })
        .map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          createdAt: safeToISOString(order.createdAt),
          status: order.status
        }))

      return {
        id: customer.id,
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
        phone: customer.phone,
        city: customer.city,
        creditLimit: customer.creditLimit,
        availableCredit: dynamicAvailableCredit,
        isActive: customer.isActive,
        totalDebt,
        overdueBoletos: overdueBoletos.length + overdueReceivables.length,
        openBoletos: openBoletos.length + openReceivables.length,
        lastOrderDate: customer.Order.length > 0 
          ? (() => {
              try {
                const validDates = customer.Order
                  .map((o: any) => o.createdAt ? new Date(o.createdAt).getTime() : 0)
                  .filter((t: number) => t > 0 && !isNaN(t))
                return validDates.length > 0 ? new Date(Math.max(...validDates)).toISOString() : null
              } catch {
                return null
              }
            })()
          : null,
        boletos,
        receivables,
        pendingOrders
      }
    })

    // Ordenar: clientes em atraso primeiro, depois bloqueados, depois por limite disponível
    customersFinancial.sort((a: any, b: any) => {
      if (a.overdueBoletos > 0 && b.overdueBoletos === 0) return -1
      if (a.overdueBoletos === 0 && b.overdueBoletos > 0) return 1
      if (!a.isActive && b.isActive) return -1
      if (a.isActive && !b.isActive) return 1
      return b.availableCredit - a.availableCredit
    })

    // 🔥 CORREÇÃO: Clientes bloqueados = clientes manualmente bloqueados OU com boletos em atraso
    const customersBlocked = customersFinancial.filter((c: any) => !c.isActive || c.overdueBoletos > 0).length
    
    console.log('[ADMIN_CUSTOMERS_HEALTH] ✅ Retornando dados:', {
      totalCustomers: customers.length,
      customersProcessed: customersFinancial.length,
      summary: {
        totalCustomers: customers.length,
        customersOverdue: customersFinancial.filter((c: any) => c.overdueBoletos > 0).length,
        customersBlocked: customersBlocked,
        totalDebt: customersFinancial.reduce((sum: number, c: any) => sum + c.totalDebt, 0)
      }
    })

    const responseData = {
      customers: customersFinancial,
      summary: {
        totalCustomers: allCustomers.length,
        totalRealCustomers: customers.length,
        totalEmployees: employees.length,
        customersOverdue: customersFinancial.filter((c: any) => c.overdueBoletos > 0).length,
        customersBlocked: customersBlocked,
        totalDebt: customersFinancial.reduce((sum: number, c: any) => sum + c.totalDebt, 0)
      },
      _metadata: {
        timestamp: new Date().toISOString(),
        version: '5.0-LOAD-ALL-RECEIVABLES-' + Date.now(),
        buildTime: Date.now(),
        deployedAt: new Date().toISOString(),
        fix: 'Load all receivables including CANCELLED to prevent duplicates'
      }
    }
    
    console.log('[ADMIN_CUSTOMERS_HEALTH] 🎯 RETORNANDO RESPOSTA COM TIMESTAMP:', responseData._metadata)
    
    const timestamp = Date.now();
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-API-Version': '5.0-LOAD-ALL-RECEIVABLES-' + timestamp,
        'X-Build-Time': String(timestamp),
        'X-Deployed-At': new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[ADMIN_CUSTOMERS_HEALTH] ❌ ERRO:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados financeiros' },
      { status: 500 }
    )
  }
}
