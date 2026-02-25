
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Buscar funcionário por ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        timeRecords: {
          take: 50,
          orderBy: { dateTime: "desc" }
        },
        documents: {
          orderBy: { createdAt: "desc" }
        },
        _count: {
          select: {
            timeRecords: true,
            documents: true
          }
        }
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Erro ao buscar funcionário:", error);
    return NextResponse.json(
      { error: "Erro ao buscar funcionário", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Atualizar funcionário
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verificar se funcionário existe
    const existing = await prisma.employee.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar duplicidade de número ou CPF (exceto o próprio)
    if (data.employeeNumber || data.cpf) {
      const duplicate = await prisma.employee.findFirst({
        where: {
          AND: [
            { id: { not: params.id } },
            {
              OR: [
                data.employeeNumber ? { employeeNumber: parseInt(data.employeeNumber) } : {},
                data.cpf ? { cpf: data.cpf } : {}
              ]
            }
          ]
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Já existe outro funcionário com este número ou CPF" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};

    if (data.employeeNumber) updateData.employeeNumber = parseInt(data.employeeNumber);
    if (data.name) updateData.name = data.name;
    if (data.cpf) updateData.cpf = data.cpf;
    if (data.position) updateData.position = data.position;
    if (data.salary !== undefined) updateData.salary = data.salary ? parseFloat(data.salary) : null;
    if (data.admissionDate) updateData.admissionDate = new Date(data.admissionDate);
    if (data.terminationDate) updateData.terminationDate = new Date(data.terminationDate);
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.status) updateData.status = data.status;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.receivesAdvance !== undefined) updateData.receivesAdvance = data.receivesAdvance;
    if (data.creditLimit !== undefined) updateData.creditLimit = data.creditLimit ? parseFloat(data.creditLimit) : 0;
    if (data.sellerId !== undefined) updateData.sellerId = data.sellerId || null;
    if (data.isDeliveryPerson !== undefined) updateData.isDeliveryPerson = data.isDeliveryPerson;
    if (data.password !== undefined) updateData.password = data.password || null;

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: updateData,
      include: {
        department: true
      }
    });

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Erro ao atualizar funcionário:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar funcionário", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Excluir funcionário
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Verificar se funcionário existe
    const existing = await prisma.employee.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 }
      );
    }

    // Excluir funcionário (cascade vai excluir registros de ponto e documentos)
    await prisma.employee.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: "Funcionário excluído com sucesso" });
  } catch (error: any) {
    console.error("Erro ao excluir funcionário:", error);
    return NextResponse.json(
      { error: "Erro ao excluir funcionário", details: error.message },
      { status: 500 }
    );
  }
}
