export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Buscar fornecedor por ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
      include: {
        Expense: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: { Expense: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Fornecedor não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Erro ao buscar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao buscar fornecedor" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar fornecedor
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    // Validar documento único (exceto o próprio fornecedor)
    if (body.document) {
      const existing = await prisma.supplier.findFirst({
        where: {
          document: body.document,
          NOT: { id: params.id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Já existe outro fornecedor com este CPF/CNPJ" },
          { status: 400 }
        );
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        name: body.name,
        companyName: body.companyName,
        document: body.document,
        documentType: body.documentType,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        bankName: body.bankName,
        bankAgency: body.bankAgency,
        bankAccount: body.bankAccount,
        pixKey: body.pixKey,
        notes: body.notes,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar fornecedor" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar fornecedor
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se tem despesas vinculadas
    const expenseCount = await prisma.expense.count({
      where: { supplierId: params.id },
    });

    if (expenseCount > 0) {
      return NextResponse.json(
        {
          error: `Não é possível deletar. Existem ${expenseCount} despesa(s) vinculada(s) a este fornecedor.`,
        },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Fornecedor deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao deletar fornecedor" },
      { status: 500 }
    );
  }
}
