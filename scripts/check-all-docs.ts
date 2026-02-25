import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Verificar todos os documentos de contracheque
  const docs = await prisma.employeeDocument.findMany({
    where: { documentType: 'CONTRACHEQUE' },
    include: { employee: { select: { name: true } } },
    orderBy: [{ title: 'asc' }, { employee: { name: 'asc' } }]
  });
  
  console.log(`\n📋 TODOS OS CONTRACHEQUES (${docs.length}):`);
  console.log('Funcionário | Título | Data Ref');
  console.log('-'.repeat(80));
  docs.forEach(d => {
    console.log(`${d.employee.name.padEnd(30)} | ${d.title.padEnd(25)} | ${d.referenceDate?.toLocaleDateString('pt-BR') || 'N/A'}`);
  });
  
  await prisma.$disconnect();
}
check();
