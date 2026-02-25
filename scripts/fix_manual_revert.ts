import { prisma } from '../lib/prisma';

async function fixManualRevert() {
  console.log('=== CORREÇÃO MANUAL DE REVERSÃO ===\n');

  // 1. Corrigir Itaú - R$ 2.542,50
  const itau = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'Itaú', mode: 'insensitive' } }
  });

  if (itau) {
    console.log('🏦 ITAÚ:');
    console.log('   Saldo atual:', itau.balance);
    const novoSaldoItau = Number(itau.balance) - 2542.50;
    
    await prisma.bankAccount.update({
      where: { id: itau.id },
      data: { balance: novoSaldoItau }
    });
    console.log('   Novo saldo:', novoSaldoItau);
    console.log('   ✅ Revertido R$ 2.542,50');
  }

  // 2. Corrigir Dinheiro Guardado - R$ 0,50
  const dinheiroGuardado = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'dinheiro guardado', mode: 'insensitive' } }
  });

  if (dinheiroGuardado) {
    console.log('\n🏦 DINHEIRO GUARDADO:');
    console.log('   Saldo atual:', dinheiroGuardado.balance);
    const novoSaldoDG = Number(dinheiroGuardado.balance) - 0.50;
    
    await prisma.bankAccount.update({
      where: { id: dinheiroGuardado.id },
      data: { balance: novoSaldoDG }
    });
    console.log('   Novo saldo:', novoSaldoDG);
    console.log('   ✅ Revertido R$ 0,50');
  }

  console.log('\n=== CORREÇÃO CONCLUÍDA ===');
}

fixManualRevert().catch(console.error).finally(() => prisma.$disconnect());
