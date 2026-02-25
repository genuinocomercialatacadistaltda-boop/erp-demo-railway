export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/whatsapp/clients
 * Retorna todos os clientes com informações de último contato e frequência
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

    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get('filterType'); // NORMAL, CONSUMIDOR_FINAL, CASUAL, VAREJO

    console.log('[WHATSAPP_CLIENTS] Buscando clientes...', { filterType });

    // Buscar todos os clientes
    const whereClause: any = {
      isActive: true,
    };
    
    // Adicionar filtro de tipo se especificado
    if (filterType && filterType !== 'ALL') {
      whereClause.customerType = filterType;
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        customerType: true,
        city: true,
        manuallyUnblocked: true,
      },
      orderBy: { name: 'asc' },
    });

    console.log(`[WHATSAPP_CLIENTS] Encontrados ${customers.length} clientes`);

    // Para cada cliente, buscar a última comunicação enviada
    const clientsWithLastContact = await Promise.all(
      customers.map(async (customer) => {
        // Buscar última comunicação ENVIADA (status: SENT)
        const lastCommunication = await prisma.whatsAppCommunication.findFirst({
          where: {
            customerId: customer.id,
            status: 'SENT',
          },
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            sentAt: true,
            frequency: true,
            nextContactDate: true,
            description: true,
          },
        });

        // Buscar comunicação PENDENTE ativa
        const pendingCommunication = await prisma.whatsAppCommunication.findFirst({
          where: {
            customerId: customer.id,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            description: true,
            frequency: true,
            nextContactDate: true,
            priority: true,
          },
        });

        return {
          ...customer,
          lastContact: lastCommunication
            ? {
                date: lastCommunication.sentAt,
                frequency: lastCommunication.frequency,
                nextContactDate: lastCommunication.nextContactDate,
                description: lastCommunication.description,
              }
            : null,
          pendingCommunication: pendingCommunication
            ? {
                id: pendingCommunication.id,
                type: pendingCommunication.type,
                description: pendingCommunication.description,
                frequency: pendingCommunication.frequency,
                nextContactDate: pendingCommunication.nextContactDate,
                priority: pendingCommunication.priority,
              }
            : null,
        };
      })
    );

    console.log('[WHATSAPP_CLIENTS] Dados de contato carregados com sucesso');

    return NextResponse.json(
      {
        success: true,
        data: clientsWithLastContact,
        total: clientsWithLastContact.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_CLIENTS] Erro ao buscar clientes:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar clientes', details: error.message },
      { status: 500 }
    );
  }
}
