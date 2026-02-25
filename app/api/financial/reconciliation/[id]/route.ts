export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Buscar reconciliação por ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const reconciliation = await prisma.bankReconciliation.findUnique({
      where: { id: params.id },
      include: {
        BankAccount: true,
        Items: {
          include: {
            Transaction: true,
          },
          orderBy: { externalDate: "asc" },
        },
      },
    });

    if (!reconciliation) {
      return NextResponse.json(
        { error: "Reconciliação não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(reconciliation);
  } catch (error) {
    console.error("Erro ao buscar reconciliação:", error);
    return NextResponse.json(
      { error: "Erro ao buscar reconciliação" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar reconciliação
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

    const reconciliation = await prisma.bankReconciliation.update({
      where: { id: params.id },
      data: {
        endingBalance: body.endingBalance
          ? parseFloat(body.endingBalance)
          : undefined,
        status: body.status,
        notes: body.notes,
        reconciledBy: body.status === "COMPLETED" ? (session.user as any)?.id : undefined,
        reconciledAt:
          body.status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        BankAccount: true,
        Items: true,
      },
    });

    return NextResponse.json(reconciliation);
  } catch (error) {
    console.error("Erro ao atualizar reconciliação:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar reconciliação" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar reconciliação
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Deletar itens relacionados primeiro (CASCADE já cuida disso no schema)
    await prisma.bankReconciliation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: "Reconciliação deletada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar reconciliação:", error);
    return NextResponse.json(
      { error: "Erro ao deletar reconciliação" },
      { status: 500 }
    );
  }
}
