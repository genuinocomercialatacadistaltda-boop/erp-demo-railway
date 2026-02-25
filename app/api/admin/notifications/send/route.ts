export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { targetRole, targetUserId, category, title, message } = await request.json();

    if (!targetRole || !category || !title || !message) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Se for para usuário específico
    if (targetUserId) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          title,
          message,
          category,
          deliveryMode: "MANUAL",
          targetRole,
          targetUserId,
          type: "COMMUNICATION",
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ count: 1, message: "Notificação enviada!" });
    }

    // Se for broadcast (todos)
    let targetUsers: any[] = [];

    if (targetRole === "CUSTOMER") {
      const customers = await prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetUsers = customers;
    } else if (targetRole === "SELLER") {
      const sellers = await prisma.seller.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetUsers = sellers;
    }

    // Criar notificação para cada usuário
    const notifications = targetUsers.map((user) => ({
      id: crypto.randomUUID(),
      title,
      message,
      category: category as any,
      deliveryMode: "MANUAL" as any,
      targetRole: targetRole as any,
      targetUserId: user.id,
      type: "COMMUNICATION" as any,
      updatedAt: new Date(),
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    return NextResponse.json({
      count: notifications.length,
      message: "Notificações enviadas!",
    });
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return NextResponse.json(
      { error: "Erro ao enviar notificação" },
      { status: 500 }
    );
  }
}
