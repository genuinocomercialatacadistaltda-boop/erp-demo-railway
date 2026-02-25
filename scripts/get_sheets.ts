import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const sheets = await prisma.payrollSheet.findMany({
    include: {
      payments: {
        include: {
          employee: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('Total PayrollSheets:', sheets.length);
  for (const s of sheets) {
    console.log(`\nSheet ID: ${s.id}`);
    console.log(`File: ${s.fileName}`);
    console.log(`URL: ${s.fileUrl}`);
    console.log(`Processed: ${s.isProcessed}`);
    console.log(`Payments: ${s.payments.length}`);
    for (const p of s.payments) {
      console.log(`  - ${p.employee.name}: salary=${p.salaryAmount}, total=${p.totalAmount}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
