import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/whatsapp/checklist
 * Gera automaticamente um checklist de comunicações pendentes
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    console.log('[WHATSAPP_CHECKLIST] Gerando checklist de comunicações...');

    // 1. Buscar TODOS os recebimentos atrasados (boletos E receivables)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1a. Buscar boletos atrasados
    const overdueBoletos = await prisma.boleto.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: today },
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            manuallyUnblocked: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    console.log(`[WHATSAPP_CHECKLIST] Encontrados ${overdueBoletos.length} boletos atrasados`);

    // 1b. Buscar receivables atrasados (PIX, dinheiro, etc)
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: today },
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            manuallyUnblocked: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    console.log(`[WHATSAPP_CHECKLIST] Encontrados ${overdueReceivables.length} receivables atrasados`);
    console.log(`[WHATSAPP_CHECKLIST] TOTAL de recebimentos atrasados: ${overdueBoletos.length + overdueReceivables.length}`);

    // 2. Buscar clientes inativos (sem pedidos há 30+ dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeCustomerIds = await prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    const activeIds = activeCustomerIds.map((o) => o.customerId);

    const inactiveCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        id: { notIn: activeIds },
        customerType: 'NORMAL',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
      take: 50, // Limitar a 50 para não sobrecarregar
    });

    console.log(`[WHATSAPP_CHECKLIST] Encontrados ${inactiveCustomers.length} clientes inativos`);

    // 3. Buscar comunicações já registradas (não marcadas como enviadas/ignoradas)
    const existingCommunications = await prisma.whatsAppCommunication.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            manuallyUnblocked: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    console.log(`[WHATSAPP_CHECKLIST] ${existingCommunications.length} comunicações pendentes já registradas`);

    // 4. Criar comunicações para TODOS os recebimentos atrasados (se não existir)
    const communicationsToCreate = [];
    
    // IMPORTANTE: Separar os IDs por tipo de comunicação para evitar duplicação
    // Só queremos verificar se já existe uma comunicação de OVERDUE_BOLETO, não qualquer tipo
    const existingOverdueBoletoCustomerIds = new Set(
      existingCommunications
        .filter((c) => c.type === 'OVERDUE_BOLETO')
        .map((c) => c.customerId)
    );

    const existingInactiveClientIds = new Set(
      existingCommunications
        .filter((c) => c.type === 'INACTIVE_CLIENT')
        .map((c) => c.customerId)
    );

    // 4a. Processar boletos atrasados
    for (const boleto of overdueBoletos) {
      if (!existingOverdueBoletoCustomerIds.has(boleto.customerId)) {
        const daysOverdue = Math.floor(
          (today.getTime() - boleto.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        communicationsToCreate.push({
          customerId: boleto.customerId,
          type: 'OVERDUE_BOLETO',
          description: `Boleto ${boleto.boletoNumber} vencido há ${daysOverdue} dias (R$ ${boleto.amount.toFixed(2)})`,
          priority: daysOverdue > 15 ? 'HIGH' : daysOverdue > 7 ? 'MEDIUM' : 'LOW',
          amount: Number(boleto.amount),
          relatedBoletoId: boleto.id,
        });

        existingOverdueBoletoCustomerIds.add(boleto.customerId);
      }
    }

    console.log(`[WHATSAPP_CHECKLIST] Criadas ${communicationsToCreate.length} comunicações de boletos`);

    // 4b. Processar receivables atrasados (PIX, dinheiro, etc)
    for (const receivable of overdueReceivables) {
      if (!existingOverdueBoletoCustomerIds.has(receivable.customerId)) {
        const daysOverdue = Math.floor(
          (today.getTime() - receivable.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const paymentMethodLabel = receivable.paymentMethod === 'PIX' ? 'PIX' :
          receivable.paymentMethod === 'MONEY' ? 'Dinheiro' :
          receivable.paymentMethod === 'BANK_TRANSFER' ? 'Transferência' :
          receivable.paymentMethod;

        communicationsToCreate.push({
          customerId: receivable.customerId,
          type: 'OVERDUE_BOLETO', // Usar mesmo tipo para agrupar todos os pagamentos atrasados
          description: `Pagamento ${paymentMethodLabel} vencido há ${daysOverdue} dias (R$ ${Number(receivable.amount).toFixed(2)})`,
          priority: daysOverdue > 15 ? 'HIGH' : daysOverdue > 7 ? 'MEDIUM' : 'LOW',
          amount: Number(receivable.amount),
          relatedReceivableId: receivable.id,
        });

        existingOverdueBoletoCustomerIds.add(receivable.customerId);
      }
    }

    console.log(`[WHATSAPP_CHECKLIST] TOTAL de comunicações criadas: ${communicationsToCreate.length}`);

    // 5. Criar comunicações para clientes inativos (se não existir)
    for (const customer of inactiveCustomers) {
      if (!existingInactiveClientIds.has(customer.id)) {
        communicationsToCreate.push({
          customerId: customer.id,
          type: 'INACTIVE_CLIENT',
          description: `Cliente inativo há mais de 30 dias - Incentivar novo pedido`,
          priority: 'LOW',
        });
      }
    }

    console.log(`[WHATSAPP_CHECKLIST] Criando ${communicationsToCreate.length} novas comunicações...`);

    // 6. Inserir novas comunicações no banco
    if (communicationsToCreate.length > 0) {
      await prisma.whatsAppCommunication.createMany({
        data: communicationsToCreate,
      });
    }

    // 7. Buscar todas as comunicações pendentes atualizadas
    const allCommunications = await prisma.whatsAppCommunication.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            manuallyUnblocked: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    // 8. Agrupar por tipo
    const grouped = {
      OVERDUE_BOLETO: allCommunications.filter((c) => c.type === 'OVERDUE_BOLETO'),
      INACTIVE_CLIENT: allCommunications.filter((c) => c.type === 'INACTIVE_CLIENT'),
      ORDER_FOLLOWUP: allCommunications.filter((c) => c.type === 'ORDER_FOLLOWUP'),
      CUSTOM: allCommunications.filter((c) => c.type === 'CUSTOM'),
    };

    console.log('[WHATSAPP_CHECKLIST] Checklist gerado com sucesso');
    console.log(`  - Pagamentos atrasados (boletos + receivables): ${grouped.OVERDUE_BOLETO.length}`);
    console.log(`  - Clientes inativos: ${grouped.INACTIVE_CLIENT.length}`);
    console.log(`  - Follow-up pedidos: ${grouped.ORDER_FOLLOWUP.length}`);
    console.log(`  - Personalizadas: ${grouped.CUSTOM.length}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          total: allCommunications.length,
          grouped,
          summary: {
            overdueBoletos: grouped.OVERDUE_BOLETO.length,
            inactiveClients: grouped.INACTIVE_CLIENT.length,
            orderFollowup: grouped.ORDER_FOLLOWUP.length,
            custom: grouped.CUSTOM.length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_CHECKLIST] Erro ao gerar checklist:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar checklist de comunicações', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/whatsapp/checklist
 * Criar uma comunicação personalizada manualmente
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { customerId, description, priority = 'MEDIUM' } = body;

    if (!customerId || !description) {
      return NextResponse.json(
        { error: 'customerId e description são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[WHATSAPP_CHECKLIST] Criando comunicação personalizada para cliente:', customerId);

    const communication = await prisma.whatsAppCommunication.create({
      data: {
        customerId,
        type: 'CUSTOM',
        description,
        priority,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    console.log('[WHATSAPP_CHECKLIST] Comunicação criada:', communication.id);

    return NextResponse.json(
      { success: true, data: communication },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_CHECKLIST] Erro ao criar comunicação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar comunicação', details: error.message },
      { status: 500 }
    );
  }
}
