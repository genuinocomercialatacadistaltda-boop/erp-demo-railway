
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

    const account = await prisma.clientBankAccount.update({
      where: {
        id: params.id,
        customerId,
      },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error("[CLIENT_BANK_ACCOUNT_PUT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar conta" },
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

    await prisma.clientBankAccount.delete({
      where: {
        id: params.id,
        customerId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Conta excluída com sucesso",
    });
  } catch (error) {
    console.error("[CLIENT_BANK_ACCOUNT_DELETE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir conta" },
      { status: 500 }
    );
  }
}
