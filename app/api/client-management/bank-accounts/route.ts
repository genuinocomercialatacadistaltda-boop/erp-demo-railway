
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
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

    const accounts = await prisma.clientBankAccount.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error("[CLIENT_BANK_ACCOUNTS_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar contas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const account = await prisma.clientBankAccount.create({
      data: {
        customerId,
        ...body,
      },
    });

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error("[CLIENT_BANK_ACCOUNTS_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
