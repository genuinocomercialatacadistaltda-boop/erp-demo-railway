import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  // Buscar receivables com valores específicos (1335, 1200, 135)
  const receivables = await prisma.receivable.findMany({
    where: {
      OR: [
        { amount: { gte: 1330, lte: 1340 } },
        { amount: { gte: 1195, lte: 1205 } },
        { amount: { gte: 130, lte: 140 } }
      ]
    },
    include: {
      Customer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('=== RECEIVABLES COM VALORES ESPECÍFICOS ===');
  receivables.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`  Cliente: ${r.Customer?.name || 'N/A'}`);
    console.log(`  Descrição: ${r.description}`);
    console.log(`  Valor: R$ ${Number(r.amount).toFixed(2)}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  NetAmount: ${r.netAmount ? 'R$ ' + Number(r.netAmount).toFixed(2) : 'N/A'}`);
    console.log(`  PaymentDate: ${r.paymentDate}`);
    console.log(`  CreatedAt: ${r.createdAt}`);
    console.log('---');
  });
  
  // Buscar também transações bancárias recentes
  console.log('\n=== TRANSAÇÕES BANCÁRIAS RECENTES ===');
  const transactions = await prisma.transaction.findMany({
    where: {
      amount: { gte: 1195, lte: 1340 }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      BankAccount: { select: { name: true } }
    }
  });
  
  transactions.forEach(t => {
    console.log(`ID: ${t.id}`);
    console.log(`  Conta: ${t.BankAccount?.name}`);
    console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`);
    console.log(`  Tipo: ${t.type}`);
    console.log(`  Descrição: ${t.description}`);
    console.log(`  Data: ${t.date}`);
    console.log(`  ReferenceId: ${t.referenceId}`);
    console.log('---');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
