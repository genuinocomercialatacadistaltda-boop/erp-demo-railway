import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  // Buscar despesas de funcionários de fevereiro que estão com competência em março
  const expenses = await prisma.expense.findMany({
    where: {
      description: { contains: '(2/2026)' },
      Category: { name: { contains: 'Pagamento de Funcionários', mode: 'insensitive' } }
    }
  });
  
  console.log(`📋 ${expenses.length} despesas de funcionários encontradas para 02/2026`);
  
  // Data correta de competência: 15/02/2026
  const correctCompetence = new Date(2026, 1, 15, 12, 0, 0); // mês 1 = fevereiro
  
  let updated = 0;
  for (const exp of expenses) {
    const currentMonth = exp.competenceDate?.getMonth();
    
    // Se competenceDate é março (mês 2) ou não existe, corrigir para fevereiro
    if (!exp.competenceDate || currentMonth !== 1) {
      await prisma.expense.update({
        where: { id: exp.id },
        data: { competenceDate: correctCompetence }
      });
      console.log(`   ✅ Corrigido: ${exp.description}`);
      updated++;
    } else {
      console.log(`   ⏭️ Já correto: ${exp.description}`);
    }
  }
  
  console.log(`\n✅ ${updated} despesas atualizadas para competência 02/2026`);
  
  await prisma.$disconnect();
}
fix();
