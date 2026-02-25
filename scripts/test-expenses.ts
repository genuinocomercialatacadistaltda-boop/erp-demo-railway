import { prisma } from '../lib/db';

async function test() {
  const today = new Date('2026-01-12T00:00:00.000Z');
  const tomorrow = new Date('2026-01-12T23:59:59.999Z');
  
  console.log('=== DESPESAS NORMAIS PARA 12/01/2026 ===');
  
  const normalExpenses = await prisma.expense.findMany({
    where: {
      expenseType: 'OPERATIONAL',
      OR: [
        { competenceDate: { gte: today, lte: tomorrow } },
        { competenceDate: null, dueDate: { gte: today, lte: tomorrow } }
      ]
    },
    select: {
      id: true,
      description: true,
      amount: true,
      competenceDate: true,
      dueDate: true
    }
  });
  console.log('Despesas normais:', normalExpenses.length);
  
  console.log('=== DESPESAS DE CARTÃO PARA 12/01/2026 ===');
  const cardExpenses = await prisma.creditCardExpense.findMany({
    where: {
      expenseType: 'OPERATIONAL',
      purchaseDate: { gte: today, lte: tomorrow }
    },
    select: {
      id: true,
      description: true,
      amount: true,
      purchaseDate: true
    }
  });
  console.log('Despesas de cartão:', cardExpenses.length);
  console.log('=== TOTAL ESPERADO:', normalExpenses.length + cardExpenses.length, '===');
  
  await prisma.$disconnect();
}

test();
