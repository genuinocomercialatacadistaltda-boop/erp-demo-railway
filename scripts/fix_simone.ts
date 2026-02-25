import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  const boletoId = '494d20e1-3c52-40a4-aa12-7041f22827f6';
  const customerId = '6c43718b-b3d1-4735-afcd-c2209349ad9a';
  const orderId = '894537eb-01d6-4300-9090-d3bd8743d011';
  
  console.log('=== CORRIGINDO DADOS DA SIMONE SOARES ===');
  
  // 1. Atualizar o boleto com o valor pago
  console.log('\n1. Atualizando boleto com paidAmount...');
  await prisma.boleto.update({
    where: { id: boletoId },
    data: {
      paidAmount: 1200,
      notes: 'Pagamento parcial de R$ 1.200,00 (saldo restante: R$ 135,00)'
    }
  });
  console.log('   ✅ Boleto atualizado com paidAmount = 1200');
  
  // 2. Criar receivable para o saldo restante
  console.log('\n2. Criando receivable para saldo restante...');
  const existingReceivable = await prisma.receivable.findFirst({
    where: {
      customerId,
      amount: 135,
      description: { contains: 'BOL68865353' }
    }
  });
  
  if (existingReceivable) {
    console.log('   ⚠️ Receivable já existe:', existingReceivable.id);
  } else {
    const receivable = await prisma.receivable.create({
      data: {
        description: 'Saldo Boleto BOL68865353 - simone soares',
        amount: 135,
        dueDate: new Date('2026-02-28'), // Dar prazo razoável
        status: 'PENDING',
        customerId,
        orderId,
        notes: 'Saldo restante do boleto BOL68865353 (Total: R$ 1.335,00, Pago: R$ 1.200,00)'
      }
    });
    console.log('   ✅ Receivable criado:', receivable.id);
    console.log('   Valor: R$ 135,00');
  }
  
  // 3. Corrigir crédito disponível (não pode exceder limite)
  console.log('\n3. Corrigindo crédito disponível da cliente...');
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });
  
  if (customer) {
    const currentCredit = Number(customer.availableCredit);
    const creditLimit = Number(customer.creditLimit);
    
    console.log('   Crédito atual:', currentCredit);
    console.log('   Limite:', creditLimit);
    
    if (currentCredit > creditLimit) {
      // Precisa descontar os R$ 135 que ainda estão em aberto + ajustar para não exceder
      // O crédito foi restaurado com base no valor total (1335) quando deveria ser só (1200)
      const overpaid = 135; // Diferença entre valor total e valor pago
      const correctedCredit = Math.min(currentCredit - overpaid, creditLimit);
      
      await prisma.customer.update({
        where: { id: customerId },
        data: { availableCredit: correctedCredit }
      });
      console.log('   ✅ Crédito corrigido para:', correctedCredit);
    }
  }
  
  console.log('\n=== CORREÇÃO CONCLUÍDA ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
