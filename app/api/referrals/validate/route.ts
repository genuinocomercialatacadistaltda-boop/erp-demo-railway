
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST - Validar código de indicação (DESABILITADO)
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { 
        error: 'Sistema de código de indicação não é mais suportado. Use o novo sistema de indicação direta.',
        valid: false
      },
      { status: 400 }
    );

    /*
    const body = await request.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json({ error: 'Código de indicação é obrigatório' }, { status: 400 });
    }

    // Buscar cliente com este código
    const referrer = await prisma.customer.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
    */

    /*
    if (!referrer) {
      return NextResponse.json({ error: 'Código de indicação inválido' }, { status: 404 });
    }

    if (!referrer.isActive) {
      return NextResponse.json({ error: 'Cliente indicador não está ativo' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      referrer: {
        id: referrer.id,
        name: referrer.name,
      },
    });
    */
  } catch (error) {
    console.error('Erro ao validar código de indicação:', error);
    return NextResponse.json(
      { error: 'Erro ao validar código de indicação' },
      { status: 500 }
    );
  }
}
