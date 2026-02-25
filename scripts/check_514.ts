import { prisma } from '../lib/prisma';

async function check() {
  // Buscar despesas com valor aproximado de 514
  console.log('=== DESPESAS COM VALOR ~514 ===');
  const expenses = await prisma.expense.findMany({
    where: {
      amount: {
        gte: 513,
        lte: 515
      }
    },
    include: {
      Category: true,
      Purchase: true,
      Supplier: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  expenses.forEach(e => {
    console.log('\n--- Despesa ---');
    console.log('ID:', e.id);
    console.log('Descrição:', e.description);
    console.log('Valor:', e.amount);
    console.log('Categoria:', e.Category?.name);
    console.log('Fornecedor:', e.Supplier?.name);
    console.log('Status:', e.status);
    console.log('Data Vencimento:', e.dueDate);
    console.log('Data Pagamento:', e.paymentDate);
    console.log('Criado em:', e.createdAt);
    if (e.Purchase) {
      console.log('--- Compra Vinculada ---');
      console.log('  ID Compra:', e.Purchase.id);
      console.log('  Descrição:', e.Purchase.description);
    }
  });

  // Buscar compras com valor aproximado de 514
  console.log('\n\n=== COMPRAS COM VALOR ~514 ===');
  const purchases = await prisma.purchase.findMany({
    where: {
      totalAmount: {
        gte: 513,
        lte: 515
      }
    },
    include: {
      supplier: true,
      expense: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  purchases.forEach(p => {
    console.log('\n--- Compra ---');
    console.log('ID:', p.id);
    console.log('Descrição:', p.description);
    console.log('Valor Total:', p.totalAmount);
    console.log('Fornecedor:', p.supplier?.name);
    console.log('Status:', p.status);
    console.log('Data Compra:', p.purchaseDate);
    console.log('Criado em:', p.createdAt);
    if (p.expense) {
      console.log('  Tem Expense vinculada: SIM, ID:', p.expenseId);
    }
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
