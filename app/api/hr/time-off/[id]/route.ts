export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * PUT /api/hr/time-off/[id]
 * Atualiza um afastamento
 * 
 * DELETE /api/hr/time-off/[id]
 * Exclui um afastamento
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { type, startDate, endDate, reason, notes, documentUrl, isApproved } = body;

    console.log('📝 Atualizando afastamento:', params.id);

    const timeOff = await prisma.timeOff.update({
      where: { id: params.id },
      data: {
        ...(type && { type }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(reason !== undefined && { reason }),
        ...(notes !== undefined && { notes }),
        ...(documentUrl !== undefined && { documentUrl }),
        ...(typeof isApproved !== 'undefined' && {
          isApproved,
          ...(isApproved && {
            approvedBy: (session.user as any)?.id,
            approvedAt: new Date(),
          }),
        }),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
          },
        },
      },
    });

    console.log('✅ Afastamento atualizado');

    return NextResponse.json(timeOff);
  } catch (error: any) {
    console.error('❌ Erro ao atualizar afastamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar afastamento', details: error.message },
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

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('🗑️ Excluindo afastamento:', params.id);

    await prisma.timeOff.delete({
      where: { id: params.id },
    });

    console.log('✅ Afastamento excluído');

    return NextResponse.json({ message: 'Afastamento excluído com sucesso' });
  } catch (error: any) {
    console.error('❌ Erro ao excluir afastamento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir afastamento', details: error.message },
      { status: 500 }
    );
  }
}
