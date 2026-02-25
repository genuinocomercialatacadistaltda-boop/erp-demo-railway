import { prisma } from '../lib/prisma';

async function fix() {
  await prisma.customer.updateMany({
    where: { name: { contains: 'DOM VITTALLE', mode: 'insensitive' } },
    data: { canPayWithBoleto: true }
  });
  
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'DOM VITTALLE', mode: 'insensitive' } },
    select: { name: true, canPayWithBoleto: true }
  });
  console.log('✅ Atualizado:', customer);
}
fix().catch(console.error).finally(() => prisma.$disconnect());
