import { prisma } from '../lib/prisma';

async function fix() {
  const updated = await prisma.customer.updateMany({
    where: { name: { contains: 'DOM VITTALLE', mode: 'insensitive' } },
    data: { canPayWithBoleto: true }
  });
  
  console.log('✅ Cliente atualizado:', updated.count);
  
  // Verificar
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'DOM VITTALLE', mode: 'insensitive' } },
    select: { name: true, creditLimit: true, canPayWithBoleto: true }
  });
  console.log('Novo status:', customer);
}
fix().catch(console.error).finally(() => prisma.$disconnect());
