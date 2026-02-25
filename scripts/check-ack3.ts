import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar aceites de pagamento (tabela correta)
  const acks = await prisma.employeePaymentAcknowledgment.findMany({
    where: {
      payment: { month: 2, year: 2026 }
    },
    include: {
      employee: { select: { name: true } },
      payment: { select: { month: true, year: true } }
    }
  });
  
  console.log('\n✅ ACEITES EM EmployeePaymentAcknowledgment (02/2026):');
  if (acks.length === 0) {
    console.log('   Nenhum aceite encontrado!');
  } else {
    acks.forEach(a => {
      console.log('   - ' + a.employee.name + ' | Aceito em: ' + a.acknowledgedAt);
    });
  }
  
  // Listar pagamentos de fevereiro
  const payments = await prisma.employeePayment.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: { select: { name: true } } }
  });
  
  console.log('\n💰 PAGAMENTOS (02/2026):');
  payments.forEach(p => {
    const hasAck = acks.some(a => a.paymentId === p.id);
    console.log('   - ' + p.employee.name + ': ' + (hasAck ? '✅ ASSINADO' : '❌ PENDENTE'));
  });
  
  await prisma.$disconnect();
}
check();
