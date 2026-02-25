import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar despesas de funcionários de 02/2026
  const expenses = await prisma.expense.findMany({
    where: { description: { contains: '(2/2026)' } },
    orderBy: { description: 'asc' }
  });
  
  console.log('\n💰 STATUS DAS DESPESAS DE FUNCIONÁRIOS 02/2026:');
  console.log('Descrição | Status | Data Pagamento');
  console.log('-'.repeat(80));
  
  expenses.forEach(e => {
    const paid = e.status === 'PAID' ? '✅ PAGO' : '❌ PENDENTE';
    const payDate = e.paymentDate ? e.paymentDate.toLocaleDateString('pt-BR') : '-';
    console.log(`${e.description.substring(0, 45).padEnd(45)} | ${paid.padEnd(12)} | ${payDate}`);
  });
  
  const paidCount = expenses.filter(e => e.status === 'PAID').length;
  const pendingCount = expenses.filter(e => e.status === 'PENDING').length;
  
  console.log('\n📊 RESUMO:');
  console.log(`   ✅ Pagos: ${paidCount}`);
  console.log(`   ❌ Pendentes: ${pendingCount}`);
  
  await prisma.$disconnect();
}
check();
