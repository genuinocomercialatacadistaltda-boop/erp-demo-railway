import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const sheets = await prisma.payrollSheet.findMany({
    include: {
      employee: {
        select: { id: true, name: true, cpf: true, position: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Total PayrollSheets:', sheets.length);
  for (const s of sheets) {
    console.log(`\n=== ${s.employee.name} ===`);
    console.log(`ID: ${s.id}`);
    console.log(`EmpID: ${s.employeeId}`);
    console.log(`Salary: ${s.salary}`);
    console.log(`INSS: ${s.inssAmount}`);
    console.log(`IRRF: ${s.irrfAmount}`);
    console.log(`Advance: ${s.advanceAmount}`);
    console.log(`Transport: ${s.transportAmount}`);
    console.log(`eConsignado: ${s.eConsignadoAmount}`);
    console.log(`Discount Items: ${JSON.stringify(s.discountItems)}`);
    console.log(`Earnings Items: ${JSON.stringify(s.earningsItems)}`);
    console.log(`Net: ${s.netAmount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
