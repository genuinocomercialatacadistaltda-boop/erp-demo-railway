
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AdminDashboard } from './_components/admin-dashboard'

// =====================================================================
// 🔧 MAPEAMENTO DE CATEGORIAS PARA GRUPOS
// IDs das categorias do banco de dados
// =====================================================================
const CATEGORY_GROUPS = {
  // Despesas Operacionais - todas as despesas do dia-a-dia
  OPERATIONAL: [
    'cmhxvxf8m001jo308ihr1902m', // assinaturas e serviços
    'cmhnbojsa000btom6sonq6fcf', // Diversos
    'cmhyz9jik0000slntjys8ey2t', // Taxa de Cartão
    'cmhnbojrj0000tom6b7yge8hj', // Aluguel
    'cmhnbojro0002tom6fcsn7iuo', // Salários
    'cmhnbojrr0003tom6bxmhrih6', // Luz/Água/Gás
    'cmhnbojru0004tom6m2lnri05', // Internet/Telefone
    'cmhnbojrx0005tom6i6702z38', // Marketing
    'cmhnbojs00006tom6hwkq1mt3', // Manutenção
    'cmhnbojs20007tom6gac9f7de', // Impostos
    'cmhnbojs50008tom6bymg2qza', // Transporte
    'cmhnbojs70009tom61zvv0c62', // Material de Limpeza
    'cmhnwimv90008o3084ribnyt8', // alimentaçao
    'cmjxgwer70000p8087nfzln4e', // contabilidade
    'cmk19me460059mj08iy5v9z9v', // materiais escritorios
    'cmk1j6kvz001fsa085uovy9z0', // TAXA BOLETOS
    'cmi8xwusd000bn308sq2c5720', // beneficios Funcionários
    'cmi0ro9kp0000t9084jrkp1rc', // funcionarios
    'cmhnbojrm0001tom6feae7g8d', // Fornecedores
  ],
  // Despesas com Produtos
  PRODUCTS: [
    'cmht2f9xs0000oa087yen9lzq', // embalagens
    'cmht2fkmg0001oa08ixr4de2w', // temperos
  ],
  // Investimentos
  INVESTMENT: [
    'cmhyw8drs000jpb09tiiiqq79', // investimento
    'cmhnbojs9000atom6sf90nwvi', // Equipamentos
  ],
  // Pró-labore
  PROLABORE: [
    'cmhtb0k5f00001v0vr94ffm2f', // prolabore
  ],
  // Compras de Mercadoria
  PURCHASES: [
    'cmhqac6f60000qp08jjqpx1lb', // Compra de Mercadoria
  ],
}

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  console.log("🟦 [ADMIN PAGE] Iniciando carregamento da página")
  
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    console.log("🟦 [ADMIN PAGE] Session:", session ? "Existe" : "Não existe")
    console.log("🟦 [ADMIN PAGE] UserType:", user?.userType)

    if (!session || user?.userType !== 'ADMIN') {
      console.log("⚠️ [ADMIN PAGE] Redirecionando para login - não autorizado")
      redirect('/auth/login')
    }

    console.log("🟦 [ADMIN PAGE] Buscando estatísticas do dashboard...")
    
    // Get dashboard statistics
    const [
      totalCustomers,
      totalProducts,
      totalOrders,
      pendingOrders
    ] = await Promise.all([
    // Total customers
    prisma.customer.count(),
    
    // Total products
    prisma.product.count({
      where: { isActive: true }
    }),
    
    // Total orders
    prisma.order.count(),
    
    // Pending orders
    prisma.order.count({
      where: { status: 'PENDING' }
    })
  ])

  console.log("✅ [ADMIN PAGE] Estatísticas básicas carregadas")
  
  // Helper function to get dates in Brasília timezone (UTC-3)
  // Returns UTC dates that represent specific times in Brasília
  function getBrasiliaDate() {
    // Get current UTC time
    const now = new Date()
    // Brasília is UTC-3, so subtract 3 hours to get local time
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    return brasiliaTime
  }

  function getBrasiliaDayStart() {
    // Get current Brasília time
    const now = new Date()
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    
    // Get year, month, day in Brasília
    const year = brasiliaTime.getUTCFullYear()
    const month = brasiliaTime.getUTCMonth()
    const day = brasiliaTime.getUTCDate()
    
    // Create UTC date for 00:00 UTC (deliveryDate está salvo em UTC puro)
    const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
    return dayStart
  }

  function getBrasiliaDayEnd() {
    // Get current Brasília time
    const now = new Date()
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    
    // Get year, month, day in Brasília
    const year = brasiliaTime.getUTCFullYear()
    const month = brasiliaTime.getUTCMonth()
    const day = brasiliaTime.getUTCDate()
    
    // Create UTC date for 00:00 UTC of NEXT day
    const dayEnd = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0))
    return dayEnd
  }

  function getBrasiliaMonthStart() {
    // Get current Brasília time
    const now = new Date()
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    
    // Get year, month in Brasília
    const year = brasiliaTime.getUTCFullYear()
    const month = brasiliaTime.getUTCMonth()
    
    // Create UTC date for first day of month at 00:00 UTC
    const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
    return monthStart
  }

  function getBrasiliaMonthEnd() {
    // Get current Brasília time
    const now = new Date()
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    
    // Get year, month in Brasília
    const year = brasiliaTime.getUTCFullYear()
    const month = brasiliaTime.getUTCMonth()
    
    // Create UTC date for first day of NEXT month at 00:00 UTC
    const monthEnd = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0))
    return monthEnd
  }

  // Calculate revenue metrics using Brasília timezone
  const today = getBrasiliaDayStart()
  const tomorrow = getBrasiliaDayEnd()
  const firstDayOfMonth = getBrasiliaMonthStart()
  const firstDayOfNextMonth = getBrasiliaMonthEnd()
  
  const currentBrasiliaTime = getBrasiliaDate()
  console.log("🕐 [TIMEZONE] Hora atual de Brasília:", currentBrasiliaTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))
  console.log("🕐 [TIMEZONE] Hora atual UTC:", new Date().toISOString())
  console.log("🟦 [ADMIN PAGE] Período - Hoje (início):", today.toISOString())
  console.log("🟦 [ADMIN PAGE] Período - Amanhã (início):", tomorrow.toISOString())
  console.log("🟦 [ADMIN PAGE] Período - Primeiro dia do mês:", firstDayOfMonth.toISOString())
  console.log("🟦 [ADMIN PAGE] Período - Próximo mês (início):", firstDayOfNextMonth.toISOString())
  
  // ⚡ OTIMIZAÇÃO: Agrupar TODAS as queries em um único Promise.all para execução paralela
  console.log("🟦 [ADMIN PAGE] Buscando TODAS as estatísticas em paralelo...")
  const [
    // Counts básicos
    deliveredOrdersToday,
    deliveredOrdersThisMonth,
    customersThisMonth,
    customersLastMonth,
    productsThisMonth,
    productsLastMonth,
    
    // Revenue
    dailyRevenue,
    monthlyRevenue,
    dailyNetRevenue,
    monthlyNetRevenue,
    
    // All Expenses (to be filtered by competence)
    allExpenses,
    
    // Operational Expenses (credit card only)
    dailyOperationalCreditCardExpenses,
    monthlyOperationalCreditCardExpenses,
    
    // Product Expenses (credit card only)
    dailyProductCreditCardExpenses,
    monthlyProductCreditCardExpenses,
    
    // Purchases (placeholder)
    dailyPurchases,
    dailyRawMaterialsExpenses,
    monthlyPurchases,
    monthlyRawMaterialsExpenses,
    
    // Investments (credit card only)
    dailyInvestmentsCreditCard,
    monthlyInvestmentsCreditCard,
    
    // Prolabore (credit card only)
    dailyProLaboreCreditCard,
    monthlyProLaboreCreditCard
  ] = await Promise.all([
    // ===== COUNTS BÁSICOS =====
    // Delivered orders today
    prisma.order.count({
      where: {
        status: 'DELIVERED',
        deliveryDate: { gte: today, lt: tomorrow }
      }
    }),
    
    // Delivered orders this month
    prisma.order.count({
      where: {
        status: 'DELIVERED',
        deliveryDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // Customers created this month
    prisma.customer.count({
      where: {
        createdAt: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // Customers created last month
    prisma.customer.count({
      where: {
        createdAt: {
          gte: new Date(firstDayOfMonth.getTime() - (30 * 24 * 60 * 60 * 1000)),
          lt: firstDayOfMonth
        }
      }
    }),
    
    // Products created this month
    prisma.product.count({
      where: {
        isActive: true,
        createdAt: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // Products created last month
    prisma.product.count({
      where: {
        isActive: true,
        createdAt: {
          gte: new Date(firstDayOfMonth.getTime() - (30 * 24 * 60 * 60 * 1000)),
          lt: firstDayOfMonth
        }
      }
    }),
    
    // ===== REVENUE =====
    // Daily revenue
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: today, lt: tomorrow }
      }
    }),
    
    // Monthly revenue
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // Daily net revenue (receivables paid)
    prisma.receivable.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        paymentDate: { gte: today, lt: tomorrow }
      }
    }),
    
    // Monthly net revenue (receivables paid)
    prisma.receivable.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        paymentDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // =====================================================================
    // 🔧 CORREÇÃO: Buscar TODAS as expenses para filtrar por competência
    // =====================================================================
    // Buscar todas as expenses (serão filtradas manualmente por competência)
    prisma.expense.findMany({
      select: {
        amount: true,
        feeAmount: true,
        categoryId: true,
        competenceDate: true,
        paymentDate: true,
        dueDate: true,
        Purchase: {
          select: { purchaseDate: true }
        }
      }
    }),
    
    // ===== DESPESAS OPERACIONAIS (credit card) =====
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.OPERATIONAL },
        purchaseDate: { gte: today, lt: tomorrow }
      }
    }),
    
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.OPERATIONAL },
        purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // ===== DESPESAS COM PRODUTOS (credit card) =====
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.PRODUCTS },
        purchaseDate: { gte: today, lt: tomorrow }
      }
    }),
    
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.PRODUCTS },
        purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // ===== COMPRAS DE MERCADORIA =====
    // Placeholder (calculado separadamente)
    Promise.resolve({ _sum: { totalAmount: 0 } }),
    Promise.resolve({ _sum: { amount: 0 } }),
    Promise.resolve({ _sum: { totalAmount: 0 } }),
    Promise.resolve({ _sum: { amount: 0 } }),
    
    // ===== INVESTIMENTOS (credit card) =====
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.INVESTMENT },
        purchaseDate: { gte: today, lt: tomorrow }
      }
    }),
    
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.INVESTMENT },
        purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    }),
    
    // ===== PRÓ-LABORE (credit card) =====
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.PROLABORE },
        purchaseDate: { gte: today, lt: tomorrow }
      }
    }),
    
    prisma.creditCardExpense.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: { in: CATEGORY_GROUPS.PROLABORE },
        purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
      }
    })
  ])
  
  console.log("✅ [ADMIN PAGE] TODAS as estatísticas carregadas em PARALELO!")

  // 🔧 FILTRAR EXPENSES POR COMPETÊNCIA (mesma lógica do /api/financial/dashboard)
  console.log("🔍 [ADMIN PAGE] Filtrando expenses por COMPETÊNCIA");
  
  const getCompetenceDate = (expense: any): Date | null => {
    if (expense.competenceDate) {
      return new Date(expense.competenceDate);
    } else if (expense.Purchase?.purchaseDate) {
      return new Date(expense.Purchase.purchaseDate);
    } else if (expense.paymentDate) {
      return new Date(expense.paymentDate);
    } else if (expense.dueDate) {
      return new Date(expense.dueDate);
    }
    return null;
  };

  // Filtrar por categoria e período
  const filterExpenses = (expenses: any[], categoryIds: string[], start: Date, end: Date) => {
    return expenses.filter(exp => {
      if (!categoryIds.includes(exp.categoryId || '')) return false;
      const compDate = getCompetenceDate(exp);
      return compDate && compDate >= start && compDate < end;
    });
  };

  // Operational
  const dailyOperationalExpenses = filterExpenses(allExpenses, CATEGORY_GROUPS.OPERATIONAL, today, tomorrow);
  const monthlyOperationalExpenses = filterExpenses(allExpenses, CATEGORY_GROUPS.OPERATIONAL, firstDayOfMonth, firstDayOfNextMonth);
  
  // Products
  const dailyProductExpenses = filterExpenses(allExpenses, CATEGORY_GROUPS.PRODUCTS, today, tomorrow);
  const monthlyProductExpenses = filterExpenses(allExpenses, CATEGORY_GROUPS.PRODUCTS, firstDayOfMonth, firstDayOfNextMonth);
  
  // Investments
  const dailyInvestments = filterExpenses(allExpenses, CATEGORY_GROUPS.INVESTMENT, today, tomorrow);
  const monthlyInvestments = filterExpenses(allExpenses, CATEGORY_GROUPS.INVESTMENT, firstDayOfMonth, firstDayOfNextMonth);
  
  // Prolabore
  const dailyProlabore = filterExpenses(allExpenses, CATEGORY_GROUPS.PROLABORE, today, tomorrow);
  const monthlyProlabore = filterExpenses(allExpenses, CATEGORY_GROUPS.PROLABORE, firstDayOfMonth, firstDayOfNextMonth);

  console.log("✅ [ADMIN PAGE] Expenses filtrados por COMPETÊNCIA!")

  // =====================================================================
  // 🔧 LÓGICA UNIFICADA para "Compras de Mercadoria": Por CATEGORIA
  // Mesma lógica do Dashboard - tudo que tem categoria "Compra de Mercadoria" é compra
  // =====================================================================
  // 🔧 CORREÇÃO: Usar mesma lógica do Dashboard Financeiro (competência)
  // =====================================================================
  const compraMercadoriaCategory = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Compra de Mercadoria' } }
  });

  let dailyPurchasesByCategory = 0;
  let monthlyPurchasesByCategory = 0;

  if (compraMercadoriaCategory) {
    console.log("🔍 [ADMIN PAGE] Buscando Compras de Mercadoria por COMPETÊNCIA");
    
    // 🔧 Buscar TODOS os expenses com categoria para filtrar por competência
    const allExpensesCat = await prisma.expense.findMany({
      where: {
        categoryId: compraMercadoriaCategory.id
      },
      select: {
        amount: true,
        feeAmount: true,
        competenceDate: true,
        paymentDate: true,
        dueDate: true,
        Purchase: {
          select: { purchaseDate: true }
        }
      }
    });

    // 🔧 Filtrar por competência (mesma lógica do /api/financial/dashboard)
    const dailyExpensesCat = allExpensesCat.filter(expense => {
      let competenceDate: Date | null = null;
      if (expense.competenceDate) {
        competenceDate = new Date(expense.competenceDate);
      } else if (expense.Purchase?.purchaseDate) {
        competenceDate = new Date(expense.Purchase.purchaseDate);
      } else if (expense.paymentDate) {
        competenceDate = new Date(expense.paymentDate);
      } else if (expense.dueDate) {
        competenceDate = new Date(expense.dueDate);
      }
      return competenceDate && competenceDate >= today && competenceDate < tomorrow;
    });

    const monthlyExpensesCat = allExpensesCat.filter(expense => {
      let competenceDate: Date | null = null;
      if (expense.competenceDate) {
        competenceDate = new Date(expense.competenceDate);
      } else if (expense.Purchase?.purchaseDate) {
        competenceDate = new Date(expense.Purchase.purchaseDate);
      } else if (expense.paymentDate) {
        competenceDate = new Date(expense.paymentDate);
      } else if (expense.dueDate) {
        competenceDate = new Date(expense.dueDate);
      }
      return competenceDate && competenceDate >= firstDayOfMonth && competenceDate < firstDayOfNextMonth;
    });

    // Credit Card Expenses (por purchaseDate - mantém lógica original)
    const [
      dailyCCCat,
      monthlyCCCat,
      dailyPurchasesNoCat,
      monthlyPurchasesNoCat
    ] = await Promise.all([
      // Daily - CreditCard com categoria
      prisma.creditCardExpense.aggregate({
        where: {
          categoryId: compraMercadoriaCategory.id,
          purchaseDate: { gte: today, lt: tomorrow }
        },
        _sum: { amount: true }
      }),
      // Monthly - CreditCard com categoria
      prisma.creditCardExpense.aggregate({
        where: {
          categoryId: compraMercadoriaCategory.id,
          purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
        },
        _sum: { amount: true }
      }),
      // Daily - Purchases SEM Expense E SEM Cartão (para não duplicar)
      prisma.purchase.aggregate({
        where: {
          customerId: null,
          purchaseDate: { gte: today, lt: tomorrow },
          expenseId: null,
          NOT: {
            paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
          }
        },
        _sum: { totalAmount: true }
      }),
      // Monthly - Purchases SEM Expense E SEM Cartão (para não duplicar)
      prisma.purchase.aggregate({
        where: {
          customerId: null,
          purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          expenseId: null,
          NOT: {
            paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
          }
        },
        _sum: { totalAmount: true }
      })
    ]);

    // Calcular totais
    const dailyExpensesTotal = dailyExpensesCat.reduce((sum, e) => 
      sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
    );
    const monthlyExpensesTotal = monthlyExpensesCat.reduce((sum, e) => 
      sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
    );

    dailyPurchasesByCategory = 
      dailyExpensesTotal + 
      Number(dailyCCCat._sum?.amount || 0) + 
      Number(dailyPurchasesNoCat._sum?.totalAmount || 0);

    monthlyPurchasesByCategory = 
      monthlyExpensesTotal + 
      Number(monthlyCCCat._sum?.amount || 0) + 
      Number(monthlyPurchasesNoCat._sum?.totalAmount || 0);

    console.log("🔍 [ADMIN PAGE] Compras de Mercadoria (por COMPETÊNCIA):");
    console.log("   Daily:", dailyPurchasesByCategory);
    console.log("   Monthly:", monthlyPurchasesByCategory);
  }

  // =====================================================================
  // 🔧 Calcular totais das despesas filtradas por competência
  // =====================================================================
  const sumExpenses = (expenses: any[]) => 
    expenses.reduce((sum, e) => sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0);

  const dailyOpTotal = sumExpenses(dailyOperationalExpenses) + Number(dailyOperationalCreditCardExpenses._sum?.amount || 0);
  const monthlyOpTotal = sumExpenses(monthlyOperationalExpenses) + Number(monthlyOperationalCreditCardExpenses._sum?.amount || 0);
  
  const dailyProdTotal = sumExpenses(dailyProductExpenses) + Number(dailyProductCreditCardExpenses._sum?.amount || 0);
  const monthlyProdTotal = sumExpenses(monthlyProductExpenses) + Number(monthlyProductCreditCardExpenses._sum?.amount || 0);
  
  const dailyInvTotal = sumExpenses(dailyInvestments) + Number(dailyInvestmentsCreditCard._sum?.amount || 0);
  const monthlyInvTotal = sumExpenses(monthlyInvestments) + Number(monthlyInvestmentsCreditCard._sum?.amount || 0);
  
  const dailyProlTotal = sumExpenses(dailyProlabore) + Number(dailyProLaboreCreditCard._sum?.amount || 0);
  const monthlyProlTotal = sumExpenses(monthlyProlabore) + Number(monthlyProLaboreCreditCard._sum?.amount || 0);

  console.log("💰 [ADMIN PAGE] TOTAIS POR COMPETÊNCIA:");
  console.log("   Desp. Operacionais Mensal:", monthlyOpTotal);
  console.log("   Desp. com Produtos Mensal:", monthlyProdTotal);
  console.log("   Compras Mercadorias Mensal:", monthlyPurchasesByCategory);
  console.log("   Investimentos Mensal:", monthlyInvTotal);
  console.log("   Pró-labore Mensal:", monthlyProlTotal);

  const stats = {
    // TOTAIS ACUMULADOS
    totalCustomers,
    totalProducts,
    pendingOrders,
    
    // NOVOS CADASTROS NO MÊS (com tendência)
    customersThisMonth,
    customersLastMonth,
    productsThisMonth,
    productsLastMonth,
    
    // PEDIDOS ENTREGUES
    deliveredOrdersToday,
    deliveredOrdersThisMonth,
    
    dailyRevenue: Number(dailyRevenue._sum?.total || 0),
    monthlyRevenue: Number(monthlyRevenue._sum?.total || 0),
    // Receita Líquida (Receivables pagos)
    dailyNetRevenue: Number(dailyNetRevenue._sum?.amount || 0),
    monthlyNetRevenue: Number(monthlyNetRevenue._sum?.amount || 0),
    // Despesas Operacionais (por categoria - unificado com Dashboard)
    dailyOperationalExpenses: dailyOpTotal,
    monthlyOperationalExpenses: monthlyOpTotal,
    // Despesas com Produtos (por categoria - unificado com Dashboard)
    dailyProductExpenses: dailyProdTotal,
    monthlyProductExpenses: monthlyProdTotal,
    // Compras de Mercadorias (por categoria - unificado com Dashboard)
    dailyPurchases: dailyPurchasesByCategory,
    monthlyPurchases: monthlyPurchasesByCategory,
    // Investimentos (por categoria - unificado com Dashboard)
    dailyInvestments: dailyInvTotal,
    monthlyInvestments: monthlyInvTotal,
    // Pró-labore (por categoria - unificado com Dashboard)
    dailyProlabore: dailyProlTotal,
    monthlyProlabore: monthlyProlTotal,
    // TOTAIS DE SAÍDAS (tudo que saiu)
    dailyTotalExpenses: dailyOpTotal + dailyProdTotal + dailyPurchasesByCategory + dailyInvTotal + dailyProlTotal,
    monthlyTotalExpenses: monthlyOpTotal + monthlyProdTotal + monthlyPurchasesByCategory + monthlyInvTotal + monthlyProlTotal
  }

  console.log("✅ [ADMIN PAGE] Todos os dados carregados com sucesso")
  console.log("🟦 [ADMIN PAGE] Stats finais:", JSON.stringify(stats, null, 2))

  return (
    <AdminDashboard 
      stats={stats}
      userName={user.name}
    />
  )
  } catch (error: any) {
    console.error("❌ [ADMIN PAGE] ERRO COMPLETO:", error)
    console.error("❌ [ADMIN PAGE] STACK:", error.stack)
    console.error("❌ [ADMIN PAGE] MESSAGE:", error.message)
    console.error("❌ [ADMIN PAGE] NAME:", error.name)
    
    // Re-throw para que o Next.js mostre a página de erro
    throw new Error(`Erro ao carregar página do admin: ${error.message}`)
  }
}
