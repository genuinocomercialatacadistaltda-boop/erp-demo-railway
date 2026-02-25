export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API: Operações em Lembrete Específico
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isSent, isCompleted, notes } = body;

    const reminder = await prisma.paymentReminder.update({
      where: { id: params.id },
      data: {
        isSent: isSent !== undefined ? isSent : undefined,
        sentAt: isSent ? new Date() : undefined,
        isCompleted: isCompleted !== undefined ? isCompleted : undefined,
        completedAt: isCompleted ? new Date() : undefined,
        notes: notes || undefined,
      },
    });

    return NextResponse.json(reminder);
  } catch (error: any) {
    console.error('Erro ao atualizar lembrete:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar lembrete: ' + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    await prisma.paymentReminder.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar lembrete:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar lembrete: ' + error.message },
      { status: 500 }
    );
  }
}
