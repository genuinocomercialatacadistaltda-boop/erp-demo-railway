
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Listar departamentos
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(departments);
  } catch (error: any) {
    console.error("Erro ao buscar departamentos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar departamentos", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Criar departamento
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const data = await req.json();

    if (!data.name) {
      return NextResponse.json(
        { error: "Nome do departamento é obrigatório" },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        code: data.code || null
      }
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar departamento:", error);
    return NextResponse.json(
      { error: "Erro ao criar departamento", details: error.message },
      { status: 500 }
    );
  }
}
