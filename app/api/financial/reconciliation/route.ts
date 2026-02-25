export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Listar reconciliações
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get("bankAccountId");
    const status = searchParams.get("status");

    const where: any = {};
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (status) where.status = status;

    const reconciliations = await prisma.bankReconciliation.findMany({
      where,
      orderBy: { referenceMonth: "desc" },
      include: {
        BankAccount: true,
        _count: {
          select: { Items: true },
        },
      },
    });

    return NextResponse.json(reconciliations);
  } catch (error) {
    console.error("Erro ao buscar reconciliações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar reconciliações" },
      { status: 500 }
    );
  }
}

// POST - Criar reconciliação
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        bankAccountId: body.bankAccountId,
        referenceMonth: new Date(body.referenceMonth),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        startingBalance: parseFloat(body.startingBalance),
        endingBalance: parseFloat(body.endingBalance),
        status: "IN_PROGRESS",
        notes: body.notes,
      },
      include: {
        BankAccount: true,
      },
    });

    return NextResponse.json(reconciliation, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar reconciliação:", error);
    return NextResponse.json(
      { error: "Erro ao criar reconciliação" },
      { status: 500 }
    );
  }
}
