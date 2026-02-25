import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const eliete = await prisma.employee.findFirst({
    where: { name: { contains: 'ELIETE', mode: 'insensitive' } }
  });
  
  console.log(`👤 ELIETE: ${eliete?.id}`);
  
  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId: eliete?.id, documentType: 'CONTRACHEQUE' },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\n📋 CONTRACHEQUES DA ELIETE:');
  docs.forEach(d => {
    console.log(`   Título: ${d.title}`);
    console.log(`   ReferenceDate: ${d.referenceDate?.toISOString()}`);
    console.log(`   CreatedAt: ${d.createdAt.toISOString()}`);
    console.log(`   FileURL: ${d.fileUrl}`);
    console.log('   ---');
  });
  
  const payments = await prisma.employeePayment.findMany({
    where: { employeeId: eliete?.id },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\n💰 PAGAMENTOS DA ELIETE:');
  payments.forEach(p => {
    console.log(`   Mês: ${p.month}/${p.year} | Adiantamento: R$ ${p.advanceGrossAmount} | Salário: R$ ${p.salaryGrossAmount} | Total: R$ ${p.totalAmount}`);
  });
  
  await prisma.$disconnect();
}
check();
