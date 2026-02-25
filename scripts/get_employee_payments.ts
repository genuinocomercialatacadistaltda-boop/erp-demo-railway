import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.employeePayment.findMany({
    include: {
      employee: {
        select: { id: true, name: true, cpf: true, position: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('Total EmployeePayments:', payments.length);
  for (const p of payments) {
    console.log(`\n=== ${p.employee.name} ===`);
    console.log(`ID: ${p.id}`);
    console.log(`Salary: ${p.salaryAmount}`);
    console.log(`Advance: ${p.advanceAmount}`);
    console.log(`Food Voucher: ${p.foodVoucherAmount}`);
    console.log(`Bonus: ${p.bonusAmount}`);
    console.log(`INSS: ${p.inssAmount || 0}`);
    console.log(`IRRF: ${p.irrfAmount || 0}`);
    console.log(`Other Discounts: ${p.otherDiscountsAmount || 0}`);
    console.log(`Total: ${p.totalAmount}`);
    console.log(`Discount Items: ${JSON.stringify(p.discountItems)}`);
    console.log(`Earnings Items: ${JSON.stringify(p.earningsItems)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
