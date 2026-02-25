import { prisma } from '../lib/prisma';

async function check() {
  // Buscar William
  const william = await prisma.employee.findFirst({
    where: { name: { contains: 'willam', mode: 'insensitive' } },
    select: { id: true, name: true, email: true }
  });
  console.log('Funcionário William:', william);
  
  if (william) {
    // Buscar metas do William
    const goals = await prisma.productionGoal.findMany({
      where: { employeeId: william.id },
      include: { product: { select: { name: true } } }
    });
    console.log('\nMetas de produção (ProductionGoal) para William:', goals.length);
    goals.forEach(g => {
      console.log('  -', g.id, '| Tipo:', g.goalType, '| Meta:', g.targetQuantity, '| Período:', g.period, '| Ativa:', g.isActive, '| Produto:', g.product?.name || 'N/A');
    });
  }
  
  // Verificar todas as metas individuais ativas
  console.log('\n\n=== TODAS AS METAS INDIVIDUAIS ATIVAS ===');
  const allGoals = await prisma.productionGoal.findMany({
    where: { 
      goalType: 'INDIVIDUAL',
      isActive: true 
    },
    include: { 
      employee: { select: { id: true, name: true } },
      product: { select: { name: true } } 
    }
  });
  console.log('Total de metas individuais ativas:', allGoals.length);
  allGoals.forEach(g => {
    console.log('  -', g.employee?.name, '| Meta:', g.targetQuantity, '| Período:', g.period);
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
