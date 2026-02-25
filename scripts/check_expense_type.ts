import { prisma } from '../lib/prisma';

async function check() {
  const expense = await prisma.expense.findUnique({
    where: { id: 'cmlqo8okg000zpd08vb7icaq1' },
    include: {
      Category: true,
      Purchase: true
    }
  });
  
  if (expense) {
    console.log('=== DESPESA R$ 514,08 ===');
    console.log('ID:', expense.id);
    console.log('Descrição:', expense.description);
    console.log('Valor:', expense.amount);
    console.log('⭐ expenseType:', expense.expenseType);
    console.log('Categoria:', expense.Category?.name);
    console.log('Tem Purchase vinculada:', !!expense.Purchase);
  }
  
  // Ver como outras compras estão configuradas
  console.log('\n=== OUTRAS DESPESAS COM CATEGORIA "Compra de Mercadoria" ===');
  const others = await prisma.expense.findMany({
    where: {
      Category: { name: { contains: 'Compra de Mercadoria' } }
    },
    include: { Category: true },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  
  others.forEach(e => {
    console.log('\n-', e.description?.substring(0, 50), '| Valor:', e.amount, '| expenseType:', e.expenseType);
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
