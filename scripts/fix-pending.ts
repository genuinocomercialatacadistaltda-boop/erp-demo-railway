import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const correctCategoryId = 'cmky1nvj70000vbyw7b8py7wr'; // Salario/Funcionarios/Beneficios
  
  // Buscar despesas de funcionários PENDENTES de 02/2026
  const expenses = await prisma.expense.findMany({
    where: {
      description: { contains: '(2/2026)' },
      status: 'PENDING'
    }
  });
  
  console.log(`📋 ${expenses.length} despesas de funcionários PENDENTES encontradas`);
  
  let updated = 0;
  for (const exp of expenses) {
    // Competência = data de vencimento
    await prisma.expense.update({
      where: { id: exp.id },
      data: { 
        categoryId: correctCategoryId,
        competenceDate: exp.dueDate // Competência = data de vencimento
      }
    });
    console.log(`   ✅ ${exp.description} | Competência: ${exp.dueDate?.toLocaleDateString('pt-BR')}`);
    updated++;
  }
  
  console.log(`\n✅ ${updated} despesas pendentes atualizadas!`);
  
  await prisma.$disconnect();
}
fix();
