import { prisma } from '../lib/prisma';

async function fix() {
  // Corrigir o expenseType da despesa de R$ 514,08
  const updated = await prisma.expense.update({
    where: { id: 'cmlqo8okg000zpd08vb7icaq1' },
    data: { expenseType: 'RAW_MATERIALS' }
  });
  
  console.log('✅ Despesa corrigida!');
  console.log('ID:', updated.id);
  console.log('Descrição:', updated.description);
  console.log('Novo expenseType:', updated.expenseType);
}
fix().catch(console.error).finally(() => prisma.$disconnect());
