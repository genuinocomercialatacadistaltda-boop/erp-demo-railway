export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET - Listar destaques ativos (público)
export async function GET() {
  try {
    const highlights = await prisma.homeHighlight.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(highlights);
  } catch (error) {
    console.error('Erro ao buscar destaques:', error);
    return NextResponse.json([]);
  }
}
