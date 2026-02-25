import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Ver todos os documentos FOLHA_PONTO com seus acknowledgments
  const docs = await prisma.employeeDocument.findMany({
    where: { documentType: 'FOLHA_PONTO' },
    include: {
      employee: { select: { name: true } },
      acknowledgment: true
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  
  console.log('\n📋 DOCUMENTOS FOLHA_PONTO (mais recentes):');
  console.log('Funcionário | Título | Assinado?');
  console.log('-'.repeat(90));
  
  for (const d of docs) {
    const ack = d.acknowledgment ? '✅' : '❌';
    console.log(`${d.employee.name.padEnd(30)} | ${d.title.substring(0, 35).padEnd(35)} | ${ack}`);
  }
  
  // Também verificar via DocumentAcknowledgment
  console.log('\n\n📝 DocumentAcknowledgment DIRETO:');
  const acks = await prisma.documentAcknowledgment.findMany({
    where: { document: { documentType: 'FOLHA_PONTO' } },
    include: { 
      document: { select: { title: true } },
      employee: { select: { name: true } }
    }
  });
  
  console.log(`Total de assinaturas FOLHA_PONTO: ${acks.length}`);
  acks.forEach(a => console.log(`   ${a.employee.name.padEnd(30)} | ${a.document.title}`));
  
  await prisma.$disconnect();
}
check();
