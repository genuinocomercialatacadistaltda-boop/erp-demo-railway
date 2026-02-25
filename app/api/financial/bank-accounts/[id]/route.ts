export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Buscar uma conta específica
export async function GET(
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

    const account = await prisma.bankAccount.findUnique({
      where: { id: params.id },
      include: {
        Transaction: {
          orderBy: { date: "desc" },
          take: 50 // Últimas 50 transações
        },
        _count: {
          select: {
            Transaction: true,
            Expense: true
          }
        }
      }
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    return NextResponse.json(
      { error: "Erro ao buscar conta" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar conta bancária
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
    const {
      name,
      accountType,
      bankName,
      accountNumber,
      agency,
      balance,
      description,
      color,
      isActive
    } = data;

    console.log("Atualizando conta bancária - dados recebidos:", {
      id: params.id,
      name,
      accountType,
      balance: balance !== undefined ? balance : "não fornecido"
    });

    const account = await prisma.bankAccount.update({
      where: { id: params.id },
      data: {
        name,
        accountType,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        agency: agency || null,
        balance: balance !== undefined ? parseFloat(balance.toString()) : undefined,
        description: description || null,
        color: color || null,
        isActive
      }
    });

    console.log("Conta atualizada com sucesso:", {
      id: account.id,
      name: account.name,
      novoSaldo: account.balance
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar conta" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar conta bancária (soft delete)
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

    // Verificar se há transações ou despesas vinculadas
    const account = await prisma.bankAccount.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            Transaction: true,
            Expense: true
          }
        }
      }
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // Não permitir exclusão se houver transações ou despesas
    if (account._count.Transaction > 0 || account._count.Expense > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir conta com transações ou despesas vinculadas. Desative a conta ao invés de excluir." },
        { status: 400 }
      );
    }

    // Se não houver transações, pode deletar
    await prisma.bankAccount.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: "Conta excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    return NextResponse.json(
      { error: "Erro ao excluir conta" },
      { status: 500 }
    );
  }
}
