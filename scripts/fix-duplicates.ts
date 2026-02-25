import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  // Buscar despesas de "Salário" de 02/2026 que são duplicatas de adiantamento
  const salarioExpenses = await prisma.expense.findMany({
    where: { 
      description: { startsWith: 'Salário' },
      description: { contains: '(2/2026)' },
      status: 'PENDING'
    }
  });
  
  console.log(`📋 ${salarioExpenses.length} despesas de "Salário" pendentes encontradas`);
  
  let deleted = 0;
  for (const salario of salarioExpenses) {
    // Extrair nome do funcionário
    const nome = salario.description.match(/-\s*(.+?)\s*\(/)?.[1];
    if (!nome) continue;
    
    // Verificar se existe adiantamento PAGO com o mesmo valor
    const adiantamento = await prisma.expense.findFirst({
      where: {
        description: { 
          contains: nome,
          startsWith: 'Adiantamento'
        },
        amount: salario.amount,
        status: 'PAID'
      }
    });
    
    if (adiantamento) {
      // Encontrou duplicata - excluir a despesa de salário
      await prisma.expense.delete({ where: { id: salario.id } });
      console.log(`   🗑️ Excluída duplicata: ${salario.description} (R$ ${salario.amount})`);
      deleted++;
    }
  }
  
  console.log(`\n✅ ${deleted} despesas duplicadas excluídas!`);
  
  await prisma.$disconnect();
}
fix();
