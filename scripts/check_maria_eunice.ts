import { prisma } from '../lib/prisma';

async function check() {
  // Buscar recebimentos recentes de Maria Eunice
  console.log('=== RECEBIMENTOS DE MARIA EUNICE (últimas 24h) ===');
  const receivables = await prisma.receivable.findMany({
    where: {
      OR: [
        { description: { contains: 'maria eunice', mode: 'insensitive' } },
        { Customer: { name: { contains: 'maria eunice', mode: 'insensitive' } } }
      ],
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    include: {
      Customer: { select: { name: true } },
      BankAccount: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  receivables.forEach(r => {
    console.log('\n--- Receivable ---');
    console.log('ID:', r.id);
    console.log('Descrição:', r.description);
    console.log('Cliente:', r.Customer?.name);
    console.log('Valor:', r.amount);
    console.log('Status:', r.status);
    console.log('Conta:', r.BankAccount?.name || 'Nenhuma');
    console.log('Data Pagamento:', r.paymentDate);
    console.log('Criado:', r.createdAt);
  });

  // Buscar transações recentes do Itaú
  console.log('\n\n=== TRANSAÇÕES DO ITAÚ (últimas 24h) ===');
  const itau = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'itau', mode: 'insensitive' } }
  });
  
  if (itau) {
    console.log('Conta Itaú ID:', itau.id);
    console.log('Saldo atual:', itau.balance);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        bankAccountId: itau.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\nTransações encontradas:', transactions.length);
    transactions.forEach(t => {
      console.log('\n  -', t.description);
      console.log('    Tipo:', t.type, '| Valor:', t.amount);
      console.log('    Criado:', t.createdAt);
    });
  }

  // Buscar transações recentes do Cora
  console.log('\n\n=== TRANSAÇÕES DO CORA (últimas 24h) ===');
  const cora = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  });
  
  if (cora) {
    console.log('Conta Cora ID:', cora.id);
    console.log('Saldo atual:', cora.balance);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        bankAccountId: cora.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('\nTransações encontradas:', transactions.length);
    transactions.forEach(t => {
      console.log('\n  -', t.description?.substring(0, 50));
      console.log('    Tipo:', t.type, '| Valor:', t.amount);
      console.log('    Criado:', t.createdAt);
    });
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
