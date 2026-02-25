export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar categorias
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const categories = await prisma.expenseCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: {
            Expense: true
          }
        }
      },
      orderBy: {
        displayOrder: "asc"
      }
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    return NextResponse.json(
      { error: "Erro ao buscar categorias" },
      { status: 500 }
    );
  }
}

// POST - Criar categoria
export async function POST(req: NextRequest) {
  try {
    console.log("🔵 [CATEGORIES API] Iniciando criação de categoria");
    
    const session = await getServerSession(authOptions);
    console.log("🔵 [CATEGORIES API] Session:", session ? "Existe" : "Não existe");
    console.log("🔵 [CATEGORIES API] UserType:", (session?.user as any)?.userType);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      console.log("❌ [CATEGORIES API] Não autorizado");
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const data = await req.json();
    console.log("🔵 [CATEGORIES API] Dados recebidos:", JSON.stringify(data, null, 2));
    
    const { name, description, color, icon, displayOrder, expenseType } = data;

    if (!name) {
      console.log("❌ [CATEGORIES API] Nome não fornecido");
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se já existe
    console.log("🔵 [CATEGORIES API] Verificando categoria existente com nome:", name);
    const existing = await prisma.expenseCategory.findUnique({
      where: { name }
    });

    if (existing) {
      console.log("❌ [CATEGORIES API] Categoria já existe:", existing.id);
      return NextResponse.json(
        { error: "Já existe uma categoria com este nome" },
        { status: 400 }
      );
    }

    console.log("🔵 [CATEGORIES API] Criando categoria com expenseType:", expenseType || "OTHER");
    const category = await prisma.expenseCategory.create({
      data: {
        name,
        description: description || null,
        color: color || null,
        icon: icon || null,
        displayOrder: displayOrder || 0,
        expenseType: expenseType || "OTHER",
        isActive: true
      }
    });

    console.log("✅ [CATEGORIES API] Categoria criada com sucesso:", category.id);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: any) {
    console.error("❌ [CATEGORIES API] ERRO COMPLETO:", error);
    console.error("❌ [CATEGORIES API] STACK:", error.stack);
    console.error("❌ [CATEGORIES API] MESSAGE:", error.message);
    return NextResponse.json(
      { 
        error: "Erro ao criar categoria",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
