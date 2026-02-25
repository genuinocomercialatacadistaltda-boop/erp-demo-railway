import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Verificar documentos de contracheque de 02/2026
  const docs = await prisma.employeeDocument.findMany({
    where: { 
      documentType: 'CONTRACHEQUE',
      title: { contains: '2/2026' }
    },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`\n📋 DOCUMENTOS CONTRACHEQUE 2/2026: ${docs.length}`);
  docs.forEach(d => {
    console.log(`${d.employee.name.padEnd(30)} | ${d.title} | ${d.referenceDate?.toLocaleDateString('pt-BR') || 'N/A'}`);
  });
  
  // Verificar pagamentos
  const payments = await prisma.employeePayment.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: { select: { name: true } } }
  });
  
  console.log(`\n\n💰 PAGAMENTOS 02/2026:`);
  payments.forEach(p => {
    console.log(`${p.employee.name.padEnd(30)} | Mês: ${p.month}/${p.year} | Notas: ${p.notes?.substring(0, 50) || 'N/A'}`);
  });
  
  await prisma.$disconnect();
}
check();
