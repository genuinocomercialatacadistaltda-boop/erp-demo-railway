export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// GET - Dashboard financeiro consolidado
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Definir período padrão (mês atual)
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Buscar todas as contas bancárias com saldos
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });

    const totalBalance = bankAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

    // =====================================================================
    // 🔧 LÓGICA UNIFICADA: Tudo que tem categoria X é categoria X
    // Não importa se é Expense, CreditCardExpense ou Purchase
    // =====================================================================
    
    // 2. Buscar TODAS as despesas por categoria usando COMPETÊNCIA
    // 🔑 REGRA: Usar competenceDate quando disponível, senão purchaseDate da compra vinculada
    const allExpensesRaw = await prisma.expense.findMany({
      include: {
        Purchase: {
          select: { purchaseDate: true }
        },
        Category: {
          select: { id: true, name: true, color: true }
        }
      }
    });

    // Filtrar apenas as que têm categoria
    const allExpenses = allExpensesRaw.filter((e: any) => e.categoryId);

    console.log(`📊 [DASHBOARD] Total de despesas com categoria: ${allExpenses.length}`);

    // Filtrar e agrupar manualmente por categoria usando COMPETÊNCIA
    const expensesMap = new Map<string, { amount: number; feeAmount: number }>();
    
    // 🆕 NOVO: Mapa para agrupar por TIPO DE DESPESA com categorias
    type ExpenseTypeKey = 'OPERATIONAL' | 'PRODUCTS' | 'RAW_MATERIALS' | 'INVESTMENT' | 'PROLABORE' | 'OTHER';
    const expensesByTypeMap: Record<ExpenseTypeKey, { 
      total: number; 
      categories: Map<string, { name: string; color: string; amount: number }> 
    }> = {
      OPERATIONAL: { total: 0, categories: new Map() },
      PRODUCTS: { total: 0, categories: new Map() },
      RAW_MATERIALS: { total: 0, categories: new Map() },
      INVESTMENT: { total: 0, categories: new Map() },
      PROLABORE: { total: 0, categories: new Map() },
      OTHER: { total: 0, categories: new Map() }
    };
    
    allExpenses.forEach((expense: any) => {
      // Determinar data de competência
      let competenceDate: Date | null = null;
      
      if (expense.competenceDate) {
        competenceDate = new Date(expense.competenceDate);
      } else if (expense.Purchase?.purchaseDate) {
        competenceDate = new Date(expense.Purchase.purchaseDate);
      } else if (expense.status === 'PAID' && expense.paymentDate) {
        competenceDate = new Date(expense.paymentDate);
      } else if (expense.dueDate) {
        competenceDate = new Date(expense.dueDate);
      }

      // Filtrar pelo período
      if (competenceDate && competenceDate >= start && competenceDate <= end) {
        const categoryId = expense.categoryId;
        const current = expensesMap.get(categoryId) || { amount: 0, feeAmount: 0 };
        const totalAmount = Number(expense.amount || 0) + Number(expense.feeAmount || 0);
        
        expensesMap.set(categoryId, {
          amount: current.amount + Number(expense.amount || 0),
          feeAmount: current.feeAmount + Number(expense.feeAmount || 0)
        });
        
        // 🆕 Agrupar por tipo de despesa
        const expenseType = (expense.expenseType || 'OTHER') as ExpenseTypeKey;
        const typeData = expensesByTypeMap[expenseType];
        typeData.total += totalAmount;
        
        const categoryName = expense.Category?.name || 'Outros';
        const categoryColor = expense.Category?.color || '#6B7280';
        const existingCat = typeData.categories.get(categoryId);
        if (existingCat) {
          existingCat.amount += totalAmount;
        } else {
          typeData.categories.set(categoryId, { name: categoryName, color: categoryColor, amount: totalAmount });
        }
      }
    });

    // Converter para formato esperado
    const expensesByCategory = Array.from(expensesMap.entries()).map(([categoryId, sums]) => ({
      categoryId,
      _sum: sums
    }));

    console.log(`💰 [DASHBOARD] Despesas agrupadas por categoria: ${expensesByCategory.length} categorias`);

    // 2.1. Buscar despesas de CARTÃO DE CRÉDITO com detalhes para agrupar por tipo
    const allCreditCardExpenses = await prisma.creditCardExpense.findMany({
      where: {
        purchaseDate: { gte: start, lte: end }
      },
      include: {
        Category: {
          select: { id: true, name: true, color: true }
        }
      }
    });
    
    // Agrupar despesas de cartão por categoria (para manter compatibilidade)
    const creditCardExpensesByCategory = Object.values(
      allCreditCardExpenses.reduce((acc: any, exp: any) => {
        const catId = exp.categoryId || 'sem-categoria';
        if (!acc[catId]) {
          acc[catId] = { categoryId: exp.categoryId, _sum: { amount: 0 } };
        }
        acc[catId]._sum.amount += Number(exp.amount || 0);
        return acc;
      }, {})
    );
    
    // 🆕 Adicionar despesas de cartão ao agrupamento por tipo
    allCreditCardExpenses.forEach((exp: any) => {
      const expenseType = (exp.expenseType || 'OTHER') as ExpenseTypeKey;
      const typeData = expensesByTypeMap[expenseType];
      const amount = Number(exp.amount || 0);
      typeData.total += amount;
      
      if (exp.categoryId && exp.Category) {
        const existingCat = typeData.categories.get(exp.categoryId);
        if (existingCat) {
          existingCat.amount += amount;
        } else {
          typeData.categories.set(exp.categoryId, { 
            name: exp.Category.name, 
            color: exp.Category.color || '#6B7280', 
            amount 
          });
        }
      }
    });

    // 2.2. Buscar APENAS Purchases SEM Expense vinculada (para não duplicar!)
    // Purchases COM Expense já estão contadas em expensesByCategory
    const compraMercadoriaCategory = await prisma.expenseCategory.findFirst({
      where: { name: { contains: 'Compra de Mercadoria' } }
    });
    
    // 🔑 APENAS compras SEM expense E SEM cartão de crédito (evita duplicação!)
    // Compras com cartão já geram CreditCardExpense, então não devem ser somadas aqui
    const purchasesWithoutExpense = await prisma.purchase.aggregate({
      where: {
        customerId: null,
        purchaseDate: { gte: start, lte: end },
        expenseId: null,
        // 🆕 Excluir compras de cartão de crédito - já estão em CreditCardExpenses!
        NOT: {
          paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
        }
      },
      _sum: { totalAmount: true }
    });

    const totalPurchasesWithoutExpense = purchasesWithoutExpense._sum.totalAmount || 0;
    console.log("🔍 [DASHBOARD] Purchases SEM Expense e SEM Cartão (para somar):", totalPurchasesWithoutExpense);
    
    // Mapa para compras sem expense - vão para "Compra de Mercadoria"
    const purchasesByCategory = new Map<string, number>();
    if (totalPurchasesWithoutExpense > 0 && compraMercadoriaCategory) {
      purchasesByCategory.set(compraMercadoriaCategory.id, totalPurchasesWithoutExpense);
      
      // 🆕 Adicionar compras sem expense ao agrupamento por tipo (RAW_MATERIALS)
      const purchaseTypeData = expensesByTypeMap.RAW_MATERIALS;
      purchaseTypeData.total += totalPurchasesWithoutExpense;
      
      const existingPurchaseCat = purchaseTypeData.categories.get(compraMercadoriaCategory.id);
      if (existingPurchaseCat) {
        existingPurchaseCat.amount += totalPurchasesWithoutExpense;
      } else {
        purchaseTypeData.categories.set(compraMercadoriaCategory.id, {
          name: compraMercadoriaCategory.name,
          color: compraMercadoriaCategory.color || '#3B82F6',
          amount: totalPurchasesWithoutExpense
        });
      }
    }

    // Buscar nomes de TODAS as categorias (despesas normais + cartão)
    const expenseCategoryIds = [
      ...expensesByCategory.map((e: any) => e.categoryId),
      ...creditCardExpensesByCategory.map((e: any) => e.categoryId)
    ]
      .filter((id): id is string => id !== null) // remove null e garante tipo string
      .filter((id, index, self) => self.indexOf(id) === index); // remove duplicados

    // Buscar categorias de compras separadamente
    const purchaseCategoryIds = Array.from(purchasesByCategory.keys())
      .filter((id): id is string => id !== "sem-categoria")
      .filter((id, index, self) => self.indexOf(id) === index);

    const allCategoryIds = [...expenseCategoryIds, ...purchaseCategoryIds]
      .filter((id, index, self) => self.indexOf(id) === index);

    const categories = await prisma.expenseCategory.findMany({
      where: {
        id: {
          in: allCategoryIds
        }
      }
    });

    // Criar um mapa para somar APENAS despesas normais + cartão (SEM COMPRAS)
    const expenseCategoryMap = new Map<string, { categoryId: string; categoryName: string; categoryColor: string; amount: number }>();

    // Adicionar despesas normais (incluindo feeAmount)
    expensesByCategory.forEach((exp: any) => {
      if (!exp.categoryId) return;
      
      const category = categories.find((c: any) => c.id === exp.categoryId);
      const key = exp.categoryId;
      const existing = expenseCategoryMap.get(key);
      const totalAmount = (exp._sum.amount || 0) + (exp._sum.feeAmount || 0);
      
      if (existing) {
        existing.amount += totalAmount;
      } else {
        expenseCategoryMap.set(key, {
          categoryId: exp.categoryId,
          categoryName: category?.name || "Outros",
          categoryColor: category?.color || "#6B7280",
          amount: totalAmount
        });
      }
    });

    // Adicionar despesas de CARTÃO DE CRÉDITO
    creditCardExpensesByCategory.forEach((exp: any) => {
      if (!exp.categoryId) return;
      
      const category = categories.find((c: any) => c.id === exp.categoryId);
      const key = exp.categoryId;
      const existing = expenseCategoryMap.get(key);
      
      if (existing) {
        existing.amount += exp._sum.amount || 0;
      } else {
        expenseCategoryMap.set(key, {
          categoryId: exp.categoryId,
          categoryName: category?.name || "Cartão de Crédito",
          categoryColor: category?.color || "#6B7280",
          amount: exp._sum.amount || 0
        });
      }
    });

    // 🔧 ADICIONAR COMPRAS (Purchase) na categoria "Compra de Mercadoria"
    // As compras NÃO ficam separadas - são SOMADAS na mesma categoria
    purchasesByCategory.forEach((amount, categoryId) => {
      const existing = expenseCategoryMap.get(categoryId);
      if (existing) {
        existing.amount += amount;
        console.log(`🔍 [DASHBOARD] Somando ${amount} em ${existing.categoryName}. Total: ${existing.amount}`);
      } else {
        // Se a categoria não existe ainda, criar
        const category = categories.find((c: any) => c.id === categoryId);
        expenseCategoryMap.set(categoryId, {
          categoryId: categoryId,
          categoryName: category?.name || "Compra de Mercadoria",
          categoryColor: category?.color || "#3B82F6",
          amount: amount
        });
      }
    });

    const expensesByCategoryWithNames = Array.from(expenseCategoryMap.values());
    const purchasesByCategoryWithNames: any[] = []; // Vazio - compras já foram somadas nas categorias

    // 3. Total de despesas no período (despesas normais + cartão - pagas e pendentes)
    const totalExpensesInPeriod = expensesByCategoryWithNames.reduce(
      (sum, cat) => sum + cat.amount,
      0
    );

    // 3.1. Total de compras no período (para incluir no saldo projetado)
    const totalPurchasesInPeriod = purchasesByCategoryWithNames.reduce(
      (sum, cat) => sum + cat.amount,
      0
    );

    console.log("🔍 [DASHBOARD] Total de despesas no período:", totalExpensesInPeriod);
    console.log("🔍 [DASHBOARD] Total de compras no período:", totalPurchasesInPeriod);

    // 4. Total de despesas pendentes
    const pendingExpenses = await prisma.expense.findMany({
      where: {
        status: "PENDING"
      },
      include: {
        Category: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: { dueDate: "asc" },
      take: 30 // Próximas 30 despesas a vencer
    });

    // 4.1.5 Buscar faturas de cartão de crédito FECHADAS (não pagas)
    // IMPORTANTE: Não incluir "OPEN" - faturas abertas ainda não foram fechadas!
    const pendingCreditCardInvoices = await prisma.creditCardInvoice.findMany({
      where: {
        status: {
          in: ["CLOSED", "OVERDUE"] // Apenas faturas fechadas ou vencidas
        }
      },
      include: {
        CreditCard: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: { dueDate: "asc" }
    });

    // Transformar faturas em formato compatível com despesas
    const creditCardInvoicesAsExpenses = pendingCreditCardInvoices.map((invoice: any) => {
      // Converter data para string no formato YYYY-MM-DD (sem hora) para evitar problemas de timezone
      // Pegar a data do banco e formatar apenas a parte da data
      const dueDateObj = new Date(invoice.dueDate);
      const year = dueDateObj.getUTCFullYear();
      const month = String(dueDateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dueDateObj.getUTCDate()).padStart(2, '0');
      const dueDateFormatted = `${year}-${month}-${day}T00:00:00.000Z`;
      
      return {
        id: invoice.id,
        description: `Fatura ${invoice.CreditCard.name} - ${format(new Date(invoice.referenceMonth), "MMM/yyyy", { locale: ptBR })}`,
        amount: invoice.totalAmount,
        dueDate: dueDateFormatted,
        Category: {
          name: "Cartão de Crédito",
          color: invoice.CreditCard.color || "#8B5CF6"
        }
      };
    });

    // Combinar despesas normais com faturas de cartão
    const allPendingExpenses = [...pendingExpenses, ...creditCardInvoicesAsExpenses]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 30); // Limitar a 30 itens

    // 4.0. Buscar TODAS as contas a receber pendentes (igual à página Contas a Receber)
    // IMPORTANTE: Deve bater EXATAMENTE com a página Contas a Receber
    // 🔧 CORREÇÃO: Buscar Receivables SEM boleto + Boletos separadamente (igual API /api/financial/receivables)
    
    // 4.0.1 Receivables SEM boletoId (para não duplicar com boletos)
    const pendingReceivablesRaw = await prisma.receivable.findMany({
      where: {
        status: {
          in: ["PENDING", "OVERDUE", "PARTIAL"]
        },
        boletoId: null // 🔑 Apenas receivables SEM boleto (para não duplicar)
      },
      include: {
        Customer: {
          select: {
            name: true,
            phone: true
          }
        },
        Order: {
          select: {
            orderNumber: true,
            casualCustomerName: true,
            customerName: true // 🔧 CORREÇÃO: Campo principal para clientes avulsos
          }
        }
      },
      orderBy: { dueDate: "asc" }
    });
    
    // 4.0.2 Buscar Boletos pendentes
    const pendingBoletosRaw = await prisma.boleto.findMany({
      where: {
        status: {
          in: ["PENDING", "OVERDUE"]
        }
      },
      include: {
        Customer: {
          select: {
            name: true,
            phone: true
          }
        },
        Order: {
          select: {
            orderNumber: true,
            casualCustomerName: true,
            customerName: true // 🔧 CORREÇÃO: Campo principal para clientes avulsos
          }
        }
      },
      orderBy: { dueDate: "asc" }
    });
    
    // 4.0.3 Converter boletos para formato de receivable
    const boletosAsReceivables = pendingBoletosRaw.map((boleto: any) => ({
      id: boleto.id,
      description: `Boleto ${boleto.boletoNumber}`,
      amount: boleto.amount,
      dueDate: boleto.dueDate,
      status: boleto.status,
      paymentMethod: 'BOLETO',
      Customer: boleto.Customer,
      Order: boleto.Order,
      isBoleto: true
    }));
    
    // 4.0.4 Combinar e ordenar por data de vencimento
    const pendingReceivables = [...pendingReceivablesRaw, ...boletosAsReceivables]
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    console.log("🟦 [DASHBOARD] Próximos Recebimentos - Receivables:", pendingReceivablesRaw.length);
    console.log("🟦 [DASHBOARD] Próximos Recebimentos - Boletos:", pendingBoletosRaw.length);
    console.log("🟦 [DASHBOARD] Próximos Recebimentos - TOTAL:", pendingReceivables.length);

    let totalPendingExpenses = pendingExpenses.reduce(
      (sum: number, exp: any) => sum + exp.amount + (exp.feeAmount || 0),
      0
    );

    // 4.1. Adicionar despesas de cartão de crédito com fatura NÃO PAGA (OPEN, CLOSED, OVERDUE)
    const pendingCreditCardExpenses = await prisma.creditCardExpense.aggregate({
      where: {
        OR: [
          {
            // Despesas em faturas abertas, fechadas ou vencidas (não pagas)
            Invoice: {
              status: {
                in: ["OPEN", "CLOSED", "OVERDUE"]
              }
            }
          },
          {
            // Despesas sem fatura atribuída ainda (ainda na fatura aberta)
            invoiceId: null
          }
        ]
      },
      _sum: {
        amount: true
      }
    });

    totalPendingExpenses += pendingCreditCardExpenses._sum.amount || 0;

    // 4.2. Adicionar COMPRAS PENDENTES (não pagas) - APENAS DA FÁBRICA
    // 🔧 CORREÇÃO: Excluir compras que JÁ têm expense vinculada (para não duplicar)
    // 🔧 CORREÇÃO: Excluir compras de cartão de crédito (já estão nas CreditCardExpenses)
    const pendingPurchases = await prisma.purchase.aggregate({
      where: {
        customerId: null, // 🔑 Apenas compras da fábrica (admin)
        status: "PENDING",
        expenseId: null, // 🔑 Apenas compras SEM expense (para não duplicar)
        paymentMethod: { not: "CARTAO_CREDITO" } // 🔑 Excluir cartão (já contado acima)
      },
      _sum: {
        totalAmount: true
      }
    });

    totalPendingExpenses += pendingPurchases._sum.totalAmount || 0;
    console.log("🔍 [DASHBOARD] Compras pendentes (sem expense, sem cartão):", pendingPurchases._sum.totalAmount || 0);

    // 5. Despesas vencidas
    const overdueExpenses = await prisma.expense.count({
      where: {
        status: "PENDING",
        dueDate: {
          lt: new Date()
        }
      }
    });

    // 6. Receitas do período (pedidos)
    const ordersIncome = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: {
          notIn: ["CANCELLED"]
        }
      },
      _sum: {
        total: true
      }
    });

    const totalIncome = ordersIncome._sum.total || 0;

    console.log("🔍 [DASHBOARD] Total de receita (pedidos) no período:", totalIncome);

    // 7. Contas a receber pendentes
    // 🔧 CORREÇÃO: Incluir BOLETOS pendentes (que são a principal fonte de recebíveis)
    // 🔧 CORREÇÃO: Receivables SEM boletoId (para não duplicar com boletos)
    
    // 7.1 Receivables pendentes SEM boleto vinculado
    const receivablesWithoutBoleto = await prisma.receivable.aggregate({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        boletoId: null // 🔑 Apenas receivables SEM boleto (para não duplicar)
      },
      _sum: {
        amount: true
      }
    });
    
    // 7.2 Boletos pendentes (principal fonte de recebíveis)
    const pendingBoletos = await prisma.boleto.aggregate({
      where: {
        status: { in: ["PENDING", "OVERDUE"] }
      },
      _sum: {
        amount: true
      }
    });
    
    const totalReceivable = (receivablesWithoutBoleto._sum.amount || 0) + (pendingBoletos._sum.amount || 0);
    
    console.log("🟦 [DASHBOARD] A Receber - Receivables (sem boleto):", receivablesWithoutBoleto._sum.amount || 0);
    console.log("🟦 [DASHBOARD] A Receber - Boletos pendentes:", pendingBoletos._sum.amount || 0);
    console.log("🟦 [DASHBOARD] A Receber - TOTAL:", totalReceivable);

    // 7.1. Receita Líquida (valores efetivamente recebidos)
    const receivedIncome = await prisma.receivable.aggregate({
      where: {
        paymentDate: {
          gte: start,
          lte: end
        },
        status: "PAID"
      },
      _sum: {
        amount: true
      }
    });

    const totalReceivedIncome = receivedIncome?._sum?.amount || 0;

    console.log("🔍 [DASHBOARD] Total de receita recebida no período:", totalReceivedIncome);

    // 8. Transações recentes
    const recentTransactions = await prisma.transaction.findMany({
      include: {
        BankAccount: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: { date: "desc" },
      take: 15
    });

    // 9. Saldo projetado (saldo atual + contas a receber - contas a pagar)
    const projectedBalance = totalBalance + totalReceivable - totalPendingExpenses;
    
    console.log("🟦 [DASHBOARD] Cálculo do Saldo Projetado:");
    console.log("   Saldo Total nas Contas:", totalBalance);
    console.log("   + Contas a Receber:", totalReceivable);
    console.log("   - Contas a Pagar:", totalPendingExpenses);
    console.log("   = Saldo Projetado:", projectedBalance);

    // 10. O agrupamento por tipo já foi feito acima no expensesByTypeMap (linha 67)
    // 🆕 Converter expensesByTypeMap para formato serializável
    const expensesByTypeWithCategories = Object.fromEntries(
      Object.entries(expensesByTypeMap).map(([type, data]) => [
        type,
        {
          total: data.total,
          categories: Array.from(data.categories.values()).sort((a, b) => b.amount - a.amount) // Ordenar por valor decrescente
        }
      ])
    );
    
    // Também criar versão simplificada para compatibilidade
    const expensesByTypeSimple = {
      OPERATIONAL: expensesByTypeMap.OPERATIONAL.total,
      PRODUCTS: expensesByTypeMap.PRODUCTS.total,
      RAW_MATERIALS: expensesByTypeMap.RAW_MATERIALS.total,
      INVESTMENT: expensesByTypeMap.INVESTMENT.total,
      PROLABORE: expensesByTypeMap.PROLABORE.total,
      OTHER: expensesByTypeMap.OTHER.total
    };
    
    return NextResponse.json({
      summary: {
        totalBalance,
        totalIncome,
        totalReceivedIncome,
        totalExpensesPaid: totalExpensesInPeriod,
        totalPurchasesPaid: totalPurchasesInPeriod,
        totalPendingExpenses,
        totalReceivable,
        projectedBalance,
        overdueExpensesCount: overdueExpenses
      },
      expensesByType: expensesByTypeSimple,
      expensesByTypeWithCategories, // 🆕 NOVO: Agrupado por tipo COM categorias
      bankAccounts,
      expensesByCategory: expensesByCategoryWithNames,
      purchasesByCategory: purchasesByCategoryWithNames,
      pendingExpenses: allPendingExpenses, // Inclui despesas normais + faturas de cartão
      pendingReceivables: pendingReceivables,
      recentTransactions
    });
  } catch (error) {
    console.error("Erro ao buscar dashboard:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dashboard" },
      { status: 500 }
    );
  }
}
