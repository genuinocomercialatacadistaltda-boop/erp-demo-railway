import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar folhas de ponto de janeiro 2026
  const timesheets = await prisma.timesheet.findMany({
    where: { 
      startDate: { gte: new Date('2026-01-01') },
      endDate: { lte: new Date('2026-01-31') }
    },
    include: { 
      employee: { select: { name: true } },
      acknowledgments: true 
    }
  });
  
  console.log('\n📋 FOLHAS DE PONTO DE JANEIRO/2026:');
  console.log('Funcionário | Assinado?');
  console.log('-'.repeat(60));
  
  timesheets.forEach(t => {
    const hasAck = t.acknowledgments.length > 0 ? '✅ SIM' : '❌ NÃO';
    console.log(`${t.employee.name.padEnd(40)} | ${hasAck}`);
  });
  
  // Verificar onde é checado status
  console.log('\n\n📄 DOCUMENTOS (EmployeeDocument):');
  const docs = await prisma.employeeDocument.findMany({
    where: { 
      documentType: 'FOLHA_PONTO',
      title: { contains: 'janeiro' }
    },
    include: { 
      employee: { select: { name: true } },
      acknowledgments: true
    }
  });
  
  docs.forEach(d => {
    const hasAck = d.acknowledgments.length > 0 ? '✅' : '❌';
    console.log(`${d.employee.name.padEnd(30)} | ${d.title.padEnd(30)} | ${hasAck}`);
  });
  
  await prisma.$disconnect();
}
check();
