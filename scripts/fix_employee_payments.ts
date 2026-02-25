import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmployeePayments() {
  console.log('🔍 Buscando pagamentos não marcados como pagos...\n');

  // Buscar todos os EmployeePayments com isPaid = false
  const pendingPayments = await prisma.employeePayment.findMany({
    where: { isPaid: false },
    include: {
      employee: { select: { name: true } }
    }
  });

  console.log(`Encontrados ${pendingPayments.length} pagamentos com isPaid = false\n`);

  let fixed = 0;
  let stillPending = 0;

  for (const payment of pendingPayments) {
    const expenseIds = [
      payment.salaryExpenseId,
      payment.advanceExpenseId,
      payment.foodVoucherExpenseId,
      payment.bonusExpenseId
    ].filter(Boolean);

    if (expenseIds.length === 0) {
      console.log(`⚠️ ${payment.employee.name} (${payment.month}/${payment.year}): Sem despesas vinculadas`);
      stillPending++;
      continue;
    }

    // Buscar status das despesas vinculadas
    const expenses = await prisma.expense.findMany({
      where: { id: { in: expenseIds as string[] } },
      select: { id: true, status: true, description: true }
    });

    const allPaid = expenses.length > 0 && expenses.every(exp => exp.status === 'PAID');
    const paidCount = expenses.filter(exp => exp.status === 'PAID').length;

    if (allPaid) {
      // Atualizar o EmployeePayment para isPaid = true
      await prisma.employeePayment.update({
        where: { id: payment.id },
        data: {
          isPaid: true,
          paidAt: new Date()
        }
      });
      console.log(`✅ ${payment.employee.name} (${payment.month}/${payment.year}): CORRIGIDO - ${paidCount}/${expenseIds.length} despesas pagas`);
      fixed++;
    } else {
      console.log(`⏳ ${payment.employee.name} (${payment.month}/${payment.year}): ${paidCount}/${expenseIds.length} despesas pagas`);
      stillPending++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Corrigidos: ${fixed}`);
  console.log(`   ⏳ Ainda pendentes: ${stillPending}`);
}

fixEmployeePayments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
