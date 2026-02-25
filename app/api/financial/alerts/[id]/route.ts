export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API: Operações em Alerta Específico
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
    const { isRead, isResolved, resolvedNotes } = body;

    const alert = await prisma.financialAlert.update({
      where: { id: params.id },
      data: {
        isRead: isRead !== undefined ? isRead : undefined,
        isResolved: isResolved !== undefined ? isResolved : undefined,
        resolvedBy: isResolved ? session.user?.email : undefined,
        resolvedAt: isResolved ? new Date() : undefined,
        resolvedNotes: resolvedNotes || undefined,
      },
    });

    return NextResponse.json(alert);
  } catch (error: any) {
    console.error('Erro ao atualizar alerta:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar alerta: ' + error.message },
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

    await prisma.financialAlert.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar alerta:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar alerta: ' + error.message },
      { status: 500 }
    );
  }
}
