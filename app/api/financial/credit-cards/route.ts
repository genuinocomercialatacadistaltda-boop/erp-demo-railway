
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar todos os cartões
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const cards = await prisma.creditCard.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            Invoices: true,
            Expenses: {
              where: {
                invoiceId: null
              }
            }
          }
        }
      }
    });

    // Calcular total de despesas pendentes para cada cartão
    // INCLUI: despesas sem fatura + fatura OPEN
    const cardsWithPending = await Promise.all(
      cards.map(async (card: any) => {
        // 1. Despesas não vinculadas a fatura
        const pendingExpenses = await prisma.creditCardExpense.aggregate({
          where: {
            creditCardId: card.id,
            invoiceId: null
          },
          _sum: {
            amount: true
          },
          _count: true
        });

        // 2. Buscar TODAS as faturas ABERTAS (OPEN) - importante para compras parceladas
        const openInvoices = await prisma.creditCardInvoice.findMany({
          where: {
            creditCardId: card.id,
            status: "OPEN"
          },
          select: {
            id: true,
            totalAmount: true,
            referenceMonth: true,
            _count: {
              select: {
                Expenses: true
              }
            }
          },
          orderBy: {
            referenceMonth: 'asc' // Mais recente primeiro
          }
        });

        // Somar TODAS as faturas abertas (para compras parceladas com múltiplas faturas)
        const totalOpenInvoicesAmount = openInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const totalOpenInvoicesExpenses = openInvoices.reduce((sum, inv) => sum + inv._count.Expenses, 0);

        // Usar a primeira fatura aberta como "atual" para display
        const openInvoice = openInvoices[0] || null;

        // 3. Buscar todas as faturas do cartão (para seleção no frontend)
        const allInvoices = await prisma.creditCardInvoice.findMany({
          where: {
            creditCardId: card.id
          },
          select: {
            id: true,
            referenceMonth: true,
            status: true,
            totalAmount: true,
            _count: {
              select: {
                Expenses: true
              }
            }
          },
          orderBy: {
            referenceMonth: 'desc'
          },
          take: 12 // Últimos 12 meses
        });

        // Soma das despesas sem fatura + TODAS as faturas abertas
        const totalPending = (pendingExpenses._sum.amount || 0) + totalOpenInvoicesAmount;
        const totalExpenses = (pendingExpenses._count || 0) + totalOpenInvoicesExpenses;

        return {
          ...card,
          pendingAmount: totalPending,
          pendingExpensesCount: totalExpenses,
          currentInvoice: openInvoice ? {
            id: openInvoice.id,
            referenceMonth: openInvoice.referenceMonth,
            totalAmount: openInvoice.totalAmount,
            expensesCount: openInvoice._count.Expenses
          } : null,
          availableInvoices: allInvoices.map(inv => ({
            id: inv.id,
            referenceMonth: inv.referenceMonth,
            status: inv.status,
            totalAmount: inv.totalAmount,
            expensesCount: inv._count.Expenses
          }))
        };
      })
    );

    return NextResponse.json(
      { cards: cardsWithPending },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error("Erro ao buscar cartões:", error);
    return NextResponse.json(
      { error: "Erro ao buscar cartões" },
      { status: 500 }
    );
  }
}

// POST - Criar novo cartão
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const data = await req.json();
    
    const { name, cardNumber, cardFlag, limit, closingDay, dueDay, color, notes } = data;

    // Validações
    if (!name || !closingDay || !dueDay) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
      return NextResponse.json(
        { error: "Dias de fechamento e vencimento devem estar entre 1 e 31" },
        { status: 400 }
      );
    }

    const card = await prisma.creditCard.create({
      data: {
        name,
        cardNumber,
        cardFlag,
        limit: limit ? parseFloat(limit) : null,
        closingDay: parseInt(closingDay),
        dueDay: parseInt(dueDay),
        color,
        notes,
        isActive: true
      }
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar cartão:", error);
    return NextResponse.json(
      { error: "Erro ao criar cartão" },
      { status: 500 }
    );
  }
}
