import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const expenses = await prisma.expense.findMany({
    where: { description: { contains: '(2/2026)' } },
    orderBy: [{ description: 'asc' }, { status: 'asc' }]
  });
  
  console.log('\n💰 DESPESAS DE FUNCIONÁRIOS 02/2026:');
  console.log('Tipo | Nome | Valor | Status');
  console.log('-'.repeat(80));
  
  expenses.forEach(e => {
    const tipo = e.description.startsWith('Adiantamento') ? 'ADIANT' : 'SALÁRIO';
    const nome = e.description.match(/-\s*(.+?)\s*\(/)?.[1] || 'N/A';
    const valor = `R$ ${e.amount.toFixed(2)}`;
    const status = e.status === 'PAID' ? '✅' : '❌';
    console.log(`${tipo.padEnd(8)} | ${nome.substring(0, 30).padEnd(30)} | ${valor.padStart(12)} | ${status}`);
  });
  
  await prisma.$disconnect();
}
check();
