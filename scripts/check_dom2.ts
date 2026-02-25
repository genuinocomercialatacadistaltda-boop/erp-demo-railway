import { prisma } from '../lib/prisma';

async function check() {
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'DOM VITTALLE', mode: 'insensitive' } },
    select: { id: true, name: true, creditLimit: true, canPayWithBoleto: true }
  });
  console.log('DOM VITTALLE no banco:', customer);
}
check().catch(console.error).finally(() => prisma.$disconnect());
