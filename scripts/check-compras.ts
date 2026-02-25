import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const firstDayOfMonth = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
  const firstDayOfNextMonth = new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
  
  console.log("📅 Período:", firstDayOfMonth.toISOString(), "até", firstDayOfNextMonth.toISOString());
  
  const compraMercadoriaCategory = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Compra de Mercadoria' } }
  });
  
  console.log("📦 Categoria:", compraMercadoriaCategory?.name, "ID:", compraMercadoriaCategory?.id);
  
  // All expenses with this category
  const allExpenses = await prisma.expense.findMany({
    where: { categoryId: compraMercadoriaCategory?.id },
    select: {
      id: true,
      amount: true,
      feeAmount: true,
      competenceDate: true,
      paymentDate: true,
      dueDate: true,
      description: true,
      Purchase: {
        select: { purchaseDate: true, totalAmount: true }
      }
    }
  });
  
  console.log("\n📊 Total de Expenses com categoria 'Compra de Mercadoria':", allExpenses.length);
  
  // Filter by competence
  const monthlyExpenses = allExpenses.filter(expense => {
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
  
  console.log("📊 Expenses filtradas por COMPETÊNCIA Janeiro 2026:", monthlyExpenses.length);
  
  const totalExpenses = monthlyExpenses.reduce((sum, e) => 
    sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
  );
  
  console.log("💰 Total Expenses (por competência):", totalExpenses.toFixed(2));
  
  // Credit card expenses
  const ccExpenses = await prisma.creditCardExpense.aggregate({
    where: {
      categoryId: compraMercadoriaCategory?.id,
      purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }
    },
    _sum: { amount: true }
  });
  
  console.log("💳 CreditCardExpenses Janeiro 2026:", ccExpenses._sum?.amount || 0);
  
  // Purchases without expense
  const purchasesNoExp = await prisma.purchase.aggregate({
    where: {
      customerId: null,
      purchaseDate: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
      expenseId: null,
      NOT: {
        paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
      }
    },
    _sum: { totalAmount: true }
  });
  
  console.log("📦 Purchases SEM Expense (Janeiro 2026):", purchasesNoExp._sum?.totalAmount || 0);
  
  const total = totalExpenses + Number(ccExpenses._sum?.amount || 0) + Number(purchasesNoExp._sum?.totalAmount || 0);
  console.log("\n🔢 TOTAL COMPRAS DE MERCADORIA (Janeiro 2026):", total.toFixed(2));
  
  // AGORA VERIFICAR COMO O DASHBOARD FIN FAZ
  console.log("\n\n========= VERIFICANDO LÓGICA DO DASHBOARD FINANCEIRO =========");
  
  // Buscar todas as expenses com categoria "Compra de Mercadoria"
  const expensesWithCat = await prisma.expense.findMany({
    where: {
      category: { name: { contains: 'Compra de Mercadoria' } }
    },
    include: {
      Purchase: true
    }
  });
  
  console.log("Total expenses com categoria:", expensesWithCat.length);
  
  // Somar total (sem filtro de data para ver o valor total)
  const totalSemFiltro = expensesWithCat.reduce((sum, e) => 
    sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
  );
  console.log("Total SEM filtro de data:", totalSemFiltro.toFixed(2));
  
  // Verificar quais meses estão representados
  const byMonth: Record<string, number> = {};
  expensesWithCat.forEach(e => {
    let compDate: Date | null = null;
    if (e.competenceDate) compDate = new Date(e.competenceDate);
    else if (e.Purchase?.purchaseDate) compDate = new Date(e.Purchase.purchaseDate);
    else if (e.paymentDate) compDate = new Date(e.paymentDate);
    else if (e.dueDate) compDate = new Date(e.dueDate);
    
    if (compDate) {
      const key = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + Number(e.amount || 0) + Number(e.feeAmount || 0);
    }
  });
  
  console.log("\n📆 Total por mês (competência):");
  Object.entries(byMonth).sort().forEach(([month, total]) => {
    console.log(`   ${month}: R$ ${total.toFixed(2)}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
