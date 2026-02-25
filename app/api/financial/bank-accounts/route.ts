export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar todas as contas bancárias
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const accounts = await prisma.bankAccount.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: {
            Transaction: true,
            Expense: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Erro ao buscar contas bancárias:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas bancárias" },
      { status: 500 }
    );
  }
}

// POST - Criar nova conta bancária
export async function POST(req: NextRequest) {
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
      color
    } = data;

    // Validações
    if (!name || !accountType) {
      return NextResponse.json(
        { error: "Nome e tipo da conta são obrigatórios" },
        { status: 400 }
      );
    }

    const account = await prisma.bankAccount.create({
      data: {
        name,
        accountType,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        agency: agency || null,
        balance: balance || 0,
        description: description || null,
        color: color || null,
        isActive: true
      }
    });

    // Criar transação inicial se houver saldo
    if (balance && balance !== 0) {
      await prisma.transaction.create({
        data: {
          bankAccountId: account.id,
          type: balance > 0 ? "INCOME" : "EXPENSE",
          amount: Math.abs(balance),
          description: "Saldo inicial",
          referenceType: "INITIAL_BALANCE",
          balanceAfter: balance,
          date: new Date()
        }
      });
    }

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta bancária:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta bancária" },
      { status: 500 }
    );
  }
}
