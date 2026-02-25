import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { setClientCustomerPassword } from '@/lib/client-customer-auth';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// Buscar sub-cliente
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

    // Buscar estatísticas
    const [totalOrders, totalSpent, catalogItems] = await Promise.all([
      prisma.clientCustomerOrder.count({
        where: { clientCustomerId: params.id },
      }),
      prisma.clientCustomerOrder.aggregate({
        where: {
          clientCustomerId: params.id,
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      }),
      prisma.clientCustomerCatalogItem.count({
        where: { clientCustomerId: params.id },
      }),
    ]);

    return NextResponse.json({
      success: true,
      subCliente,
      stats: {
        totalOrders,
        totalSpent: totalSpent._sum.total || 0,
        catalogItems,
      },
    });
  } catch (error) {
    console.error('Get sub-cliente error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar sub-cliente' },
      { status: 500 }
    );
  }
}

// Atualizar sub-cliente
export async function PUT(
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

    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      document,
      creditLimit,
      pointsMultiplier,
      isActive,
      password,
    } = body;

    // Verificar se sub-cliente pertence ao assador
    const existingSubCliente = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId: user.customerId,
      },
    });

    if (!existingSubCliente) {
      return NextResponse.json(
        { success: false, message: 'Sub-cliente não encontrado' },
        { status: 404 }
      );
    }

    // Verificar email duplicado
    if (email && email !== existingSubCliente.email) {
      const emailExists = await prisma.clientCustomer.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          customerId: user.customerId,
          id: { not: params.id },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { success: false, message: 'E-mail já cadastrado' },
          { status: 400 }
        );
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email ? email.toLowerCase().trim() : null;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (document !== undefined) data.document = document;
    if (creditLimit !== undefined) data.creditLimit = creditLimit;
    if (pointsMultiplier !== undefined) data.pointsMultiplier = pointsMultiplier;
    if (isActive !== undefined) data.isActive = isActive;

    const subCliente = await prisma.clientCustomer.update({
      where: { id: params.id },
      data,
    });

    // Atualizar senha se fornecida
    if (password) {
      await setClientCustomerPassword(params.id, password);
    }

    return NextResponse.json({
      success: true,
      subCliente,
      message: 'Sub-cliente atualizado com sucesso',
    });
  } catch (error) {
    console.error('Update sub-cliente error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao atualizar sub-cliente' },
      { status: 500 }
    );
  }
}

// Deletar sub-cliente
export async function DELETE(
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

    await prisma.clientCustomer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Sub-cliente excluído com sucesso',
    });
  } catch (error) {
    console.error('Delete sub-cliente error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao excluir sub-cliente' },
      { status: 500 }
    );
  }
}
