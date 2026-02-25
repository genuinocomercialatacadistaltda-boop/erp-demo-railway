
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { plugnotasAPI } from '@/lib/plugnotas-api';

// GET - Consultar nota fiscal específica
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: params.id },
      include: {
        Order: true,
        items: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('Erro ao consultar nota fiscal:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar nota fiscal' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar nota fiscal
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const motivo = searchParams.get('motivo');

    if (!motivo || motivo.length < 15) {
      return NextResponse.json(
        { error: 'Motivo do cancelamento deve ter no mínimo 15 caracteres' },
        { status: 400 }
      );
    }

    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada' }, { status: 404 });
    }

    if (invoice.status !== 'AUTHORIZED') {
      return NextResponse.json(
        { error: 'Apenas notas autorizadas podem ser canceladas' },
        { status: 400 }
      );
    }

    if (!invoice.plugnotasId) {
      return NextResponse.json(
        { error: 'Nota fiscal não possui ID do Plugnotas' },
        { status: 400 }
      );
    }

    // Cancelar no Plugnotas
    try {
      await plugnotasAPI.cancelarNota(invoice.plugnotasId, motivo);

      // Atualizar status no banco
      const updatedInvoice = await prisma.fiscalInvoice.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          cancellationReason: motivo,
        },
      });

      return NextResponse.json({
        success: true,
        invoice: updatedInvoice,
        message: 'Nota fiscal cancelada com sucesso',
      });
    } catch (plugnotasError: any) {
      return NextResponse.json(
        {
          error: 'Erro ao cancelar nota fiscal no Plugnotas',
          details: plugnotasError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Erro ao cancelar nota fiscal:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar nota fiscal' },
      { status: 500 }
    );
  }
}
