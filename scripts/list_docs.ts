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
        select: { id: true, name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Total contracheques:', docs.length);
  for (const d of docs) {
    console.log(`ID: ${d.id} | Emp: ${d.employee.name} | Title: ${d.title}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
