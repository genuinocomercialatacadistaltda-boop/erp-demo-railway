export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// PUT - Atualizar categoria
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const data = await req.json();
    const { name, description, color, icon, displayOrder, isActive, expenseType } = data;

    // Verificar se categoria existe
    const existing = await prisma.expenseCategory.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      );
    }

    // Se mudar o nome, verificar se não existe outra com mesmo nome
    if (name && name !== existing.name) {
      const duplicate = await prisma.expenseCategory.findUnique({
        where: { name }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Já existe uma categoria com este nome" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.expenseCategory.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null,
        color: color || null,
        icon: icon || null,
        displayOrder,
        isActive,
        expenseType: expenseType || existing.expenseType // Atualiza apenas se fornecido
      }
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar categoria" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar categoria
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Verificar se há despesas vinculadas
    const category = await prisma.expenseCategory.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            Expense: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      );
    }

    if (category._count.Expense > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir categoria com despesas vinculadas. Desative a categoria ao invés de excluir." },
        { status: 400 }
      );
    }

    await prisma.expenseCategory.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: "Categoria excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir categoria:", error);
    return NextResponse.json(
      { error: "Erro ao excluir categoria" },
      { status: 500 }
    );
  }
}
