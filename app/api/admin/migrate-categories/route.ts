export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('🔧 [MIGRATE_CATEGORIES] Iniciando migração de categorias...')

    // 1. Buscar as categorias antigas
    const oldCategories = await prisma.expenseCategory.findMany({
      where: {
        OR: [
          { name: { contains: 'Salário', mode: 'insensitive' } },
          { name: { contains: 'salário', mode: 'insensitive' } },
          { name: { contains: 'Funcionários', mode: 'insensitive' } },
          { name: { contains: 'funcionários', mode: 'insensitive' } },
          { name: { contains: 'funcionario', mode: 'insensitive' } },
          { name: { contains: 'Benefícios', mode: 'insensitive' } },
          { name: { contains: 'Beneficios', mode: 'insensitive' } },
          { name: { contains: 'benefício', mode: 'insensitive' } },
          { name: { contains: 'beneficio', mode: 'insensitive' } }
        ]
      }
    })

    console.log(`📋 [MIGRATE_CATEGORIES] Categorias encontradas: ${oldCategories.length}`)
    oldCategories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`)  
    })

    if (oldCategories.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Nenhuma categoria encontrada para migrar' 
      })
    }

    // 2. Criar nova categoria unificada (ou buscar se já existe)
    let newCategory = await prisma.expenseCategory.findFirst({
      where: { name: 'Salário/Funcionários/Benefícios' }
    })

    if (!newCategory) {
      console.log('✨ [MIGRATE_CATEGORIES] Criando nova categoria unificada...')
      newCategory = await prisma.expenseCategory.create({
        data: {
          name: 'Salário/Funcionários/Benefícios',
          expenseType: 'OPERATIONAL',
          description: 'Categoria unificada para despesas com salários, funcionários e benefícios'
        }
      })
      console.log(`✅ [MIGRATE_CATEGORIES] Nova categoria criada: ${newCategory.id}`)
    } else {
      console.log(`ℹ️  [MIGRATE_CATEGORIES] Categoria unificada já existe: ${newCategory.id}`)
    }

    const oldCategoryIds = oldCategories.map(c => c.id)

    // 3. Migrar despesas regulares (Expense)
    const expenseCount = await prisma.expense.updateMany({
      where: { categoryId: { in: oldCategoryIds } },
      data: { categoryId: newCategory.id }
    })
    console.log(`💰 [MIGRATE_CATEGORIES] ${expenseCount.count} despesas regulares migradas`)

    // 4. Migrar despesas de cartão de crédito (CreditCardExpense)
    const cardExpenseCount = await prisma.creditCardExpense.updateMany({
      where: { categoryId: { in: oldCategoryIds } },
      data: { categoryId: newCategory.id }
    })
    console.log(`💳 [MIGRATE_CATEGORIES] ${cardExpenseCount.count} despesas de cartão migradas`)

    // 5. Verificar se as categorias antigas ainda têm despesas
    let deletedCount = 0
    for (const oldCat of oldCategories) {
      const remainingExpenses = await prisma.expense.count({ where: { categoryId: oldCat.id } })
      const remainingCardExpenses = await prisma.creditCardExpense.count({ where: { categoryId: oldCat.id } })
      
      if (remainingExpenses === 0 && remainingCardExpenses === 0) {
        console.log(`🗑️  [MIGRATE_CATEGORIES] Deletando categoria vazia: ${oldCat.name}`)
        await prisma.expenseCategory.delete({ where: { id: oldCat.id } })
        deletedCount++
      } else {
        console.log(`⚠️  [MIGRATE_CATEGORIES] Categoria ${oldCat.name} ainda tem despesas vinculadas`)
      }
    }

    console.log('✅ [MIGRATE_CATEGORIES] Migração concluída!')

    return NextResponse.json({
      success: true,
      message: 'Categorias unificadas com sucesso!',
      details: {
        newCategory: {
          id: newCategory.id,
          name: newCategory.name,
          expenseType: newCategory.expenseType
        },
        migrated: {
          expenses: expenseCount.count,
          cardExpenses: cardExpenseCount.count
        },
        deletedCategories: deletedCount
      }
    })

  } catch (error) {
    console.error('[MIGRATE_CATEGORIES] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao migrar categorias', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
