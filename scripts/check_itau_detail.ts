import { prisma } from '../lib/prisma';

async function check() {
  // Buscar conta Itaú
  const itau = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'itau', mode: 'insensitive' } }
  });
  
  if (itau) {
    console.log('=== CONTA ITAÚ ===');
    console.log('ID:', itau.id);
    console.log('Nome:', itau.name);
    console.log('Saldo ATUAL:', itau.balance);
    console.log('');
    
    // Buscar TODAS as transações do Itaú (últimos 7 dias)
    const transactions = await prisma.transaction.findMany({
      where: {
        bankAccountId: itau.id,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    console.log('Transações nos últimos 7 dias:', transactions.length);
    
    let calculatedBalance = 0;
    transactions.forEach(t => {
      const sign = t.type === 'INCOME' ? '+' : '-';
      calculatedBalance += t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount);
      console.log(`  ${sign} R$ ${t.amount} | ${t.description?.substring(0, 40)} | ${t.createdAt.toISOString().split('T')[0]}`);
    });
    
    console.log('\n=== VERIFICAÇÃO ===');
    console.log('Saldo registrado:', itau.balance);
    console.log('Se não há transações recentes, o saldo do Itaú estava R$ 0,00 ANTES do erro.');
  }

  // Verificar se algum receivable ainda está apontando para o Itaú
  console.log('\n=== RECEIVABLES APONTANDO PARA ITAÚ ===');
  const receivablesItau = await prisma.receivable.findMany({
    where: {
      bankAccountId: itau?.id,
      status: 'PAID'
    },
    include: { Customer: { select: { name: true } } },
    orderBy: { paymentDate: 'desc' },
    take: 5
  });
  
  console.log('Recebimentos pagos via Itaú:', receivablesItau.length);
  receivablesItau.forEach(r => {
    console.log(`  - R$ ${r.amount} | ${r.Customer?.name?.substring(0, 30)} | ${r.paymentDate?.toISOString().split('T')[0]}`);
  });
}
check().catch(console.error).finally(() => prisma.$disconnect());
