import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

// 🔧 Função para obter data de competência (mesma do expenses/total)
function getCompetenceDate(expense: any): Date | null {
  if (expense.competenceDate) {
    return new Date(expense.competenceDate);
  } else if (expense.Purchase?.purchaseDate) {
    return new Date(expense.Purchase.purchaseDate);
  } else if (expense.status === 'PAID' && expense.paymentDate) {
    return new Date(expense.paymentDate);
  } else if (expense.dueDate) {
    return new Date(expense.dueDate);
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
    const filterType = searchParams.get('type')
    const filterDate = searchParams.get('date')
    const filterMonth = searchParams.get('month')

    console.log("🟦 [DASHBOARD FILTERED v3] Tipo de filtro:", filterType)
    console.log("🟦 [DASHBOARD FILTERED v3] Data:", filterDate)
    console.log("🟦 [DASHBOARD FILTERED v3] Mês:", filterMonth)

    let startDate: Date
    let endDate: Date

    if (filterType === 'daily' && filterDate) {
      const [year, month, day] = filterDate.split('-').map(Number)
      startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))
    } else if (filterType === 'monthly' && filterMonth) {
      const [year, month] = filterMonth.split('-').map(Number)
      startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
    } else {
      return NextResponse.json({ error: 'Parâmetros de filtro inválidos' }, { status: 400 })
    }

    console.log("🟦 [DASHBOARD FILTERED v3] Período:", startDate.toISOString(), "até", endDate.toISOString())

    // =====================================================================
    // 🔧 LÓGICA CORRIGIDA: Usa expenseType (igual expenses/total/route.ts)
    // =====================================================================

    // Buscar TODAS as expenses com Purchase para obter data de competência
    const allExpenses = await prisma.expense.findMany({
      include: {
        Purchase: { select: { purchaseDate: true } }
      }
    });

    // Filtrar por competência
    const filterByCompetence = (exp: any) => {
      const compDate = getCompetenceDate(exp);
      return compDate && compDate >= startDate && compDate < endDate;
    };

    // ===== DESPESAS OPERACIONAIS =====
    const operationalExpenses = allExpenses.filter((exp: any) => 
      exp.expenseType === 'OPERATIONAL' && filterByCompetence(exp)
    );
    const operationalCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'OPERATIONAL',
        purchaseDate: { gte: startDate, lt: endDate }
      },
      _sum: { amount: true }
    });
    const totalOperational = operationalExpenses.reduce((acc: number, exp: any) => acc + Number(exp.amount || 0) + Number(exp.feeAmount || 0), 0) + Number(operationalCC._sum?.amount || 0);

    // ===== DESPESAS COM PRODUTOS =====
    const productExpenses = allExpenses.filter((exp: any) => 
      exp.expenseType === 'PRODUCTS' && filterByCompetence(exp)
    );
    const productCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'PRODUCTS',
        purchaseDate: { gte: startDate, lt: endDate }
      },
      _sum: { amount: true }
    });
    const totalProducts = productExpenses.reduce((acc: number, exp: any) => acc + Number(exp.amount || 0) + Number(exp.feeAmount || 0), 0) + Number(productCC._sum?.amount || 0);

    // ===== INVESTIMENTOS =====
    const investments = allExpenses.filter((exp: any) => 
      exp.expenseType === 'INVESTMENT' && filterByCompetence(exp)
    );
    const investmentCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'INVESTMENT',
        purchaseDate: { gte: startDate, lt: endDate }
      },
      _sum: { amount: true }
    });
    const totalInvestments = investments.reduce((acc: number, exp: any) => acc + Number(exp.amount || 0) + Number(exp.feeAmount || 0), 0) + Number(investmentCC._sum?.amount || 0);

    // ===== PRÓ-LABORE =====
    const prolabore = allExpenses.filter((exp: any) => 
      exp.expenseType === 'PROLABORE' && filterByCompetence(exp)
    );
    const prolaboreCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'PROLABORE',
        purchaseDate: { gte: startDate, lt: endDate }
      },
      _sum: { amount: true }
    });
    const totalProlabore = prolabore.reduce((acc: number, exp: any) => acc + Number(exp.amount || 0) + Number(exp.feeAmount || 0), 0) + Number(prolaboreCC._sum?.amount || 0);

    // ===== COMPRAS DE MERCADORIA =====
    const purchaseExpenses = allExpenses.filter((exp: any) => 
      exp.expenseType === 'RAW_MATERIALS' && filterByCompetence(exp)
    );
    const purchaseCC = await prisma.creditCardExpense.aggregate({
      where: {
        expenseType: 'RAW_MATERIALS',
        purchaseDate: { gte: startDate, lt: endDate }
      },
      _sum: { amount: true }
    });
    // Compras SEM Expense e SEM cartão (para não duplicar)
    const purchasesWithoutExpense = await prisma.purchase.aggregate({
      where: {
        customerId: null,
        purchaseDate: { gte: startDate, lt: endDate },
        expenseId: null,
        NOT: {
          paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
        }
      },
      _sum: { totalAmount: true }
    });
    const totalPurchases = purchaseExpenses.reduce((acc: number, exp: any) => acc + Number(exp.amount || 0) + Number(exp.feeAmount || 0), 0) 
      + Number(purchaseCC._sum?.amount || 0) 
      + Number(purchasesWithoutExpense._sum?.totalAmount || 0);

    // =====================================================================
    // RECEITAS
    // =====================================================================
    const [revenue, netRevenue, deliveredOrders, customersRegistered, productsRegistered] = await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'CANCELLED' },
          createdAt: { gte: startDate, lt: endDate }
        }
      }),
      prisma.receivable.aggregate({
        _sum: { amount: true },
        where: {
          status: 'PAID',
          paymentDate: { gte: startDate, lt: endDate }
        }
      }),
      prisma.order.count({
        where: {
          status: 'DELIVERED',
          deliveryDate: { gte: startDate, lt: endDate }
        }
      }),
      prisma.customer.count({
        where: { createdAt: { gte: startDate, lt: endDate } }
      }),
      prisma.product.count({
        where: { isActive: true, createdAt: { gte: startDate, lt: endDate } }
      })
    ]);

    const data = {
      revenue: Number(revenue._sum?.total || 0),
      netRevenue: Number(netRevenue._sum?.amount || 0),
      operationalExpenses: totalOperational,
      productExpenses: totalProducts,
      purchases: totalPurchases,
      investments: totalInvestments,
      prolabore: totalProlabore,
      deliveredOrders,
      customersRegistered,
      productsRegistered
    }

    console.log("💰 [DASHBOARD FILTERED v3] Totais por expenseType + COMPETÊNCIA:");
    console.log("   Desp. Operacionais:", totalOperational);
    console.log("   Desp. com Produtos:", totalProducts);
    console.log("   Compras Mercadorias:", totalPurchases);
    console.log("   Investimentos:", totalInvestments);
    console.log("   Pró-labore:", totalProlabore);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Timestamp': new Date().toISOString()
      }
    })
  } catch (error: any) {
    console.error("❌ [DASHBOARD FILTERED v3] Erro:", error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados filtrados' },
      { status: 500 }
    )
  }
}
