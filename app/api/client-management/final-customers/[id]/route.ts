
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const finalCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!finalCustomer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Buscar vendas não pagas deste cliente
    const unpaidSales = await prisma.clientSale.findMany({
      where: {
        customerId,
        linkedCustomerId: finalCustomer.id,
        isPaid: false,
        paymentStatus: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        Items: true,
      },
    });

    const totalDebt = unpaidSales.reduce((sum, sale) => sum + sale.total, 0);

    return NextResponse.json({
      success: true,
      data: {
        ...finalCustomer,
        totalDebt,
        unpaidSales,
      },
    });
  } catch (error) {
    console.error("[CLIENT_FINAL_CUSTOMER_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar cliente" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, phone, email, address, document, creditLimit, notes, isActive } = body;

    // Verificar se o cliente existe e pertence ao usuário
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Atualizar cliente
    const updatedCustomer = await prisma.clientCustomer.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || existingCustomer.name,
        phone: phone?.trim() || existingCustomer.phone,
        email: email?.trim() || existingCustomer.email,
        address: address?.trim() || existingCustomer.address,
        document: document?.trim() || existingCustomer.document,
        creditLimit: creditLimit !== undefined ? creditLimit : existingCustomer.creditLimit,
        notes: notes?.trim() || existingCustomer.notes,
        isActive: isActive !== undefined ? isActive : existingCustomer.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCustomer,
    });
  } catch (error) {
    console.error("[CLIENT_FINAL_CUSTOMER_PUT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar cliente" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    // Verificar se o cliente existe e pertence ao usuário
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se há vendas não pagas
    const unpaidSales = await prisma.clientSale.findMany({
      where: {
        customerId,
        linkedCustomerId: existingCustomer.id,
        isPaid: false,
      },
    });

    if (unpaidSales.length > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir cliente com vendas não pagas" },
        { status: 400 }
      );
    }

    // Excluir cliente
    await prisma.clientCustomer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Cliente excluído com sucesso",
    });
  } catch (error) {
    console.error("[CLIENT_FINAL_CUSTOMER_DELETE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir cliente" },
      { status: 500 }
    );
  }
}
