export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar uma folha de ponto específica
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || (user?.userType !== 'ADMIN' && user?.userType !== 'EMPLOYEE')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
          }
        },
        acknowledgments: true
      }
    });

    if (!timesheet) {
      return NextResponse.json({ error: 'Folha de ponto não encontrada' }, { status: 404 });
    }

    return NextResponse.json(timesheet);
  } catch (error: any) {
    console.error('[TIMESHEET_GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar folha de ponto' }, { status: 500 });
  }
}

// DELETE - Excluir folha de ponto
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;

    // Verificar se a folha de ponto existe
    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true } },
        acknowledgments: true
      }
    });

    if (!timesheet) {
      return NextResponse.json({ error: 'Folha de ponto não encontrada' }, { status: 404 });
    }

    console.log(`[TIMESHEET_DELETE] Excluindo folha de ponto:`, {
      id,
      employee: timesheet.employee?.name,
      period: `${timesheet.startDate} - ${timesheet.endDate}`,
      acknowledgementsCount: timesheet.acknowledgments.length
    });

    // Excluir acknowledgments vinculados primeiro
    if (timesheet.acknowledgments.length > 0) {
      await prisma.timesheetAcknowledgment.deleteMany({
        where: { timesheetId: id }
      });
      console.log(`[TIMESHEET_DELETE] ${timesheet.acknowledgments.length} acknowledgments excluídos`);
    }

    // Excluir a folha de ponto
    await prisma.timesheet.delete({
      where: { id }
    });

    console.log(`[TIMESHEET_DELETE] ✅ Folha de ponto excluída com sucesso`);
    return NextResponse.json({ success: true, message: 'Folha de ponto excluída com sucesso' });
  } catch (error: any) {
    console.error('[TIMESHEET_DELETE] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir folha de ponto', details: error.message },
      { status: 500 }
    );
  }
}
