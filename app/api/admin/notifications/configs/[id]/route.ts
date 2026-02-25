export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Buscar configuração específica
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const config = await prisma.automaticNotificationConfig.findUnique({
      where: { id: params.id },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Configuração não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Erro ao buscar configuração:", error);
    return NextResponse.json(
      { error: "Erro ao buscar configuração" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar configuração
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const config = await prisma.automaticNotificationConfig.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description || null,
        eventType: body.eventType,
        daysOffset: body.daysOffset || 0,
        isActive: body.isActive,
        title: body.title,
        message: body.message,
        targetRole: body.targetRole,
        category: body.category,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Erro ao atualizar configuração:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar configuração" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar configuração
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    await prisma.automaticNotificationConfig.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar configuração:", error);
    return NextResponse.json(
      { error: "Erro ao deletar configuração" },
      { status: 500 }
    );
  }
}
