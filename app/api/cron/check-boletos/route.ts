
/**
 * ❌ DESABILITADO - Este CRON job foi substituído pela verificação automática no login do admin
 * 
 * A verificação agora acontece automaticamente quando:
 * 1. O admin faz login (verifica todos os boletos pendentes)
 * 2. O cliente faz login (verifica os boletos do próprio cliente)
 * 3. Manualmente através do botão "Verificar Status" na Gestão de Boletos
 * 
 * ⚠️ ESTE ARQUIVO ESTÁ MANTIDO APENAS PARA REFERÊNCIA
 */

import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/db';
// import { getPixCharge } from '@/lib/cora';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'CRON job desabilitado. A verificação agora é feita automaticamente no login do admin e cliente.',
    status: 'disabled'
  }, { status: 410 });

  /* CÓDIGO ORIGINAL COMENTADO PARA REFERÊNCIA:
  
  
export async function GET_OLD(request: NextRequest) {
  try {
    // Validação de segurança - apenas aceita chamadas com token correto
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'seu-token-secreto-aqui';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('🔄 Iniciando verificação periódica de boletos...');

    // Busca todos os boletos com status PENDING que têm pixPaymentId (do CORA)
    const boletosPendentes = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        pixPaymentId: {
          not: null
        }
        // Opcional: apenas boletos criados há mais de 5 minutos
        // createdAt: {
        //   lt: new Date(Date.now() - 5 * 60 * 1000)
        // }
      },
      include: {
        Customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Encontrados ${boletosPendentes.length} boletos pendentes`);

    const resultados = {
      verificados: 0,
      pagos: 0,
      pendentes: 0,
      erros: 0,
      detalhes: [] as any[],
    };

    // Verifica cada boleto no CORA
    for (const boleto of boletosPendentes) {
      try {
        resultados.verificados++;

        console.log(`🔍 Verificando boleto ${boleto.id} (PIX Payment ID: ${boleto.pixPaymentId})`);

        // Consulta o status no CORA
        const statusCora = await getPixCharge(boleto.pixPaymentId!);

        if (statusCora.status === 'PAID') {
          console.log(`✅ Boleto ${boleto.id} foi PAGO! Atualizando...`);

          // Atualiza o boleto para PAID
          await prisma.boleto.update({
            where: { id: boleto.id },
            data: {
              status: 'PAID',
              paidDate: new Date(),
            },
          });

          // Retorna o crédito para o cliente
          await prisma.customer.update({
            where: { id: boleto.customerId },
            data: {
              availableCredit: {
                increment: boleto.amount,
              },
            },
          });

          // Registra notificação para o cliente
          await prisma.notification.create({
            data: {
              id: crypto.randomUUID(),
              targetUserId: boleto.customerId,
              targetRole: 'CUSTOMER',
              type: 'ORDER_UPDATE',
              title: 'Pagamento Confirmado! 💰',
              message: `Seu boleto de R$ ${boleto.amount.toFixed(2)} foi confirmado e o crédito já está disponível em sua conta!`,
            },
          });

          resultados.pagos++;
          resultados.detalhes.push({
            boletoId: boleto.id,
            status: 'PAID',
            amount: boleto.amount,
            customerId: boleto.customerId,
            customerName: boleto.Customer.name,
          });
        } else if (statusCora.status === 'OVERDUE' || statusCora.status === 'EXPIRED') {
          console.log(`⏰ Boleto ${boleto.id} está ${statusCora.status}`);

          // Atualiza o status para OVERDUE ou EXPIRED
          await prisma.boleto.update({
            where: { id: boleto.id },
            data: {
              status: 'OVERDUE',
            },
          });

          resultados.detalhes.push({
            boletoId: boleto.id,
            status: 'OVERDUE',
            amount: boleto.amount,
          });
        } else {
          console.log(`⏳ Boleto ${boleto.id} ainda está PENDING`);
          resultados.pendentes++;
        }

        // Pequeno delay para não sobrecarregar a API do CORA
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`❌ Erro ao verificar boleto ${boleto.id}:`, error.message);
        resultados.erros++;
        resultados.detalhes.push({
          boletoId: boleto.id,
          status: 'ERROR',
          error: error.message,
        });
      }
    }

    console.log('✅ Verificação periódica concluída:', resultados);

    return NextResponse.json({
      success: true,
      message: 'Verificação de boletos concluída',
      ...resultados,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Erro na verificação periódica:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar boletos', details: error.message },
      { status: 500 }
    );
  }
}
*/
}
