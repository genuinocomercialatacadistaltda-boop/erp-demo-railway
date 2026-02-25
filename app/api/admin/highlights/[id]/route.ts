export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar destaque específico
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const highlight = await prisma.homeHighlight.findUnique({
      where: { id: params.id },
    });

    if (!highlight) {
      return NextResponse.json({ error: 'Destaque não encontrado' }, { status: 404 });
    }

    return NextResponse.json(highlight);
  } catch (error) {
    console.error('Erro ao buscar destaque:', error);
    return NextResponse.json({ error: 'Erro ao buscar destaque' }, { status: 500 });
  }
}

// PUT - Atualizar destaque
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, imageUrl, buttonText, buttonUrl, isActive, order } = body;

    const highlight = await prisma.homeHighlight.update({
      where: { id: params.id },
      data: {
        title,
        description,
        imageUrl,
        buttonText,
        buttonUrl,
        isActive,
        order,
      },
    });

    return NextResponse.json(highlight);
  } catch (error) {
    console.error('Erro ao atualizar destaque:', error);
    return NextResponse.json({ error: 'Erro ao atualizar destaque' }, { status: 500 });
  }
}

// DELETE - Excluir destaque
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await prisma.homeHighlight.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir destaque:', error);
    return NextResponse.json({ error: 'Erro ao excluir destaque' }, { status: 500 });
  }
}
