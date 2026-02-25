export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/admin/whatsapp/checklist/[id]
 * Marcar uma comunicação como enviada, ignorada, ou reverter para pendente
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { status } = body; // "SENT", "IGNORED", "PENDING"

    if (!status || !['SENT', 'IGNORED', 'PENDING'].includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido. Use SENT, IGNORED ou PENDING' },
        { status: 400 }
      );
    }

    console.log(`[WHATSAPP_CHECKLIST] Atualizando comunicação ${id} para status: ${status}`);

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'SENT') {
      updateData.sentAt = new Date();
      updateData.sentBy = session.user.id;
      updateData.lastContactDate = new Date();

      // Se tiver frequência configurada, calcular próxima data
      const comm = await prisma.whatsAppCommunication.findUnique({
        where: { id },
        select: { frequency: true },
      });

      if (comm?.frequency) {
        const nextDate = new Date();
        switch (comm.frequency) {
          case 'DAILY':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case 'EVERY_3_DAYS':
            nextDate.setDate(nextDate.getDate() + 3);
            break;
          case 'WEEKLY':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        }
        updateData.nextContactDate = nextDate;
        console.log(`[WHATSAPP_CHECKLIST] Próxima data programada: ${nextDate.toISOString()}`);
      }
    } else if (status === 'PENDING') {
      // Reverter para pendente
      updateData.sentAt = null;
      updateData.sentBy = null;
    }

    const communication = await prisma.whatsAppCommunication.update({
      where: { id },
      data: updateData,
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

    console.log(`[WHATSAPP_CHECKLIST] Comunicação ${id} atualizada para ${status}`);

    return NextResponse.json(
      { success: true, data: communication },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_CHECKLIST] Erro ao atualizar comunicação:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar comunicação', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/whatsapp/checklist/[id]
 * Remover uma comunicação da lista
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const { id } = params;

    console.log(`[WHATSAPP_CHECKLIST] Removendo comunicação ${id}`);

    await prisma.whatsAppCommunication.delete({
      where: { id },
    });

    console.log(`[WHATSAPP_CHECKLIST] Comunicação ${id} removida com sucesso`);

    return NextResponse.json(
      { success: true, message: 'Comunicação removida com sucesso' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[WHATSAPP_CHECKLIST] Erro ao remover comunicação:', error);
    return NextResponse.json(
      { error: 'Erro ao remover comunicação', details: error.message },
      { status: 500 }
    );
  }
}
