import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  const firstDayOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0));
  const firstDayOfNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1, 0, 0, 0));
  
  console.log("📅 Período da página Admin:");
  console.log("   firstDayOfMonth:", firstDayOfMonth.toISOString());
  console.log("   firstDayOfNextMonth:", firstDayOfNextMonth.toISOString());
  
  // Verificar o que a página admin está fazendo para Desp. com Produtos
  const CATEGORY_GROUPS = {
    PRODUCTS: [
      'cmhqac6f60002qp08mpglx8m3'  // Desp. com Produtos
    ]
  };
  
  // Buscar categoria de produtos
  const prodCat = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Desp. com Produtos' } }
  });
  console.log("\n📦 Categoria Desp. com Produtos:", prodCat?.name, "ID:", prodCat?.id);
  
  if (prodCat) {
    // Buscar todas expenses desta categoria
    const allProdExp = await prisma.expense.findMany({
      where: { categoryId: prodCat.id },
      select: {
        id: true,
        amount: true,
        feeAmount: true,
        competenceDate: true,
        paymentDate: true,
        dueDate: true,
        description: true,
        Purchase: {
          select: { purchaseDate: true }
        }
      }
    });
    
    console.log("   Total expenses:", allProdExp.length);
    
    // Filtrar por competência (mesma lógica da página admin)
    const monthlyFiltered = allProdExp.filter(expense => {
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
    
    console.log("   Filtradas por competência Jan/2026:", monthlyFiltered.length);
    
    const total = monthlyFiltered.reduce((sum, e) => 
      sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
    );
    console.log("   Total:", total.toFixed(2));
  }
  
  // Verificar Investimentos
  const invCat = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Investimento' } }
  });
  console.log("\n📈 Categoria Investimentos:", invCat?.name, "ID:", invCat?.id);
  
  if (invCat) {
    const allInvExp = await prisma.expense.findMany({
      where: { categoryId: invCat.id },
      select: {
        id: true,
        amount: true,
        feeAmount: true,
        competenceDate: true,
        paymentDate: true,
        dueDate: true,
        description: true,
        Purchase: {
          select: { purchaseDate: true }
        }
      }
    });
    
    console.log("   Total expenses:", allInvExp.length);
    
    const monthlyFiltered = allInvExp.filter(expense => {
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
    
    console.log("   Filtradas por competência Jan/2026:", monthlyFiltered.length);
    
    const total = monthlyFiltered.reduce((sum, e) => 
      sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
    );
    console.log("   Total:", total.toFixed(2));
  }
  
  // Verificar Pró-labore
  const prolCat = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Pró-labore' } }
  });
  console.log("\n💼 Categoria Pró-labore:", prolCat?.name, "ID:", prolCat?.id);
  
  if (prolCat) {
    const allProlExp = await prisma.expense.findMany({
      where: { categoryId: prolCat.id },
      select: {
        id: true,
        amount: true,
        feeAmount: true,
        competenceDate: true,
        paymentDate: true,
        dueDate: true,
        description: true,
        Purchase: {
          select: { purchaseDate: true }
        }
      }
    });
    
    console.log("   Total expenses:", allProlExp.length);
    
    const monthlyFiltered = allProlExp.filter(expense => {
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
    
    console.log("   Filtradas por competência Jan/2026:", monthlyFiltered.length);
    
    const total = monthlyFiltered.reduce((sum, e) => 
      sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
    );
    console.log("   Total:", total.toFixed(2));
  }
  
  // Agora verificar o problema do 372 mil
  console.log("\n\n========= INVESTIGANDO OS R$ 372.300,95 =========");
  
  // Possivelmente o código antigo está usando paymentDate em vez de competência
  const compraCat = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Compra de Mercadoria' } }
  });
  
  // Total SEM FILTRO de data
  const allCompraExp = await prisma.expense.findMany({
    where: { categoryId: compraCat?.id },
    select: {
      amount: true,
      feeAmount: true,
    }
  });
  
  const totalSemFiltro = allCompraExp.reduce((sum, e) => 
    sum + Number(e.amount || 0) + Number(e.feeAmount || 0), 0
  );
  
  console.log("Total Expenses SEM FILTRO de data:", totalSemFiltro.toFixed(2));
  
  // Total de CreditCardExpenses SEM FILTRO
  const allCCExp = await prisma.creditCardExpense.aggregate({
    where: { categoryId: compraCat?.id },
    _sum: { amount: true }
  });
  console.log("Total CreditCardExpenses SEM FILTRO:", allCCExp._sum?.amount || 0);
  
  // Total de Purchases SEM FILTRO
  const allPurchases = await prisma.purchase.aggregate({
    where: {
      customerId: null,
      expenseId: null,
      NOT: {
        paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
      }
    },
    _sum: { totalAmount: true }
  });
  console.log("Total Purchases SEM FILTRO:", allPurchases._sum?.totalAmount || 0);
  
  const grandTotalSemFiltro = totalSemFiltro + Number(allCCExp._sum?.amount || 0) + Number(allPurchases._sum?.totalAmount || 0);
  console.log("\n🔢 GRAND TOTAL SEM FILTRO:", grandTotalSemFiltro.toFixed(2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
