export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar configurações de taxas
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const fees = await prisma.cardFeeConfig.findMany({
      where: { isActive: true },
      orderBy: { cardType: 'asc' },
    });

    return NextResponse.json(fees);
  } catch (error) {
    console.error('Erro ao buscar taxas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar taxas' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar configuração de taxa
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { cardType, feePercentage } = await request.json();

    if (!cardType || feePercentage === undefined) {
      return NextResponse.json(
        { error: 'Tipo de cartão e taxa são obrigatórios' },
        { status: 400 }
      );
    }

    if (feePercentage < 0 || feePercentage > 100) {
      return NextResponse.json(
        { error: 'Taxa deve estar entre 0 e 100%' },
        { status: 400 }
      );
    }

    // Buscar configuração existente
    const existingFee = await prisma.cardFeeConfig.findFirst({
      where: { cardType, isActive: true },
    });

    if (existingFee) {
      // Atualizar taxa existente
      const updatedFee = await prisma.cardFeeConfig.update({
        where: { id: existingFee.id },
        data: {
          feePercentage,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        message: 'Taxa atualizada com sucesso',
        fee: updatedFee,
      });
    } else {
      // Criar nova configuração
      const newFee = await prisma.cardFeeConfig.create({
        data: {
          cardType,
          feePercentage,
          isActive: true,
        },
      });

      return NextResponse.json({
        message: 'Taxa criada com sucesso',
        fee: newFee,
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar taxa:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar taxa' },
      { status: 500 }
    );
  }
}
