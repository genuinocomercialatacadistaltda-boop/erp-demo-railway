
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const boletos = await prisma.boleto.findMany({
      include: {
        Customer: {
          select: {
            name: true,
            email: true,
          },
        },
        Order: {
          select: {
            id: true,
            total: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(boletos);
  } catch (error) {
    console.error("Erro ao buscar boletos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar boletos" },
      { status: 500 }
    );
  }
}
