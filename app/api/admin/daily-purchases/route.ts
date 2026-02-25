export const dynamic = "force-dynamic";

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

    // Usar UTC para consistência com outras APIs
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const day = now.getUTCDate()
    
    // Ajustar para horário de Brasília (UTC-3)
    // Se agora é antes das 3h UTC, ainda é "ontem" em Brasília
    const brasiliaHour = now.getUTCHours() - 3
    const adjustedDay = brasiliaHour < 0 ? day - 1 : day
    const adjustedMonth = adjustedDay < 1 ? month - 1 : month
    const adjustedYear = adjustedMonth < 0 ? year - 1 : year
    
    const today = new Date(Date.UTC(adjustedYear, adjustedMonth < 0 ? 11 : adjustedMonth, adjustedDay < 1 ? new Date(adjustedYear, adjustedMonth, 0).getDate() : adjustedDay, 0, 0, 0, 0))
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    console.log('[daily-purchases] Período:', today.toISOString(), 'até', tomorrow.toISOString())

    function formatDateBrasilia(date: Date | null): string | null {
      if (!date) return null
      return date.toISOString().split('T')[0]
    }

    // Buscar compras da tabela Purchase (incluindo a Expense vinculada para enriquecer dados)
    const allPurchasesRaw = await prisma.purchase.findMany({
      where: {
        customerId: null, // Apenas compras da fábrica
        purchaseDate: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        Supplier: true,
        Expense: {
          include: {
            BankAccount: true
          }
        },
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

    // 🔧 FILTRAR: Se a compra tem Expense vinculada (é parcelada), NÃO mostrar aqui
    // As parcelas serão mostradas via Expense nos dias de vencimento
    const purchases = allPurchasesRaw.filter((p: any) => !p.expenseId)
    
    console.log('[daily-purchases] Purchases originais:', allPurchasesRaw.length, '| Sem Expense vinculada (à vista):', purchases.length)

    // 🔧 Coletar IDs de purchases que já estão sendo exibidos
    const purchaseIds = purchases.map((p: any) => p.id)

    // Buscar despesas RAW_MATERIALS que NÃO estão vinculadas a uma Purchase já listada
    const allRawMaterialExpenses = await prisma.expense.findMany({
      where: { 
        expenseType: 'RAW_MATERIALS',
        // ✅ Excluir despesas que já têm uma Purchase vinculada (para evitar duplicação)
        OR: [
          { Purchase: { is: null } },
          { Purchase: { id: { notIn: purchaseIds } } }
        ]
      },
      include: {
        Supplier: true,
        Category: true,
        BankAccount: true,
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência (mesma lógica do monthly-summary)
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
      return competenceDate && competenceDate >= today && competenceDate < tomorrow;
    })

    console.log('[daily-purchases] Purchases:', purchases.length, '| Expenses (sem duplicação):', rawMaterialExpenses.length)

    // ✅ Formatar compras, incluindo dados da Expense vinculada (se houver)
    const formattedPurchases = purchases.map((purchase: any) => ({
      id: purchase.id,
      supplier: purchase.Supplier?.name || 'Não informado',
      amount: Number(purchase.totalAmount) || 0,
      purchaseDate: formatDateBrasilia(purchase.purchaseDate),
      dueDate: formatDateBrasilia(purchase.dueDate),
      type: 'purchase',
      status: purchase.status || 'PENDING',
      invoiceNumber: purchase.invoiceNumber || null,
      // ✅ Usar conta bancária da Expense vinculada (se existir)
      bankAccount: purchase.Expense?.BankAccount?.name || null,
      items: purchase.PurchaseItem.map((item: any) => ({
        name: item.RawMaterial?.name || 'Material desconhecido',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice
      }))
    }))

    // Formatar despesas de matérias-primas que NÃO têm Purchase vinculada
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

    // Combinar as duas listas (sem duplicação)
    const allPurchases = [...formattedPurchases, ...formattedRawMaterialExpenses].sort((a, b) => {
      const dateA = new Date(a.purchaseDate || '').getTime()
      const dateB = new Date(b.purchaseDate || '').getTime()
      return dateB - dateA // Ordem decrescente
    })

    return NextResponse.json({ purchases: allPurchases })
  } catch (error: any) {
    console.error('[daily-purchases] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar compras' }, { status: 500 })
  }
}
