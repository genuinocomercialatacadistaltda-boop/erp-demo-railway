export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API para verificação automática de sincronização entre Boletos e Receivables
 * 
 * GET /api/admin/verificar-receivables
 * 
 * Este endpoint verifica e corrige automaticamente receivables que deveriam
 * estar como PAID mas ainda estão PENDING/OVERDUE, quando seus boletos já foram pagos.
 */
export async function GET() {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('🔍 [API] Iniciando verificação de sincronização Boletos <-> Receivables...');
    
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

    console.log(`📋 [API] Encontrados ${boletosPagos.length} boletos pagos no sistema`);

    let inconsistenciasEncontradas = 0;
    let receivablesCorrigidos = 0;
    const detalhesCorrecoes: any[] = [];

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
        
        console.log(`🚨 [API] INCONSISTÊNCIA: Boleto ${boleto.boletoNumber} PAID mas ${receivablesNaoPagos.length} receivable(s) não pagos`);
        
        const correcao: any = {
          boleto: {
            number: boleto.boletoNumber,
            amount: boleto.amount,
            customer: boleto.Customer.name
          },
          receivablesCorrigidos: []
        };

        // Corrigir cada receivable não pago
        for (const receivable of receivablesNaoPagos) {
          console.log(`   🔧 [API] Corrigindo receivable ${receivable.id} (${receivable.description})`);

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
          correcao.receivablesCorrigidos.push({
            id: receivable.id,
            description: receivable.description,
            amount: receivable.amount,
            statusAnterior: receivable.status
          });
        }
        
        detalhesCorrecoes.push(correcao);
      }
    }

    // 3. Resposta final
    const resultado = {
      success: true,
      timestamp: new Date(),
      resumo: {
        totalBoletosPagosVerificados: boletosPagos.length,
        inconsistenciasEncontradas,
        receivablesCorrigidos
      },
      detalhes: detalhesCorrecoes,
      mensagem: inconsistenciasEncontradas === 0 
        ? '✅ Sistema 100% sincronizado! Nenhuma inconsistência encontrada.'
        : `⚠️ ${inconsistenciasEncontradas} inconsistência(s) foram encontradas e corrigidas automaticamente.`
    };

    console.log(`✅ [API] Verificação concluída: ${resultado.mensagem}`);

    return NextResponse.json(resultado);

  } catch (error) {
    console.error('❌ [API] Erro na verificação:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao verificar receivables',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
