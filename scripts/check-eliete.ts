import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar funcionária ELIETE
  const employee = await prisma.employee.findFirst({
    where: { name: { contains: 'ELIETE', mode: 'insensitive' } }
  });
  
  console.log('\n👤 FUNCIONÁRIA:', employee?.name, '| ID:', employee?.id);
  
  // Buscar pagamentos de ELIETE em 02/2026
  const payments = await prisma.employeePayment.findMany({
    where: {
      employeeId: employee?.id,
      month: 2,
      year: 2026
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\n💰 PAGAMENTOS DE 02/2026:');
  payments.forEach((p, i) => {
    console.log(`\n--- Pagamento ${i + 1} (ID: ${p.id}) ---`);
    console.log(`   Criado em: ${p.createdAt.toLocaleString('pt-BR')}`);
    console.log(`   Salário Bruto: R$ ${p.salaryGrossAmount}`);
    console.log(`   Adiantamento: R$ ${p.advanceGrossAmount}`);
    console.log(`   Vale Alimentação: R$ ${p.foodVoucherGrossAmount}`);
    console.log(`   Bônus: R$ ${p.bonusGrossAmount}`);
    console.log(`   Total Líquido: R$ ${p.totalAmount}`);
    console.log(`   documentId: ${p.documentId}`);
  });
  
  // Buscar documentos/contracheques de ELIETE
  console.log('\n📄 DOCUMENTOS/CONTRACHEQUES:');
  const docs = await prisma.employeeDocument.findMany({
    where: {
      employeeId: employee?.id,
      title: { contains: '2/2026' }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  docs.forEach(d => {
    console.log(`   - ${d.title} | Criado: ${d.createdAt.toLocaleString('pt-BR')} | ID: ${d.id}`);
  });
  
  await prisma.$disconnect();
}
check();
