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

    let config = await prisma.clientManagementConfig.findUnique({
      where: { customerId },
    });

    // Criar configuração se não existir
    if (!config) {
      config = await prisma.clientManagementConfig.create({
        data: {
          customerId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("[CLIENT_MANAGEMENT_CONFIG_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar configurações" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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

    const config = await prisma.clientManagementConfig.upsert({
      where: { customerId },
      update: {
        ...body,
        updatedAt: new Date(),
      },
      create: {
        customerId,
        ...body,
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("[CLIENT_MANAGEMENT_CONFIG_PUT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar configurações" },
      { status: 500 }
    );
  }
}
