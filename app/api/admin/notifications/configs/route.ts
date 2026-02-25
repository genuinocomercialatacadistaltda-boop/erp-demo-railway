export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// GET - Listar todas as configurações de notificações automáticas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const configs = await prisma.automaticNotificationConfig.findMany({
      orderBy: [
        { targetRole: 'asc' },
        { eventType: 'asc' },
      ],
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar configurações" },
      { status: 500 }
    );
  }
}

// POST - Criar nova configuração de notificação automática
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    
    const config = await prisma.automaticNotificationConfig.create({
      data: {
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description || null,
        eventType: body.eventType,
        daysOffset: body.daysOffset || 0,
        isActive: body.isActive !== false,
        title: body.title,
        message: body.message,
        targetRole: body.targetRole,
        category: body.category,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Erro ao criar configuração:", error);
    return NextResponse.json(
      { error: "Erro ao criar configuração" },
      { status: 500 }
    );
  }
}
