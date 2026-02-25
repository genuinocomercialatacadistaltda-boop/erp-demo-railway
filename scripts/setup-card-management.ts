
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Configurando sistema de gestão de cartões...\n');

  // 1. Criar conta bancária Itaú
  console.log('1. Criando conta bancária Itaú...');
  const itauAccount = await prisma.bankAccount.upsert({
    where: {
      id: 'itau-card-account',
    },
    update: {},
    create: {
      id: 'itau-card-account',
      name: 'Itaú',
      accountType: 'CHECKING',
      bankName: 'Itaú',
      balance: 0,
      isActive: true,
      description: 'Conta para recebimento de pagamentos com cartão (débito e crédito)',
      color: '#EC7000', // Laranja do Itaú
    },
  });
  console.log('✅ Conta Itaú criada:', itauAccount.name);

  // 2. Configurar taxas de cartão (valores padrão)
  console.log('\n2. Configurando taxas de cartão...');
  
  // Taxa de débito: 0,9%
  const debitFee = await prisma.cardFeeConfig.upsert({
    where: {
      id: 'debit-fee-config',
    },
    update: {
      feePercentage: 0.9,
      isActive: true,
    },
    create: {
      id: 'debit-fee-config',
      cardType: 'DEBIT',
      feePercentage: 0.9,
      isActive: true,
    },
  });
  console.log('✅ Taxa de débito configurada:', debitFee.feePercentage + '%');

  // Taxa de crédito: 3,24%
  const creditFee = await prisma.cardFeeConfig.upsert({
    where: {
      id: 'credit-fee-config',
    },
    update: {
      feePercentage: 3.24,
      isActive: true,
    },
    create: {
      id: 'credit-fee-config',
      cardType: 'CREDIT',
      feePercentage: 3.24,
      isActive: true,
    },
  });
  console.log('✅ Taxa de crédito configurada:', creditFee.feePercentage + '%');

  console.log('\n✅ Sistema de gestão de cartões configurado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao configurar sistema:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
