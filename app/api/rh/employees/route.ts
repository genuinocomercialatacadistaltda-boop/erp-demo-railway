
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Listar funcionários
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { cpf: { contains: search, mode: "insensitive" } },
        { position: { contains: search, mode: "insensitive" } }
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: true,
        _count: {
          select: {
            timeRecords: true,
            documents: true
          }
        }
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(employees);
  } catch (error: any) {
    console.error("Erro ao buscar funcionários:", error);
    return NextResponse.json(
      { error: "Erro ao buscar funcionários", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Criar funcionário
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

    // Validações
    if (!data.employeeNumber || !data.name || !data.cpf || !data.position || !data.admissionDate) {
      return NextResponse.json(
        { error: "Campos obrigatórios: número, nome, CPF, cargo e data de admissão" },
        { status: 400 }
      );
    }

    // Verificar se já existe funcionário com o mesmo número ou CPF
    const existing = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeNumber: parseInt(data.employeeNumber) },
          { cpf: data.cpf }
        ]
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um funcionário com este número ou CPF" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: parseInt(data.employeeNumber),
        name: data.name,
        cpf: data.cpf,
        position: data.position,
        salary: data.salary ? parseFloat(data.salary) : null,
        admissionDate: new Date(data.admissionDate),
        departmentId: data.departmentId || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
        status: data.status || "ACTIVE",
        receivesAdvance: data.receivesAdvance || false,
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : 0,
        sellerId: data.sellerId || null,
        isDeliveryPerson: data.isDeliveryPerson || false,
        password: data.password || null
      },
      include: {
        department: true
      }
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar funcionário:", error);
    return NextResponse.json(
      { error: "Erro ao criar funcionário", details: error.message },
      { status: 500 }
    );
  }
}
