export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { expenseId, direction, invoiceId } = body

    if (!expenseId || !direction || !invoiceId) {
      return NextResponse.json(
        { error: 'Dados incompletos: expenseId, direction e invoiceId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log('🔄 [REORDER] Reordenando despesa:', { expenseId, direction, invoiceId })

    // Buscar todas as despesas da fatura ordenadas por displayOrder
    const expenses = await prisma.creditCardExpense.findMany({
      where: { invoiceId },
      orderBy: [{ displayOrder: 'asc' }, { purchaseDate: 'asc' }]
    })

    // Encontrar o índice da despesa atual
    const currentIndex = expenses.findIndex(e => e.id === expenseId)

    if (currentIndex === -1) {
      return NextResponse.json(
        { error: 'Despesa não encontrada nesta fatura' },
        { status: 404 }
      )
    }

    // Calcular o novo índice
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(expenses.length - 1, currentIndex + 1)

    // Se já está no limite, não fazer nada
    if (newIndex === currentIndex) {
      return NextResponse.json({
        success: true,
        message: 'Despesa já está no limite'
      })
    }

    // Trocar as posições
    const currentExpense = expenses[currentIndex]
    const targetExpense = expenses[newIndex]

    console.log('🔄 Trocando posições:', {
      current: { id: currentExpense.id, order: currentExpense.displayOrder },
      target: { id: targetExpense.id, order: targetExpense.displayOrder }
    })

    // Usar transação para atualizar ambas
    await prisma.$transaction([
      prisma.creditCardExpense.update({
        where: { id: currentExpense.id },
        data: { displayOrder: newIndex }
      }),
      prisma.creditCardExpense.update({
        where: { id: targetExpense.id },
        data: { displayOrder: currentIndex }
      })
    ])

    console.log('✅ Reordenação concluída')

    return NextResponse.json({
      success: true,
      message: 'Despesa reordenada com sucesso'
    })

  } catch (error) {
    console.error('❌ [REORDER] Erro:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao reordenar despesa',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
