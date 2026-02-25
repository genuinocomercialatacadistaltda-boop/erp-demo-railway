
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Criando categoria de Taxa de Cartão...\n');

  const category = await prisma.expenseCategory.upsert({
    where: {
      name: 'Taxa de Cartão',
    },
    update: {
      isActive: true,
    },
    create: {
      name: 'Taxa de Cartão',
      description: 'Taxas cobradas por transações com cartão (débito e crédito)',
      expenseType: 'OPERATIONAL',
      isActive: true,
    },
  });

  console.log('✅ Categoria criada:', category.name);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
