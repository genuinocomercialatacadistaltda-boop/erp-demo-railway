export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// POST - Adicionar item de reconciliação (linha do extrato bancário)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const item = await prisma.reconciliationItem.create({
      data: {
        reconciliationId: params.id,
        externalDescription: body.externalDescription,
        externalDate: new Date(body.externalDate),
        externalAmount: parseFloat(body.externalAmount),
        transactionId: body.transactionId,
        isReconciled: body.isReconciled || false,
        matchedType: body.matchedType,
        notes: body.notes,
        reconciledBy: body.isReconciled ? (session.user as any)?.id : null,
        reconciledAt: body.isReconciled ? new Date() : null,
      },
      include: {
        Transaction: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Erro ao adicionar item de reconciliação:", error);
    return NextResponse.json(
      { error: "Erro ao adicionar item de reconciliação" },
      { status: 500 }
    );
  }
}
