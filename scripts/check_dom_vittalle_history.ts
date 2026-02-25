import { prisma } from '../lib/prisma';

async function check() {
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'DOM VITTALLE', mode: 'insensitive' } },
    select: { 
      id: true,
      name: true, 
      creditLimit: true, 
      canPayWithBoleto: true,
      createdAt: true,
      updatedAt: true
    }
  });
  
  console.log('Cliente DOM VITTALLE:');
  console.log('  ID:', customer?.id);
  console.log('  Criado em:', customer?.createdAt);
  console.log('  Atualizado em:', customer?.updatedAt);
  console.log('  canPayWithBoleto:', customer?.canPayWithBoleto);
}
check().catch(console.error).finally(() => prisma.$disconnect());
