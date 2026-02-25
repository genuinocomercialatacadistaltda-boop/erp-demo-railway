
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Buscar despesas detalhadas por tipo
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
    const expenseType = searchParams.get("expenseType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!expenseType || !["OPERATIONAL", "PRODUCTS", "RAW_MATERIALS"].includes(expenseType)) {
      return NextResponse.json(
        { error: "Tipo de despesa inválido" },
        { status: 400 }
      );
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Buscar despesas normais do tipo especificado
    const regularExpenses = await prisma.expense.findMany({
      where: {
        expenseType: expenseType as any,
        OR: [
          {
            paymentDate: {
              gte: start,
              lte: end
            }
          },
          {
            dueDate: {
              gte: start,
              lte: end
            }
          }
        ]
      },
      include: {
        Category: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { paymentDate: "desc" },
        { dueDate: "desc" }
      ]
    });

    // 2. Buscar despesas de cartão do tipo especificado
    const creditCardExpenses = await prisma.creditCardExpense.findMany({
      where: {
        expenseType: expenseType as any,
        purchaseDate: {
          gte: start,
          lte: end
        }
      },
      include: {
        Category: {
          select: {
            name: true,
            color: true
          }
        },
        Invoice: {
          select: {
            status: true
          }
        }
      },
      orderBy: { purchaseDate: "desc" }
    });

    // 3. Se for RAW_MATERIALS, buscar também as compras DA FÁBRICA
    let purchases: any[] = [];
    if (expenseType === "RAW_MATERIALS") {
      purchases = await prisma.purchase.findMany({
        where: {
          customerId: null, // 🔑 Apenas compras da fábrica (admin)
          OR: [
            {
              paymentDate: {
                gte: start,
                lte: end
              }
            },
            {
              dueDate: {
                gte: start,
                lte: end
              }
            }
          ]
        },
        include: {
          Expense: {
            include: {
              Category: {
                select: {
                  name: true,
                  color: true
                }
              }
            }
          }
        },
        orderBy: [
          { paymentDate: "desc" },
          { dueDate: "desc" }
        ]
      });
    }

    // Formatar dados em um formato único
    const expenses = [
      ...regularExpenses.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount + (exp.feeAmount || 0),
        dueDate: exp.dueDate.toISOString(),
        paymentDate: exp.paymentDate?.toISOString(),
        status: exp.status,
        Category: exp.Category || { name: "Sem Categoria", color: "#6B7280" },
        expenseType: exp.expenseType,
        type: "EXPENSE" as const
      })),
      ...creditCardExpenses.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        dueDate: exp.purchaseDate.toISOString(),
        paymentDate: exp.Invoice?.status === "PAID" ? exp.purchaseDate.toISOString() : undefined,
        status: exp.Invoice?.status === "PAID" ? "PAID" : "PENDING",
        Category: exp.Category || { name: "Sem Categoria", color: "#6B7280" },
        expenseType: exp.expenseType,
        type: "CREDIT_CARD" as const
      })),
      ...purchases.map((purchase) => ({
        id: purchase.id,
        description: `Compra #${purchase.id.slice(-6)} - ${purchase.supplierName}`,
        amount: purchase.totalAmount,
        dueDate: purchase.dueDate.toISOString(),
        paymentDate: purchase.paymentDate?.toISOString(),
        status: purchase.status,
        Category: purchase.Expense?.Category || { name: "Compras", color: "#F59E0B" },
        expenseType: "RAW_MATERIALS",
        type: "PURCHASE" as const
      }))
    ];

    // Ordenar por data (mais recente primeiro)
    expenses.sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.dueDate);
      const dateB = new Date(b.paymentDate || b.dueDate);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Erro ao buscar despesas detalhadas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar despesas detalhadas" },
      { status: 500 }
    );
  }
}
