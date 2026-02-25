
/**
 * API Route para verificar boletos pendentes de um cliente específico
 * 
 * ⚠️ MODO CONSULTA_APENAS - PROCESSAMENTO MANUAL OBRIGATÓRIO
 * Este endpoint apenas CONSULTA o status no Cora e informa quais boletos foram pagos.
 * NÃO faz NENHUMA atualização automática no sistema.
 * 
 * A secretária do financeiro deve:
 * 1. Verificar o extrato do Cora
 * 2. Dar entrada manualmente no recebível
 * 3. Vincular à conta bancária correta
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getPixCharge } from '@/lib/cora';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 [CHECK-BOLETOS] MODO CONSULTA_APENAS - Sem atualizações automáticas')
    
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const customerId = params.id;

    // Verifica se o usuário tem permissão (deve ser o próprio cliente ou admin)
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      include: { Customer: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const isAdmin = user.userType === 'ADMIN';
    const isOwnCustomer = user.Customer?.id === customerId;

    if (!isAdmin && !isOwnCustomer) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Busca boletos pendentes do cliente que têm pixPaymentId
    const boletosPendentes = await prisma.boleto.findMany({
      where: {
        customerId,
        status: 'PENDING',
        pixPaymentId: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (boletosPendentes.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'CONSULTA_APENAS',
        message: 'Nenhum boleto pendente encontrado',
        boletosVerificados: 0,
        boletosParaProcessarManualmente: [],
      });
    }

    const boletosParaProcessarManualmente: any[] = [];

    // Verifica cada boleto no CORA (APENAS CONSULTA - SEM ATUALIZAÇÃO)
    for (const boleto of boletosPendentes) {
      if (!boleto.pixPaymentId) continue;

      try {
        const statusCora = await getPixCharge(boleto.pixPaymentId);

        console.log(`📋 Boleto ${boleto.boletoNumber}:`)
        console.log(`   Status no Cora: ${statusCora.status}`)
        console.log(`   Status no Sistema: ${boleto.status}`)

        if (statusCora.status === 'PAID') {
          console.log(`   ⚠️ PAGO NO CORA - PROCESSAR MANUALMENTE!`)
          boletosParaProcessarManualmente.push({
            boletoNumber: boleto.boletoNumber,
            amount: Number(boleto.amount),
            statusCora: statusCora.status,
            statusSistema: boleto.status,
            mensagem: '⚠️ PAGO NO CORA! Dar entrada MANUAL no financeiro.'
          })
        }
        
        // ⚠️ NÃO ATUALIZA NADA AUTOMATICAMENTE!
        // Nem status de boleto, nem crédito de cliente, nem cria transações

        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`Erro ao verificar boleto ${boleto.id}:`, error);
      }
    }

    console.log(`
    📊 [CHECK-BOLETOS] Relatório (MODO CONSULTA):
    - Boletos pendentes: ${boletosPendentes.length}
    - Boletos PAGOS no Cora: ${boletosParaProcessarManualmente.length}
    
    ⚠️ NENHUMA ATUALIZAÇÃO AUTOMÁTICA FOI FEITA!
    A secretária deve processar os boletos MANUALMENTE.
    `)

    return NextResponse.json({
      success: true,
      mode: 'CONSULTA_APENAS',
      message: boletosParaProcessarManualmente.length > 0 
        ? `${boletosParaProcessarManualmente.length} boleto(s) pago(s) no Cora. PROCESSAR MANUALMENTE!`
        : 'Boletos verificados, nenhum pagamento novo encontrado',
      boletosVerificados: boletosPendentes.length,
      boletosParaProcessarManualmente,
      aviso: '⚠️ NENHUMA ATUALIZAÇÃO AUTOMÁTICA FOI FEITA. Processar manualmente no financeiro.'
    });

  } catch (error: any) {
    console.error('Erro ao verificar boletos do cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar boletos', details: error.message },
      { status: 500 }
    );
  }
}
