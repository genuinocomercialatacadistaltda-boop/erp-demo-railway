export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[CHECK_ITEM_PUT] Iniciando atualização de checklist de item');

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    console.log('[CHECK_ITEM_PUT] UserType:', userType, 'EmployeeId:', employeeId);

    if (userType === 'ADMIN') {
      console.log('[CHECK_ITEM_PUT] Admin autorizado');
    } else {
      if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        );
      }

      if (!employeeId) {
        return NextResponse.json(
          { error: 'Funcionário não identificado' },
          { status: 400 }
        );
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { isDeliveryPerson: true }
      });

      if (!employee?.isDeliveryPerson) {
        return NextResponse.json(
          { error: 'Acesso negado - Você não está configurado como entregador' },
          { status: 403 }
        );
      }
    }

    const { itemId, isChecked } = await request.json();

    console.log('[CHECK_ITEM_PUT] ItemId:', itemId, 'IsChecked:', isChecked);

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId é obrigatório' },
        { status: 400 }
      );
    }

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: params.id
      }
    });

    if (!orderItem) {
      return NextResponse.json(
        { error: 'Item não encontrado' },
        { status: 404 }
      );
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { isChecked: Boolean(isChecked) }
    });

    console.log('[CHECK_ITEM_PUT] Item atualizado:', updatedItem.id, 'IsChecked:', updatedItem.isChecked);

    return NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        isChecked: updatedItem.isChecked
      }
    });

  } catch (error) {
    console.error('[CHECK_ITEM_PUT] Erro ao atualizar checklist:', error);
    return NextResponse.json(
      {
        error: 'Erro ao atualizar checklist',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
