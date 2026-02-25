import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Listar TODAS as categorias
  const categories = await prisma.expenseCategory.findMany({
    orderBy: { name: 'asc' }
  });
  
  console.log('\n📋 TODAS AS CATEGORIAS DE DESPESAS:');
  categories.forEach(c => console.log(`   "${c.name}" | ID: ${c.id} | Tipo: ${c.expenseType}`));
  
  await prisma.$disconnect();
}
check();
