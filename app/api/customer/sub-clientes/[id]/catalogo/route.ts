import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// Listar catálogo do sub-cliente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!user?.customerId) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se sub-cliente pertence ao assador
    const subCliente = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId: user.customerId,
      },
    });

    if (!subCliente) {
      return NextResponse.json(
        { success: false, message: 'Sub-cliente não encontrado' },
        { status: 404 }
      );
    }

    const catalogItems = await prisma.clientCustomerCatalogItem.findMany({
      where: {
        clientCustomerId: params.id,
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

// Adicionar item ao catálogo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!user?.customerId) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se sub-cliente pertence ao assador
    const subCliente = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId: user.customerId,
      },
    });

    if (!subCliente) {
      return NextResponse.json(
        { success: false, message: 'Sub-cliente não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      productId,
      productName,
      productDescription,
      productImage,
      defaultPrice,
      customPrice,
      isVisible = true,
      isAvailable = true,
      pointsPerUnit = 0,
    } = body;

    if (!productName || defaultPrice === undefined) {
      return NextResponse.json(
        { success: false, message: 'Nome e preço são obrigatórios' },
        { status: 400 }
      );
    }

    const catalogItem = await prisma.clientCustomerCatalogItem.create({
      data: {
        clientCustomerId: params.id,
        customerId: user.customerId,
        productId,
        productName,
        productDescription,
        productImage,
        defaultPrice,
        customPrice,
        isVisible,
        isAvailable,
        pointsPerUnit,
      },
    });

    return NextResponse.json({
      success: true,
      item: catalogItem,
      message: 'Item adicionado ao catálogo',
    });
  } catch (error) {
    console.error('Create catalog item error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao adicionar item ao catálogo' },
      { status: 500 }
    );
  }
}
