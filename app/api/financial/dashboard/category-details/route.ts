export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

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
    const categoryName = searchParams.get("categoryName");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!categoryName) {
      return NextResponse.json(
        { error: "Nome da categoria é obrigatório" },
        { status: 400 }
      );
    }

    // Definir período padrão (mês atual)
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();

    console.log('🔍 Buscando detalhes da categoria:', categoryName);
    console.log('📅 Período:', start, 'até', end);

    const details: any[] = [];

    // 🔧 CASO ESPECIAL: Compras sem Categoria
    if (categoryName === "Compras sem Categoria") {
      // Buscar compras que NÃO têm Expense vinculada (ou Expense sem categoryId)
      const purchasesWithoutCategory = await prisma.purchase.findMany({
        where: {
          customerId: null,
          purchaseDate: {
            gte: start,
            lte: end
          },
          OR: [
            { Expense: null },
            { Expense: { categoryId: null } }
          ]
        },
        include: {
          Supplier: {
            select: { name: true }
          }
        },
        orderBy: {
          purchaseDate: 'desc'
        }
      });

      purchasesWithoutCategory.forEach((purchase: any) => {
        details.push({
          id: purchase.id,
          description: `Compra - ${purchase.Supplier?.name || 'Fornecedor não identificado'}`,
          amount: purchase.totalAmount,
          date: purchase.purchaseDate,
          status: purchase.status,
          type: 'PURCHASE'
        });
      });

      details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log(`✅ Encontradas ${details.length} compras sem categoria`);

      return NextResponse.json({
        details,
        total: details.reduce((sum: number, item: any) => sum + item.amount, 0)
      });
    }

    // Buscar categoria pelo nome
    const category = await prisma.expenseCategory.findFirst({
      where: {
        name: categoryName
      }
    });

    if (category) {
      // =====================================================================
      // 🔧 LÓGICA UNIFICADA: Tudo que tem categoria X é categoria X
      // Mesma lógica do Dashboard - não importa se é Expense, CreditCard ou Purchase
      // =====================================================================
      
      // 1. Buscar TODAS as despesas com essa categoria usando COMPETÊNCIA
      const allExpensesForCategory = await prisma.expense.findMany({
        where: {
          categoryId: category.id
        },
        include: {
          Purchase: {
            select: { purchaseDate: true }
          }
        },
        orderBy: { dueDate: 'desc' }
      });

      // Filtrar por competência e adicionar aos detalhes
      allExpensesForCategory.forEach((expense: any) => {
        // Determinar data de competência
        let competenceDate: Date | null = null;
        
        if (expense.competenceDate) {
          competenceDate = new Date(expense.competenceDate);
        } else if (expense.Purchase?.purchaseDate) {
          competenceDate = new Date(expense.Purchase.purchaseDate);
        } else if (expense.status === 'PAID' && expense.paymentDate) {
          competenceDate = new Date(expense.paymentDate);
        } else if (expense.status === 'PENDING' && expense.dueDate) {
          competenceDate = new Date(expense.dueDate);
        }

        // Filtrar pelo período
        if (competenceDate && competenceDate >= start && competenceDate <= end) {
          details.push({
            id: expense.id,
            description: expense.description,
            amount: expense.amount + (expense.feeAmount || 0),
            date: competenceDate,
            status: expense.status,
            type: 'EXPENSE'
          });
        }
      });

      // 2. Buscar despesas de cartão com essa categoria
      const creditCardExpenses = await prisma.creditCardExpense.findMany({
        where: {
          categoryId: category.id,
          purchaseDate: { gte: start, lte: end }
        },
        include: {
          CreditCard: { select: { name: true } }
        },
        orderBy: { purchaseDate: 'desc' }
      });

      creditCardExpenses.forEach((expense: any) => {
        details.push({
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          date: expense.purchaseDate,
          status: 'PAID',
          type: 'CREDIT_CARD',
          cardName: expense.CreditCard?.name
        });
      });

      // 3. Buscar APENAS Purchases SEM Expense E SEM CARTÃO (para não duplicar!)
      // Purchases COM Expense já foram contadas acima via Expense
      // Purchases COM CARTÃO já foram contadas acima via CreditCardExpense
      // Isso só aplica para categoria "Compra de Mercadoria"
      const isCompraMercadoria = category.name.includes('Compra de Mercadoria');
      if (isCompraMercadoria) {
        const purchasesWithoutExpense = await prisma.purchase.findMany({
          where: {
            customerId: null,
            purchaseDate: { gte: start, lte: end },
            expenseId: null, // 🔑 APENAS compras SEM expense
            // 🆕 Excluir compras de cartão de crédito - já estão em CreditCardExpenses!
            NOT: {
              paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
            }
          },
          include: {
            Supplier: { select: { name: true } }
          },
          orderBy: { purchaseDate: 'desc' }
        });

        purchasesWithoutExpense.forEach((purchase: any) => {
          details.push({
            id: purchase.id,
            description: `Compra - ${purchase.Supplier?.name || 'Fornecedor'} (sem despesa vinculada)`,
            amount: purchase.totalAmount,
            date: purchase.purchaseDate,
            status: purchase.status,
            type: 'PURCHASE'
          });
        });
        
        console.log(`🔍 [CATEGORY-DETAILS] Purchases SEM Expense e SEM Cartão: ${purchasesWithoutExpense.length}`);
      }
    }

    details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`✅ Encontrados ${details.length} itens`);

    return NextResponse.json({
      details,
      total: details.reduce((sum: number, item: any) => sum + item.amount, 0)
    });

  } catch (error) {
    console.error("Erro ao buscar detalhes da categoria:", error);
    return NextResponse.json(
      { error: "Erro ao buscar detalhes" },
      { status: 500 }
    );
  }
}
