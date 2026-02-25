export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/whatsapp/schedule
 * Programar follow-up com frequência para um cliente
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
    const { customerId, frequency, description } = body;

    if (!customerId || !frequency) {
      return NextResponse.json(
        { error: 'customerId e frequency são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[WHATSAPP_SCHEDULE] Programando follow-up para cliente:', customerId, frequency);

    // Calcular próxima data de contato baseada na frequência
    const now = new Date();
    let nextContactDate = new Date(now);

    switch (frequency) {
      case 'DAILY':
        nextContactDate.setDate(nextContactDate.getDate() + 1);
        break;
      case 'EVERY_3_DAYS':
        nextContactDate.setDate(nextContactDate.getDate() + 3);
        break;
      case 'WEEKLY':
        nextContactDate.setDate(nextContactDate.getDate() + 7);
        break;
      default:
        nextContactDate.setDate(nextContactDate.getDate() + 1);
    }

    // Verificar se já existe uma comunicação pendente para este cliente
    const existing = await prisma.whatsAppCommunication.findFirst({
      where: {
        customerId,
        status: 'PENDING',
        type: 'ORDER_FOLLOWUP',
      },
    });

    let communication;

    if (existing) {
      // Atualizar a existente
      communication = await prisma.whatsAppCommunication.update({
        where: { id: existing.id },
        data: {
          frequency,
          nextContactDate,
          description: description || `Follow-up programado (${frequency})`,
          updatedAt: new Date(),
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      console.log('[WHATSAPP_SCHEDULE] Comunicação atualizada:', communication.id);
    } else {
      // Criar nova
      communication = await prisma.whatsAppCommunication.create({
        data: {
          customerId,
          type: 'ORDER_FOLLOWUP',
          description: description || `Follow-up programado (${frequency})`,
          priority: 'MEDIUM',
          frequency,
          nextContactDate,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      console.log('[WHATSAPP_SCHEDULE] Nova comunicação criada:', communication.id);
    }

    return NextResponse.json(
      { success: true, data: communication },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_SCHEDULE] Erro ao programar follow-up:', error);
    return NextResponse.json(
      { error: 'Erro ao programar follow-up', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/whatsapp/schedule
 * Cancelar follow-up programado para um cliente
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId é obrigatório' },
        { status: 400 }
      );
    }

    console.log('[WHATSAPP_SCHEDULE] Cancelando follow-up para cliente:', customerId);

    // Deletar comunicações pendentes de follow-up
    const deleted = await prisma.whatsAppCommunication.deleteMany({
      where: {
        customerId,
        status: 'PENDING',
        type: 'ORDER_FOLLOWUP',
      },
    });

    console.log('[WHATSAPP_SCHEDULE] Comunicações removidas:', deleted.count);

    return NextResponse.json(
      { success: true, deleted: deleted.count },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_SCHEDULE] Erro ao cancelar follow-up:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar follow-up', details: error.message },
      { status: 500 }
    );
  }
}
