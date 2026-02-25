import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyClientCustomerToken } from '@/lib/client-customer-auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    // Buscar catálogo personalizado
    const catalogItems = await prisma.clientCustomerCatalogItem.findMany({
      where: {
        clientCustomerId: session.id,
        isVisible: true,
      },
      orderBy: {
        productName: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      items: catalogItems,
    });
  } catch (error) {
    console.error('Get catalog error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar catálogo' },
      { status: 500 }
    );
  }
}
