import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar folhas de ponto de janeiro
  const timesheets = await prisma.timesheet.findMany({
    where: { month: 1, year: 2026 },
    include: { 
      employee: { select: { name: true } },
      acknowledgment: true 
    }
  });
  
  console.log('\n📋 FOLHAS DE PONTO DE JANEIRO/2026:');
  console.log('Funcionário | Status | Assinatura');
  console.log('-'.repeat(70));
  
  timesheets.forEach(t => {
    const hasAck = t.acknowledgment ? '✅ SIM' : '❌ NÃO';
    console.log(`${t.employee.name.padEnd(35)} | ${t.status.padEnd(10)} | ${hasAck}`);
  });
  
  // Verificar pagamentos de 02/2026
  console.log('\n\n💰 PAGAMENTOS DE 02/2026:');
  const payments = await prisma.employeePayment.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: { select: { name: true } } }
  });
  
  payments.forEach(p => {
    console.log(`${p.employee.name} | Mês: ${p.month} | Ano: ${p.year}`);
  });
  
  await prisma.$disconnect();
}
check();
