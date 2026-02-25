import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const payments = await prisma.employeePayment.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: { select: { name: true } } },
    orderBy: { employee: { name: 'asc' } }
  });
  
  console.log('\n💰 TODOS OS PAGAMENTOS DE 02/2026:');
  console.log('Nome | Salário | Adiantamento | Total');
  console.log('-'.repeat(70));
  
  payments.forEach(p => {
    console.log(`${p.employee.name.padEnd(35)} | R$ ${String(p.salaryGrossAmount).padStart(8)} | R$ ${String(p.advanceGrossAmount).padStart(8)} | R$ ${String(p.totalAmount).padStart(8)}`);
  });
  
  await prisma.$disconnect();
}
check();
