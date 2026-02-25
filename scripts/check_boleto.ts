import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  // Buscar boleto específico
  const boleto = await prisma.boleto.findFirst({
    where: { boletoNumber: 'BOL68865353' },
    include: { Customer: true, Order: true }
  });
  
  console.log('=== BOLETO ===');
  console.log(JSON.stringify(boleto, null, 2));
  
  // Buscar receivable vinculado ao boleto
  if (boleto) {
    const receivable = await prisma.receivable.findFirst({
      where: { boletoId: boleto.id }
    });
    console.log('\n=== RECEIVABLE VINCULADO ===');
    console.log(JSON.stringify(receivable, null, 2));
  }
  
  // Buscar todos os boletos de Simone recentes
  console.log('\n=== BOLETOS RECENTES DE SIMONE ===');
  const boletos = await prisma.boleto.findMany({
    where: {
      Customer: { name: { contains: 'Simone', mode: 'insensitive' } }
    },
    orderBy: { createdAt: 'desc' },
    include: { Customer: { select: { name: true } } }
  });
  
  boletos.forEach(b => {
    console.log(`Boleto: ${b.boletoNumber}`);
    console.log(`  Valor: R$ ${Number(b.amount).toFixed(2)}`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Data Criação: ${b.createdAt}`);
    console.log(`  Data Pagamento: ${b.paidDate}`);
    console.log('---');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
