import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  // Buscar cliente
  const customer = await prisma.customer.findFirst({
    where: { 
      name: { contains: 'Simone', mode: 'insensitive' }
    }
  });
  console.log('=== CLIENTE ===');
  console.log(JSON.stringify(customer, null, 2));

  if (customer) {
    // Buscar todos os receivables do cliente
    const receivables = await prisma.receivable.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' }
    });
    console.log('\n=== RECEIVABLES DO CLIENTE ===');
    receivables.forEach(r => {
      console.log(`ID: ${r.id}`);
      console.log(`  Descrição: ${r.description}`);
      console.log(`  Valor: R$ ${Number(r.amount).toFixed(2)}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  NetAmount: ${r.netAmount ? 'R$ ' + Number(r.netAmount).toFixed(2) : 'N/A'}`);
      console.log(`  PaymentDate: ${r.paymentDate}`);
      console.log(`  CreatedAt: ${r.createdAt}`);
      console.log(`  Notes: ${r.notes}`);
      console.log('---');
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
