import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// Atualizar item do catálogo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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

    // Verificar se item pertence ao assador
    const existingItem = await prisma.clientCustomerCatalogItem.findFirst({
      where: {
        id: params.itemId,
        clientCustomerId: params.id,
        customerId: user.customerId,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, message: 'Item não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      productName,
      productDescription,
      productImage,
      defaultPrice,
      customPrice,
      isVisible,
      isAvailable,
      pointsPerUnit,
    } = body;

    const data: any = {};
    if (productName !== undefined) data.productName = productName;
    if (productDescription !== undefined) data.productDescription = productDescription;
    if (productImage !== undefined) data.productImage = productImage;
    if (defaultPrice !== undefined) data.defaultPrice = defaultPrice;
    if (customPrice !== undefined) data.customPrice = customPrice;
    if (isVisible !== undefined) data.isVisible = isVisible;
    if (isAvailable !== undefined) data.isAvailable = isAvailable;
    if (pointsPerUnit !== undefined) data.pointsPerUnit = pointsPerUnit;

    const catalogItem = await prisma.clientCustomerCatalogItem.update({
      where: { id: params.itemId },
      data,
    });

    return NextResponse.json({
      success: true,
      item: catalogItem,
      message: 'Item atualizado com sucesso',
    });
  } catch (error) {
    console.error('Update catalog item error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao atualizar item' },
      { status: 500 }
    );
  }
}

// Deletar item do catálogo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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

    // Verificar se item pertence ao assador
    const existingItem = await prisma.clientCustomerCatalogItem.findFirst({
      where: {
        id: params.itemId,
        clientCustomerId: params.id,
        customerId: user.customerId,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, message: 'Item não encontrado' },
        { status: 404 }
      );
    }

    await prisma.clientCustomerCatalogItem.delete({
      where: { id: params.itemId },
    });

    return NextResponse.json({
      success: true,
      message: 'Item removido do catálogo',
    });
  } catch (error) {
    console.error('Delete catalog item error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao remover item' },
      { status: 500 }
    );
  }
}
