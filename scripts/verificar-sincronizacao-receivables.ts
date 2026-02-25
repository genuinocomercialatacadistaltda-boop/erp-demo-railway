import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

/**
 * Script de verificação automática de sincronização entre Boletos e Receivables
 * 
 * Este script deve rodar periodicamente (ex: a cada 1 hora) para garantir que:
 * 1. Todos os receivables de boletos PAID também estejam PAID
 * 2. Corrigir automaticamente qualquer inconsistência encontrada
 */
export async function verificarESincronizarReceivables() {
  try {
    console.log('🔍 [VERIFICAÇÃO] Iniciando verificação de sincronização Boletos <-> Receivables...\n');
    
    // 1. Buscar todos os boletos PAID
    const boletosPagos = await prisma.boleto.findMany({
      where: {
        status: 'PAID'
      },
      include: {
        Customer: true,
        Order: true
      }
    });

    console.log(`📋 Encontrados ${boletosPagos.length} boletos pagos no sistema\n`);

    let inconsistenciasEncontradas = 0;
    let receivablesCorrigidos = 0;

    // 2. Para cada boleto pago, verificar se os receivables também estão pagos
    for (const boleto of boletosPagos) {
      // Buscar receivables relacionados (por orderId ou boletoId)
      const receivables = await prisma.receivable.findMany({
        where: {
          OR: [
            { orderId: boleto.orderId || undefined },
            { boletoId: boleto.id }
          ]
        }
      });

      // Verificar se algum receivable ainda está PENDING ou OVERDUE
      const receivablesNaoPagos = receivables.filter(r => r.status !== 'PAID');

      if (receivablesNaoPagos.length > 0) {
        inconsistenciasEncontradas++;
        
        console.log(`🚨 INCONSISTÊNCIA ENCONTRADA:`);
        console.log(`   Boleto: ${boleto.boletoNumber} (Status: PAID)`);
        console.log(`   Cliente: ${boleto.Customer.name}`);
        console.log(`   Valor: R$ ${boleto.amount.toFixed(2)}`);
        console.log(`   Pedido: ${boleto.Order?.orderNumber || 'N/A'}`);
        console.log(`   Receivables não pagos: ${receivablesNaoPagos.length}`);
        
        // Corrigir cada receivable não pago
        for (const receivable of receivablesNaoPagos) {
          console.log(`\n   🔧 Corrigindo receivable:`);
          console.log(`      ID: ${receivable.id}`);
          console.log(`      Descrição: ${receivable.description}`);
          console.log(`      Status atual: ${receivable.status}`);
          console.log(`      Valor: R$ ${receivable.amount.toFixed(2)}`);

          // Atualizar para PAID
          await prisma.receivable.update({
            where: { id: receivable.id },
            data: {
              status: 'PAID',
              paymentDate: boleto.paidDate || new Date(),
              updatedAt: new Date()
            }
          });

          receivablesCorrigidos++;
          console.log(`      ✅ Atualizado para PAID`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
      }
    }

    // 3. Resumo final
    console.log('📊 RESUMO DA VERIFICAÇÃO:');
    console.log(`   Total de boletos pagos verificados: ${boletosPagos.length}`);
    console.log(`   Inconsistências encontradas: ${inconsistenciasEncontradas}`);
    console.log(`   Receivables corrigidos: ${receivablesCorrigidos}`);
    
    if (inconsistenciasEncontradas === 0) {
      console.log('\n✅ Sistema 100% sincronizado! Nenhuma inconsistência encontrada.');
    } else {
      console.log(`\n⚠️ ${inconsistenciasEncontradas} inconsistência(s) foram encontradas e corrigidas automaticamente.`);
    }

    return {
      totalBoletosPagos: boletosPagos.length,
      inconsistenciasEncontradas,
      receivablesCorrigidos,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  verificarESincronizarReceivables()
    .then(result => {
      console.log('\n✅ Verificação concluída com sucesso!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}
