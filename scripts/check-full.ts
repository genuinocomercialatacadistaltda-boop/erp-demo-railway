import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // 1. Buscar TODAS as despesas de funcionário de 02/2026
  const expenses = await prisma.expense.findMany({
    where: {
      description: { contains: '2/2026' },
      Category: { name: { contains: 'Pagamento de Funcionários', mode: 'insensitive' } },
      status: 'PENDING'
    },
    include: { Category: true }
  });
  
  console.log('\n📋 DESPESAS PENDENTES DE FUNCIONÁRIOS (02/2026): ' + expenses.length);
  
  // Para cada despesa, extrair o nome e verificar se tem aceite
  for (const exp of expenses) {
    const match = exp.description.match(/-\s*(.+?)\s*\(/);
    const name = match ? match[1].trim() : null;
    
    if (!name) {
      console.log('   ⚠️ ' + exp.description + ' - Nome não extraído');
      continue;
    }
    
    // Buscar pagamento pelo nome
    const payment = await prisma.employeePayment.findFirst({
      where: {
        employee: { name: { equals: name, mode: 'insensitive' } },
        month: 2,
        year: 2026
      }
    });
    
    if (!payment) {
      console.log('   ❌ ' + name + ' - Pagamento NÃO ENCONTRADO');
      continue;
    }
    
    // Verificar aceite do pagamento
    const ack = await prisma.employeePaymentAcknowledgment.findFirst({
      where: { paymentId: payment.id }
    });
    
    console.log('   ' + (ack ? '✅' : '❌') + ' ' + name + ' - Payment ID: ' + payment.id + (ack ? ' (ASSINADO)' : ' (PENDENTE)'));
  }
  
  // 2. Listar TODOS os aceites de 02/2026
  console.log('\n\n📝 TODOS OS ACEITES DE 02/2026:');
  const allAcks = await prisma.employeePaymentAcknowledgment.findMany({
    where: { payment: { month: 2, year: 2026 } },
    include: { 
      employee: { select: { name: true } },
      payment: { select: { id: true, month: true, year: true } }
    }
  });
  
  allAcks.forEach(a => {
    console.log('   ✅ ' + a.employee.name + ' - PaymentId: ' + a.paymentId);
  });
  
  await prisma.$disconnect();
}
check();
