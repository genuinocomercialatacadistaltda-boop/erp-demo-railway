import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// =====================================================================
// 🔧 FUNÇÃO PARA DETERMINAR DATA DE COMPETÊNCIA (MESMA DO MONTHLY-SUMMARY)
// =====================================================================
function getCompetenceDate(exp: any): Date | null {
  if (exp.competenceDate) {
    return new Date(exp.competenceDate);
  } else if (exp.Purchase?.purchaseDate) {
    return new Date(exp.Purchase.purchaseDate);
  } else if (exp.status === 'PAID' && exp.paymentDate) {
    return new Date(exp.paymentDate);
  } else if (exp.dueDate) {
    return new Date(exp.dueDate);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const month = searchParams.get('month')
    
    console.log('🔍 [EXPENSES/TOTAL] Parâmetros recebidos:', { date, month })

    if (!date && !month) {
      return NextResponse.json({ error: 'Data ou mês é obrigatório' }, { status: 400 })
    }

    let startDate: Date
    let endDate: Date

    if (date) {
      startDate = new Date(date + 'T00:00:00.000Z')
      endDate = new Date(date + 'T23:59:59.999Z')
    } else if (month) {
      const [year, monthNum] = month.split('-')
      startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`)
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate()
      endDate = new Date(`${year}-${monthNum}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`)
    } else {
      return NextResponse.json({ error: 'Filtro inválido' }, { status: 400 })
    }

    console.log('🔍 [EXPENSES/TOTAL] Período:', startDate.toISOString(), 'até', endDate.toISOString())

    // =====================================================================
    // 🔧 LÓGICA UNIFICADA COM MONTHLY-SUMMARY: usa expenseType + competência
    // =====================================================================

    // Buscar TODAS as despesas e filtrar por competência
    const allExpenses = await prisma.expense.findMany({
      include: { 
        Category: true,
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência
    const filterByCompetence = (exp: any) => {
      const compDate = getCompetenceDate(exp);
      return compDate && compDate >= startDate && compDate <= endDate;
    }

    // ===== DESPESAS OPERACIONAIS =====
    const operationalExpenses = allExpenses.filter((exp: any) => 
      exp.expenseType === 'OPERATIONAL' && filterByCompetence(exp)
    )
    const operationalCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'OPERATIONAL',
        purchaseDate: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })
    const totalOperational = operationalExpenses.reduce((acc: number, exp: any) => acc + exp.amount + (exp.feeAmount || 0), 0) + (operationalCC._sum.amount || 0)

    // ===== DESPESAS COM PRODUTOS =====
    const productExpenses = allExpenses.filter((exp: any) => 
      exp.expenseType === 'PRODUCTS' && filterByCompetence(exp)
    )
    const productCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'PRODUCTS',
        purchaseDate: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })
    const totalProducts = productExpenses.reduce((acc: number, exp: any) => acc + exp.amount + (exp.feeAmount || 0), 0) + (productCC._sum.amount || 0)

    // ===== INVESTIMENTOS =====
    const investments = allExpenses.filter((exp: any) => 
      exp.expenseType === 'INVESTMENT' && filterByCompetence(exp)
    )
    const investmentCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'INVESTMENT',
        purchaseDate: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })
    const totalInvestments = investments.reduce((acc: number, exp: any) => acc + exp.amount + (exp.feeAmount || 0), 0) + (investmentCC._sum.amount || 0)

    // ===== PRÓ-LABORE =====
    const prolabore = allExpenses.filter((exp: any) => 
      exp.expenseType === 'PROLABORE' && filterByCompetence(exp)
    )
    const prolaboreCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'PROLABORE',
        purchaseDate: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })
    const totalProlabore = prolabore.reduce((acc: number, exp: any) => acc + exp.amount + (exp.feeAmount || 0), 0) + (prolaboreCC._sum.amount || 0)

    // ===== COMPRAS DE MERCADORIA =====
    const purchaseExpenses = allExpenses.filter((exp: any) => 
      exp.expenseType === 'RAW_MATERIALS' && filterByCompetence(exp)
    )
    const purchaseCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'RAW_MATERIALS',
        purchaseDate: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })
    // Compras SEM Expense e SEM cartão (para não duplicar)
    const purchasesWithoutExpense = await prisma.purchase.aggregate({
      where: {
        customerId: null,
        purchaseDate: { gte: startDate, lte: endDate },
        expenseId: null,
        NOT: {
          paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
        }
      },
      _sum: { totalAmount: true }
    })
    const totalPurchases = 
      purchaseExpenses.reduce((acc: number, exp: any) => acc + exp.amount + (exp.feeAmount || 0), 0) + 
      (purchaseCC._sum.amount || 0) + 
      (purchasesWithoutExpense._sum.totalAmount || 0)

    const totalExpenses = totalOperational + totalProducts + totalPurchases + totalInvestments + totalProlabore

    console.log('🔍 [EXPENSES/TOTAL] Totais calculados:')
    console.log('   Operacional:', totalOperational.toFixed(2))
    console.log('   Produtos:', totalProducts.toFixed(2))
    console.log('   Compras:', totalPurchases.toFixed(2))
    console.log('   Investimentos:', totalInvestments.toFixed(2))
    console.log('   Pró-labore:', totalProlabore.toFixed(2))
    console.log('   TOTAL:', totalExpenses.toFixed(2))

    return NextResponse.json({
      period: date || month,
      operationalExpenses: {
        list: operationalExpenses,
        total: totalOperational,
      },
      productExpenses: {
        list: productExpenses,
        total: totalProducts,
      },
      purchases: {
        list: purchaseExpenses,
        total: totalPurchases,
      },
      investments: {
        list: investments,
        total: totalInvestments,
      },
      prolabore: {
        list: prolabore,
        total: totalProlabore,
      },
      summary: {
        totalOperational,
        totalProducts,
        totalPurchases,
        totalInvestments,
        totalProlabore,
        totalExpenses,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (error) {
    console.error('Erro ao buscar total de despesas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
