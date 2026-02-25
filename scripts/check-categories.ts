import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Verificar categorias existentes
  const categories = await prisma.expenseCategory.findMany({
    where: {
      OR: [
        { name: { contains: 'funcionário', mode: 'insensitive' } },
        { name: { contains: 'salário', mode: 'insensitive' } },
        { name: { contains: 'pagamento', mode: 'insensitive' } }
      ]
    }
  });
  
  console.log('\n📋 CATEGORIAS RELACIONADAS A FUNCIONÁRIOS:');
  categories.forEach(c => console.log(`   ID: ${c.id} | Nome: "${c.name}" | Tipo: ${c.expenseType}`));
  
  // Verificar despesas de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  console.log('\n📅 DESPESAS DE HOJE (20/02/2026):');
  const todayExpenses = await prisma.expense.findMany({
    where: {
      OR: [
        { competenceDate: { gte: today, lt: tomorrow } },
        { paymentDate: { gte: today, lt: tomorrow } },
        { dueDate: { gte: today, lt: tomorrow } }
      ]
    },
    include: { Category: true }
  });
  
  console.log(`   Total: ${todayExpenses.length} despesas`);
  todayExpenses.slice(0, 10).forEach(e => {
    console.log(`   - ${e.description} | competenceDate: ${e.competenceDate?.toLocaleDateString('pt-BR')} | dueDate: ${e.dueDate?.toLocaleDateString('pt-BR')} | Cat: ${e.Category?.name}`);
  });
  
  // Verificar despesas de funcionários de 02/2026
  console.log('\n💰 DESPESAS DE FUNCIONÁRIOS 02/2026:');
  const empExpenses = await prisma.expense.findMany({
    where: { description: { contains: '2/2026' } },
    include: { Category: true }
  });
  
  empExpenses.slice(0, 5).forEach(e => {
    console.log(`   - ${e.description}`);
    console.log(`     competenceDate: ${e.competenceDate?.toLocaleDateString('pt-BR')} | dueDate: ${e.dueDate?.toLocaleDateString('pt-BR')}`);
    console.log(`     Categoria: ${e.Category?.name}`);
  });
  
  await prisma.$disconnect();
}
check();
