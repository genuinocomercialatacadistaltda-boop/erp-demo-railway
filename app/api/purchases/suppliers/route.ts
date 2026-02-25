export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Listar fornecedores
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");

    const suppliers = await prisma.supplier.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { companyName: { contains: search, mode: "insensitive" } },
                  { document: { contains: search } },
                ],
              }
            : {},
          isActive !== null ? { isActive: isActive === "true" } : {},
        ],
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { Expense: true },
        },
      },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("Erro ao buscar fornecedores:", error);
    return NextResponse.json(
      { error: "Erro ao buscar fornecedores" },
      { status: 500 }
    );
  }
}

// POST - Criar fornecedor
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();

    // Validar documento único
    const existing = await prisma.supplier.findUnique({
      where: { document: body.document },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um fornecedor com este CPF/CNPJ" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        companyName: body.companyName,
        document: body.document,
        documentType: body.documentType,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        bankName: body.bankName,
        bankAgency: body.bankAgency,
        bankAccount: body.bankAccount,
        pixKey: body.pixKey,
        notes: body.notes,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao criar fornecedor" },
      { status: 500 }
    );
  }
}
