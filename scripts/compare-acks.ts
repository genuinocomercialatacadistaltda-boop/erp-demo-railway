import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Buscar folhas de ponto de janeiro
  const timesheets = await prisma.timesheet.findMany({
    where: { 
      startDate: { gte: new Date('2026-01-01') },
      endDate: { lte: new Date('2026-01-31') }
    },
    include: { 
      employee: { select: { id: true, name: true } }
    }
  });
  
  console.log('\n📋 Comparação: Timesheet vs EmployeeDocument');
  console.log('-'.repeat(80));
  
  for (const ts of timesheets) {
    // Buscar documento correspondente
    const doc = await prisma.employeeDocument.findFirst({
      where: {
        employeeId: ts.employeeId,
        documentType: 'FOLHA_PONTO',
        title: { contains: '01/01/2026' }
      },
      include: {
        acknowledgment: true
      }
    });
    
    const tsAck = await prisma.timesheetAcknowledgment.findFirst({
      where: { timesheetId: ts.id }
    });
    
    console.log(`${ts.employee.name.padEnd(30)} | Timesheet Ack: ${tsAck ? '✅' : '❌'} | Doc Ack: ${doc?.acknowledgment ? '✅' : '❌'}`);
  }
  
  await prisma.$disconnect();
}
check();
