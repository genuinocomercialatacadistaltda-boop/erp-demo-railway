import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar todos os documentos do Jonathan
  const docs = await prisma.employeeDocument.findMany({
    where: {
      employee: {
        name: { contains: 'Jonathan', mode: 'insensitive' }
      }
    },
    include: {
      employee: { select: { name: true } },
      documentAck: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\n📄 TODOS OS DOCUMENTOS DO JONATHAN:');
  docs.forEach(d => {
    console.log('   - Tipo: ' + d.documentType);
    console.log('     Título: "' + d.title + '"');
    console.log('     Data Ref: ' + d.referenceDate);
    console.log('     Assinado: ' + (d.documentAck ? 'SIM em ' + d.documentAck.acknowledgedAt : 'NAO'));
    console.log('');
  });

  // Verificar o aceite do pagamento diretamente
  const payment = await prisma.employeePayment.findFirst({
    where: {
      employee: { name: { contains: 'Jonathan', mode: 'insensitive' } },
      month: 2,
      year: 2026
    },
    include: {
      employee: true
    }
  });
  
  if (payment) {
    console.log('\n💰 PAGAMENTO DO JONATHAN 02/2026:');
    console.log('   ID: ' + payment.id);
    console.log('   Valor: R$ ' + payment.netAmount);
  }
  
  await prisma.$disconnect();
}
check();
