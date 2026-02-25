import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const correctCategoryId = 'cmky1nvj70000vbyw7b8py7wr'; // Salario/Funcionarios/Beneficios
  const todayCompetence = new Date(2026, 1, 20, 12, 0, 0); // 20/02/2026
  
  // Buscar despesas de funcionários de 02/2026 que foram pagas HOJE
  const expenses = await prisma.expense.findMany({
    where: {
      description: { contains: '(2/2026)' },
      status: 'PAID',
      paymentDate: {
        gte: new Date(2026, 1, 20, 0, 0, 0),
        lt: new Date(2026, 1, 21, 0, 0, 0)
      }
    }
  });
  
  console.log(`📋 ${expenses.length} despesas de funcionários PAGAS HOJE encontradas`);
  
  let updated = 0;
  for (const exp of expenses) {
    await prisma.expense.update({
      where: { id: exp.id },
      data: { 
        categoryId: correctCategoryId,
        competenceDate: todayCompetence // Competência = data do pagamento (HOJE)
      }
    });
    console.log(`   ✅ Corrigido: ${exp.description}`);
    updated++;
  }
  
  console.log(`\n✅ ${updated} despesas atualizadas!`);
  console.log(`   - Categoria: Salario/Funcionarios/Beneficios`);
  console.log(`   - Competência: 20/02/2026`);
  
  await prisma.$disconnect();
}
fix();
