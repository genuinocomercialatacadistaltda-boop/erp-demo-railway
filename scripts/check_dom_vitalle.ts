import { prisma } from '../lib/prisma';

async function check() {
  // Buscar cliente com "dom" ou "vitalle" no nome
  const customers = await prisma.customer.findMany({
    where: { 
      OR: [
        { name: { contains: 'dom', mode: 'insensitive' } },
        { name: { contains: 'vitalle', mode: 'insensitive' } }
      ]
    },
    select: { 
      id: true, 
      name: true, 
      creditLimit: true, 
      canPayWithBoleto: true,
      availableCredit: true 
    },
    take: 10
  });
  
  console.log('Clientes encontrados:', customers.length);
  customers.forEach(c => {
    console.log('\n---');
    console.log('Nome:', c.name);
    console.log('creditLimit:', c.creditLimit);
    console.log('canPayWithBoleto:', c.canPayWithBoleto);
    console.log('availableCredit:', c.availableCredit);
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
