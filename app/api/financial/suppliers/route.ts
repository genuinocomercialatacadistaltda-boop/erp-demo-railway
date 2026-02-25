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
    
    console.log('🆕 [FORNECEDOR] Dados recebidos:', JSON.stringify(body, null, 2));

    // ✅ Validação obrigatória - APENAS NOME
    if (!body.name || body.name.trim() === '') {
      console.error('❌ [FORNECEDOR] Nome é obrigatório');
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    // ✅ Validar documento único APENAS SE FORNECIDO
    if (body.document && body.document.trim() !== '') {
      const existing = await prisma.supplier.findUnique({
        where: { document: body.document },
      });

      if (existing) {
        console.error('❌ [FORNECEDOR] CPF/CNPJ já existe:', body.document);
        return NextResponse.json(
          { error: "Já existe um fornecedor com este CPF/CNPJ" },
          { status: 400 }
        );
      }
    }

    console.log('✅ [FORNECEDOR] Validações OK, criando...');

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        companyName: body.companyName || null,
        document: body.document && body.document.trim() !== '' ? body.document : null,
        documentType: body.documentType && body.documentType.trim() !== '' ? body.documentType : null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        zipCode: body.zipCode || null,
        bankName: body.bankName || null,
        bankAgency: body.bankAgency || null,
        bankAccount: body.bankAccount || null,
        pixKey: body.pixKey || null,
        notes: body.notes || null,
        isActive: body.isActive ?? true,
      },
    });

    console.log('✅ [FORNECEDOR] Criado com sucesso:', supplier.id);

    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    console.error("❌ [FORNECEDOR] Erro ao criar:", error);
    console.error("❌ [FORNECEDOR] Stack:", error.stack);
    console.error("❌ [FORNECEDOR] Mensagem:", error.message);
    
    return NextResponse.json(
      { 
        error: "Erro ao criar fornecedor",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
