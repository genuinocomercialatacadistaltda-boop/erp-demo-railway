export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// POST - Criar categorias padrão
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const defaultCategories: Array<{
      name: string;
      description: string;
      color: string;
      expenseType: "OPERATIONAL" | "PRODUCTS" | "RAW_MATERIALS" | "INVESTMENT" | "PROLABORE" | "OTHER";
      displayOrder: number;
    }> = [
      {
        name: "Marketing",
        description: "Despesas com marketing e publicidade",
        color: "#EF4444",
        expenseType: "OPERATIONAL", // 🏢 Operacional
        displayOrder: 1
      },
      {
        name: "Aluguel",
        description: "Aluguel de imóveis e equipamentos",
        color: "#DC2626",
        expenseType: "OPERATIONAL", // 🏢 Operacional
        displayOrder: 2
      },
      {
        name: "Salários",
        description: "Pagamento de salários e encargos",
        color: "#B91C1C",
        expenseType: "OPERATIONAL", // 🏢 Operacional
        displayOrder: 3
      },
      {
        name: "Contas (Luz, Água, Internet)",
        description: "Contas de consumo",
        color: "#991B1B",
        expenseType: "OPERATIONAL", // 🏢 Operacional
        displayOrder: 4
      },
      {
        name: "Embalagens",
        description: "Embalagens, sacolas, caixas",
        color: "#9333EA",
        expenseType: "PRODUCTS", // 📦 Produtos
        displayOrder: 5
      },
      {
        name: "Palitos e Espetos",
        description: "Palitos de madeira, espetos",
        color: "#7C3AED",
        expenseType: "PRODUCTS", // 📦 Produtos
        displayOrder: 6
      },
      {
        name: "Temperos e Condimentos",
        description: "Temperos, sal, pimenta, etc",
        color: "#6D28D9",
        expenseType: "PRODUCTS", // 📦 Produtos
        displayOrder: 7
      },
      {
        name: "Carne Bovina",
        description: "Compra de carne bovina",
        color: "#F59E0B",
        expenseType: "RAW_MATERIALS", // 🥩 Matéria Prima
        displayOrder: 8
      },
      {
        name: "Frango",
        description: "Compra de frango",
        color: "#D97706",
        expenseType: "RAW_MATERIALS", // 🥩 Matéria Prima
        displayOrder: 9
      },
      {
        name: "Queijo",
        description: "Compra de queijo coalho",
        color: "#B45309",
        expenseType: "RAW_MATERIALS", // 🥩 Matéria Prima
        displayOrder: 10
      },
      {
        name: "Linguiça",
        description: "Compra de linguiça",
        color: "#92400E",
        expenseType: "RAW_MATERIALS", // 🥩 Matéria Prima
        displayOrder: 11
      },
      {
        name: "Investimentos",
        description: "Investimentos em equipamentos, melhorias e expansão",
        color: "#10B981",
        expenseType: "INVESTMENT", // 💰 Investimento
        displayOrder: 12
      },
      {
        name: "Pró-labore",
        description: "Retirada dos sócios",
        color: "#3B82F6",
        expenseType: "PROLABORE", // 👤 Pró-labore
        displayOrder: 13
      },
      {
        name: "Outras Despesas",
        description: "Outras despesas diversas",
        color: "#6B7280",
        expenseType: "OTHER", // 📌 Outros
        displayOrder: 14
      }
    ];

    const created = [];
    
    for (const cat of defaultCategories) {
      const existing = await prisma.expenseCategory.findUnique({
        where: { name: cat.name }
      });

      if (!existing) {
        const category = await prisma.expenseCategory.create({
          data: cat
        });
        created.push(category);
      }
    }

    return NextResponse.json({ 
      message: `${created.length} categorias criadas com sucesso`,
      categories: created 
    });
  } catch (error) {
    console.error("Erro ao criar categorias padrão:", error);
    return NextResponse.json(
      { error: "Erro ao criar categorias padrão" },
      { status: 500 }
    );
  }
}
