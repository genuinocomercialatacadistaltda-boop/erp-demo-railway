import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // 1. Buscar despesas de funcionários de fevereiro pendentes
  const expenses = await prisma.expense.findMany({
    where: {
      description: {
        contains: '2/2026',
        mode: 'insensitive'
      },
      status: 'PENDING'
    },
    select: { id: true, description: true, status: true },
    take: 15
  });
  
  console.log('\n📋 DESPESAS PENDENTES (02/2026):');
  expenses.forEach(e => console.log('   - ' + e.description));
  
  // 2. Buscar contracheques de fevereiro
  const docs = await prisma.employeeDocument.findMany({
    where: {
      documentType: 'CONTRACHEQUE',
      title: { contains: '2/2026' }
    },
    include: {
      employee: { select: { name: true } },
      documentAck: true
    }
  });
  
  console.log('\n📄 CONTRACHEQUES (02/2026):');
  docs.forEach(d => {
    console.log('   - ' + d.employee.name + ': "' + d.title + '" | Assinado: ' + (d.documentAck ? 'SIM' : 'NAO'));
  });
  
  // 3. Testar extração do nome da descrição (como a API faz)
  console.log('\n🔍 TESTE DE EXTRAÇÃO DE NOMES:');
  expenses.forEach(e => {
    const match = e.description.match(/-\s*(.+?)\s*\(/);
    const name = match ? match[1].trim() : 'NAO ENCONTRADO';
    console.log('   - Desc: "' + e.description + '"');
    console.log('     => Nome extraído: "' + name + '"');
  });
  
  await prisma.$disconnect();
}
check();
