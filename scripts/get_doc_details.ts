import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.employeeDocument.findMany({
    where: {
      documentType: 'CONTRACHEQUE'
    },
    include: {
      employee: {
        select: { id: true, name: true, cpf: true, position: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Total contracheques:', docs.length);
  for (const d of docs) {
    const meta = d.metadata as any || {};
    console.log(`\n=== ${d.employee.name} ===`);
    console.log(`ID: ${d.id}`);
    console.log(`Salary: ${meta.salary || meta.baseSalary}`);
    console.log(`Discounts: ${JSON.stringify(meta.discountItems || [])}`);
    console.log(`Earnings: ${JSON.stringify(meta.earningsItems || [])}`);
    console.log(`Net: ${meta.netAmount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
