export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { BoletoStatus } from '@prisma/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    console.log('[SELLERS_FINANCIAL] 🔍 Iniciando busca de dados financeiros...')

    if (!session || !session.user) {
      console.log('[SELLERS_FINANCIAL] ❌ Sessão não encontrada')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userType = (session.user as any).userType
    const userId = (session.user as any).id
    const userEmail = (session.user as any).email
    const sessionSellerId = (session.user as any).sellerId // ID do seller se for Employee-Seller

    console.log('[SELLERS_FINANCIAL] 👤 Usuário logado:', {
      userId,
      userEmail,
      userType,
      sessionSellerId
    })

    if (userType !== 'SELLER') {
      console.log('[SELLERS_FINANCIAL] ❌ Usuário não é vendedor')
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    let seller: any = null

    // 🔥 CASO 1: Funcionário-Vendedor (Employee com Seller vinculado)
    // A sessão já tem o sellerId diretamente
    if (sessionSellerId) {
      console.log('[SELLERS_FINANCIAL] 👔 Usuário é Employee-Seller, buscando seller por ID:', sessionSellerId)
      
      seller = await prisma.seller.findUnique({
        where: { id: sessionSellerId }
      })

      console.log('[SELLERS_FINANCIAL] 🔎 Seller encontrado (via Employee):', {
        sellerId: seller?.id,
        sellerName: seller?.name
      })
    } 
    // 🔥 CASO 2: Vendedor tradicional (User com Seller vinculado)
    else {
      console.log('[SELLERS_FINANCIAL] 👤 Usuário é User-Seller, buscando user e seller...')
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { Seller: true }
      })

      console.log('[SELLERS_FINANCIAL] 🔎 User encontrado:', {
        userId: user?.id,
        userName: user?.name,
        hasSeller: !!user?.Seller,
        sellerId: user?.Seller?.id,
        sellerName: user?.Seller?.name
      })

      if (user && user.Seller) {
        seller = user.Seller
      }
    }

    if (!seller) {
      console.log('[SELLERS_FINANCIAL] ❌ Vendedor não encontrado no banco')
      return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 })
    }

    console.log('[SELLERS_FINANCIAL] 🏪 Buscando clientes do vendedor:', seller.name, '(ID:', seller.id, ')')

    // Buscar todos os clientes do vendedor com suas informações financeiras
    const customers = await prisma.customer.findMany({
      where: {
        sellerId: seller.id
      },
      include: {
        Boleto: {
          where: {
            status: {
              in: ['PENDING', 'OVERDUE']
            }
          },
          orderBy: {
            dueDate: 'asc'
          }
        },
        Receivable: {
          where: {
            status: {
              in: ['PENDING', 'OVERDUE', 'PAID']
            }
          },
          orderBy: {
            dueDate: 'asc'
          }
        },
        Order: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    })

    console.log('[SELLERS_FINANCIAL] 📊 Clientes encontrados:', customers.length)
    if (customers.length > 0) {
      console.log('[SELLERS_FINANCIAL] 👥 Primeiros 3 clientes:', customers.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        city: c.city,
        sellerId: c.sellerId
      })))
    }

    // Helper function to get START of current day in Brasília timezone
    function getBrasiliaToday() {
      const now = new Date()
      // Subtrair 3 horas para obter horário de Brasília (UTC-3)
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
      
      // Pegar ano, mês e dia em horário de Brasília
      const year = brasiliaTime.getUTCFullYear()
      const month = brasiliaTime.getUTCMonth()
      const day = brasiliaTime.getUTCDate()
      
      // Criar data UTC para 00:00 do dia ATUAL em Brasília
      // (00:00 Brasília = 03:00 UTC)
      const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      return todayStart
    }
    
    const brasiliaToday = getBrasiliaToday()
    
    // Função auxiliar para traduzir status de inglês para português
    function translateStatus(status: string, dueDate: Date): string {
      const dueDateObj = new Date(dueDate)
      
      // Normalizar para início do dia
      const dueDateDay = new Date(Date.UTC(
        dueDateObj.getUTCFullYear(),
        dueDateObj.getUTCMonth(), 
        dueDateObj.getUTCDate(),
        0, 0, 0, 0
      ))
      
      // Se está PENDING mas venceu (data anterior ao dia de hoje), é ATRASADO
      if (status === 'PENDING' && dueDateDay < brasiliaToday) {
        return 'ATRASADO'
      }
      
      // Traduções padrão
      const translations: { [key: string]: string } = {
        'PENDING': 'PENDENTE',
        'OVERDUE': 'ATRASADO',
        'PAID': 'PAGO',
        'CANCELLED': 'CANCELADO'
      }
      
      return translations[status] || status
    }
    
    // Processar dados dos clientes
    const customersFinancial = customers.map((customer: any) => {
      const openBoletos = customer.Boleto.filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE')
      // Um boleto só está vencido se a data de vencimento for ANTERIOR ao dia de hoje
      const overdueBoletos = customer.Boleto.filter((b: any) => {
        const boletoDate = new Date(b.dueDate)
        // Normalizar para início do dia
        const boletoDay = new Date(Date.UTC(
          boletoDate.getUTCFullYear(),
          boletoDate.getUTCMonth(), 
          boletoDate.getUTCDate(),
          0, 0, 0, 0
        ))
        // Considera vencido APENAS se for ANTERIOR ao dia de hoje
        // OU se já estava marcado como OVERDUE e ainda é anterior a hoje
        return (b.status === 'OVERDUE' || b.status === 'PENDING') && boletoDay < brasiliaToday
      })
      
      // Processar receivables (contas a receber)
      // ⚠️ IMPORTANTE: Não contar receivables que já têm boletoId, pois eles já são representados pelo boleto
      const openReceivables = customer.Receivable.filter((r: any) => 
        (r.status === 'PENDING' || r.status === 'OVERDUE') && 
        !r.boletoId  // <-- Ignora receivables vinculados a boletos para evitar duplicidade
      )
      const overdueReceivables = customer.Receivable.filter((r: any) => {
        if (r.boletoId) return false  // <-- Ignora receivables vinculados a boletos
        
        const receivableDate = new Date(r.dueDate)
        const receivableDay = new Date(Date.UTC(
          receivableDate.getUTCFullYear(),
          receivableDate.getUTCMonth(), 
          receivableDate.getUTCDate(),
          0, 0, 0, 0
        ))
        return (r.status === 'OVERDUE' || r.status === 'PENDING') && receivableDay < brasiliaToday
      })
      
      // 🔥 CORREÇÃO: Total em Débito deve mostrar APENAS valores ATRASADOS, não todos os pendentes
      const totalDebt = overdueBoletos.reduce((sum: number, b: any) => sum + b.amount, 0) +
                        overdueReceivables.reduce((sum: number, r: any) => sum + r.amount, 0)
      
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
          dueDate: boleto.dueDate.toISOString(),
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
          dueDate: receivable.dueDate.toISOString(),
          paymentDate: receivable.paymentDate?.toISOString() || null,
          status: translatedStatus,  // ✅ Status já traduzido
          paymentMethod: receivable.paymentMethod,
          installmentInfo,
          boletoId: receivable.boletoId || null
        }
      })

      return {
        id: customer.id,
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
        phone: customer.phone,
        city: customer.city,
        creditLimit: customer.creditLimit,
        availableCredit: customer.availableCredit,
        isActive: customer.isActive,
        totalDebt,
        overdueBoletos: overdueBoletos.length + overdueReceivables.length,
        openBoletos: openBoletos.length + openReceivables.length,
        lastOrderDate: customer.Order[0]?.createdAt?.toISOString() || null,
        boletos,
        receivables
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
    
    console.log('[SELLERS_FINANCIAL] ✅ Retornando dados:', {
      totalCustomers: customers.length,
      customersProcessed: customersFinancial.length,
      summary: {
        totalCustomers: customers.length,
        customersOverdue: customersFinancial.filter((c: any) => c.overdueBoletos > 0).length,
        customersBlocked: customersBlocked,
        totalDebt: customersFinancial.reduce((sum: number, c: any) => sum + c.totalDebt, 0)
      }
    })

    return NextResponse.json({
      customers: customersFinancial,
      summary: {
        totalCustomers: customers.length,
        customersOverdue: customersFinancial.filter((c: any) => c.overdueBoletos > 0).length,
        customersBlocked: customersBlocked,
        totalDebt: customersFinancial.reduce((sum: number, c: any) => sum + c.totalDebt, 0)
      }
    })
  } catch (error) {
    console.error('[SELLERS_FINANCIAL] ❌ ERRO:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados financeiros' },
      { status: 500 }
    )
  }
}
