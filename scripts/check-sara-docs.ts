import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar sara
  const sara = await prisma.employee.findFirst({
    where: { name: { contains: 'sara', mode: 'insensitive' } }
  });
  
  if (!sara) {
    console.log('Sara não encontrada');
    return;
  }
  
  console.log(`👤 Sara ID: ${sara.id}`);
  
  // Verificar documentos da sara
  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId: sara.id },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`\n📋 DOCUMENTOS DA SARA:`);
  docs.forEach(d => {
    console.log(`   ${d.documentType.padEnd(15)} | ${d.title.padEnd(40)} | ${d.referenceDate?.toLocaleDateString('pt-BR') || 'N/A'}`);
  });
  
  // Verificar pagamentos
  const payments = await prisma.employeePayment.findMany({
    where: { employeeId: sara.id },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`\n💰 PAGAMENTOS DA SARA:`);
  payments.forEach(p => {
    console.log(`   Mês ${p.month}/${p.year} | Criado: ${p.createdAt.toLocaleDateString('pt-BR')} | Total: R$ ${p.totalAmount}`);
  });
  
  await prisma.$disconnect();
}
check();
