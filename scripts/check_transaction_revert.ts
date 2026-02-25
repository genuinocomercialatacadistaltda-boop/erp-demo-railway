import { prisma } from '../lib/prisma';

async function check() {
  // Buscar transações recentes de INCOME 
  console.log('=== TRANSAÇÕES DE INCOME RECENTES ===');
  const transactions = await prisma.transaction.findMany({
    where: {
      type: 'INCOME',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    include: {
      BankAccount: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  transactions.forEach(t => {
    console.log('\n---');
    console.log('ID:', t.id);
    console.log('Descrição:', t.description?.substring(0, 50));
    console.log('Valor:', t.amount);
    console.log('Conta:', t.BankAccount?.name);
    console.log('referenceType:', t.referenceType);
    console.log('referenceId:', t.referenceId);
    console.log('Criado:', t.createdAt);
  });

  // Verificar se existem transações sem referenceType ou referenceId
  console.log('\n\n=== TRANSAÇÕES SEM REFERENCE TYPE/ID ===');
  const orphanTransactions = await prisma.transaction.findMany({
    where: {
      type: 'INCOME',
      OR: [
        { referenceType: null },
        { referenceId: null }
      ]
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Transações órfãs:', orphanTransactions.length);
  orphanTransactions.forEach(t => {
    console.log('  -', t.description?.substring(0, 40), '| refType:', t.referenceType, '| refId:', t.referenceId);
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
