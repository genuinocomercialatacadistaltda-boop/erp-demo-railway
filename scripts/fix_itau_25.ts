import { prisma } from '../lib/prisma';

async function fix() {
  const itau = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'Itaú', mode: 'insensitive' } }
  });

  if (itau) {
    console.log('🏦 ITAÚ - Baixa de R$ 25,00');
    console.log('   Saldo atual:', itau.balance);
    const novoSaldo = Number(itau.balance) - 25.00;
    
    await prisma.bankAccount.update({
      where: { id: itau.id },
      data: { balance: novoSaldo }
    });
    console.log('   Novo saldo:', novoSaldo);
    console.log('   ✅ Baixa de R$ 25,00 concluída');
  }
}
fix().catch(console.error).finally(() => prisma.$disconnect());
