export const dynamic = "force-dynamic";

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

    const tables = await prisma.clientTable.findMany({
      where: { customerId },
      include: {
        Items: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { tableNumber: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: tables,
    });
  } catch (error) {
    console.error("[CLIENT_TABLES_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar mesas" },
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
    const { tableNumber, tableName } = body;

    const table = await prisma.clientTable.create({
      data: {
        customerId,
        tableNumber,
        tableName,
        status: "OCCUPIED",
        currentTotal: 0,
        openedAt: new Date(),
        openedBy: session.user.name || session.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      data: table,
    });
  } catch (error) {
    console.error("[CLIENT_TABLES_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar mesa" },
      { status: 500 }
    );
  }
}
