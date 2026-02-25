import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('\n📄 ACEITES EM EmployeeDocumentAcknowledgment (Contracheques 02/2026):');
  const docAcks = await prisma.employeeDocumentAcknowledgment.findMany({
    where: {
      document: {
        documentType: 'CONTRACHEQUE',
        title: { contains: '2/2026' }
      }
    },
    include: {
      employee: { select: { name: true } },
      document: { select: { title: true } }
    }
  });
  
  if (docAcks.length === 0) {
    console.log('   Nenhum aceite encontrado!');
  } else {
    docAcks.forEach(a => {
      console.log('   ✅ ' + a.employee.name + ' - Doc: ' + a.document.title);
    });
  }
  
  console.log('\n\n💰 ACEITES EM EmployeePaymentAcknowledgment (02/2026):');
  const payAcks = await prisma.employeePaymentAcknowledgment.findMany({
    where: { payment: { month: 2, year: 2026 } },
    include: { employee: { select: { name: true } } }
  });
  
  if (payAcks.length === 0) {
    console.log('   Nenhum aceite encontrado!');
  } else {
    payAcks.forEach(a => {
      console.log('   ✅ ' + a.employee.name);
    });
  }
  
  await prisma.$disconnect();
}
check();
