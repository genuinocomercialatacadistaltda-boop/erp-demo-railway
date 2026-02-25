import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar todos os destaques
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const highlights = await prisma.homeHighlight.findMany({
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(highlights);
  } catch (error) {
    console.error('Erro ao buscar destaques:', error);
    return NextResponse.json({ error: 'Erro ao buscar destaques' }, { status: 500 });
  }
}

// POST - Criar novo destaque
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, imageUrl, buttonText, buttonUrl, isActive, order } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Título e descrição são obrigatórios' }, { status: 400 });
    }

    const highlight = await prisma.homeHighlight.create({
      data: {
        title,
        description,
        imageUrl: imageUrl || null,
        buttonText: buttonText || null,
        buttonUrl: buttonUrl || null,
        isActive: isActive ?? true,
        order: order ?? 0,
        createdBy: (session.user as any)?.email,
      },
    });

    return NextResponse.json(highlight, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar destaque:', error);
    return NextResponse.json({ error: 'Erro ao criar destaque' }, { status: 500 });
  }
}
