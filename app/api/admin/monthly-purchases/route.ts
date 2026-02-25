export const dynamic = "force-dynamic"


import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    function getBrasiliaDate() {
      const now = new Date()
      const brasiliaOffset = -3 * 60
      const localOffset = now.getTimezoneOffset()
      const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000)
      return brasiliaTime
    }

    function getBrasiliaMonthStart() {
      const brasilia = getBrasiliaDate()
      const monthStart = new Date(brasilia.getFullYear(), brasilia.getMonth(), 1)
      return monthStart
    }

    function getBrasiliaMonthEnd() {
      const brasilia = getBrasiliaDate()
      const monthEnd = new Date(brasilia.getFullYear(), brasilia.getMonth() + 1, 1)
      return monthEnd
    }

    function formatDateBrasilia(date: Date | null): string | null {
      if (!date) return null
      const brasilia = new Date(date)
      brasilia.setMinutes(brasilia.getMinutes() + brasilia.getTimezoneOffset() + 180)
      return brasilia.toISOString().split("T")[0]
    }

    const firstDayOfMonth = getBrasiliaMonthStart()
    const firstDayOfNextMonth = getBrasiliaMonthEnd()

    // Buscar compras da tabela Purchase
    const purchases = await prisma.purchase.findMany({
      where: {
        customerId: null,
        purchaseDate: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth
        }
      },
      include: {
        Supplier: true,
        PurchaseItem: {
          include: {
            RawMaterial: true
          }
        }
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    })

    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO (monthly-summary)
    const allRawMaterialExpenses = await prisma.expense.findMany({
      where: { expenseType: 'RAW_MATERIALS' },
      include: {
        Supplier: true,
        Category: true,
        BankAccount: true,
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência
    const rawMaterialExpenses = allRawMaterialExpenses.filter((exp: any) => {
      let competenceDate: Date | null = null;
      if (exp.competenceDate) {
        competenceDate = new Date(exp.competenceDate);
      } else if (exp.Purchase?.purchaseDate) {
        competenceDate = new Date(exp.Purchase.purchaseDate);
      } else if (exp.status === 'PAID' && exp.paymentDate) {
        competenceDate = new Date(exp.paymentDate);
      } else if (exp.dueDate) {
        competenceDate = new Date(exp.dueDate);
      }
      return competenceDate && competenceDate >= firstDayOfMonth && competenceDate < firstDayOfNextMonth;
    })

    const formattedPurchases = purchases.map((purchase: any) => ({
      id: purchase.id,
      supplier: purchase.Supplier?.name || 'Não informado',
      amount: Number(purchase.totalAmount) || 0,
      purchaseDate: formatDateBrasilia(purchase.purchaseDate),
      dueDate: formatDateBrasilia(purchase.dueDate),
      type: 'purchase',
      status: purchase.status || 'PENDING',
      invoiceNumber: purchase.invoiceNumber || null,
      bankAccount: null,
      items: purchase.PurchaseItem.map((item: any) => ({
        name: item.RawMaterial?.name || 'Material desconhecido',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice
      }))
    }))

    // Formatar despesas de matérias-primas como compras
    const formattedRawMaterialExpenses = rawMaterialExpenses.map((expense: any) => ({
      id: expense.id,
      supplier: expense.Supplier?.name || 'Não informado',
      amount: Number(expense.amount) || 0,
      purchaseDate: formatDateBrasilia(expense.competenceDate || expense.dueDate),
      dueDate: formatDateBrasilia(expense.dueDate),
      type: 'expense',
      status: expense.status || 'PENDING',
      invoiceNumber: expense.invoiceNumber || null,
      bankAccount: expense.BankAccount?.name || null,
      description: expense.description,
      category: expense.Category?.name || 'Matérias-primas',
      items: [{
        name: expense.description,
        quantity: 1,
        unitPrice: expense.amount,
        total: expense.amount
      }]
    }))

    // Combinar as duas listas
    const allPurchases = [...formattedPurchases, ...formattedRawMaterialExpenses].sort((a, b) => {
      const dateA = new Date(a.purchaseDate || '').getTime()
      const dateB = new Date(b.purchaseDate || '').getTime()
      return dateB - dateA // Ordem decrescente
    })

    return NextResponse.json({ purchases: allPurchases })
  } catch (error: any) {
    console.error('[monthly-purchases] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar compras' }, { status: 500 })
  }
}
