import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Verificar assinaturas na tabela correta
  console.log('\n📝 TimesheetAcknowledgment (TODAS):');
  const tsAcks = await prisma.timesheetAcknowledgment.findMany({
    include: { employee: { select: { name: true } } }
  });
  console.log(`Total: ${tsAcks.length}`);
  tsAcks.forEach(a => console.log(`   ${a.employee.name} | ${a.timesheetId}`));
  
  // Verificar DocumentAcknowledgment
  console.log('\n📝 DocumentAcknowledgment (TODAS):');
  const docAcks = await prisma.documentAcknowledgment.findMany({
    include: { document: { select: { title: true, documentType: true } } }
  });
  console.log(`Total: ${docAcks.length}`);
  docAcks.slice(0, 20).forEach(a => console.log(`   ${a.document.title} | ${a.document.documentType}`));
  
  await prisma.$disconnect();
}
check();
