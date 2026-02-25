import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Atualizar empresa
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { name, description, logoUrl, totalShares, currentPrice, valuation } = await req.json()

    console.log('[ADMIN_COMPANIES] Atualizando empresa:', params.id)

    const company = await prisma.investmentCompany.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(totalShares && { totalShares }),
        ...(currentPrice && { currentPrice }),
        ...(valuation && { valuation })
      }
    })

    console.log('[ADMIN_COMPANIES] Empresa atualizada com sucesso')

    return NextResponse.json({
      ...company,
      totalShares: company.totalShares.toString()
    })
  } catch (error: any) {
    console.error('[ADMIN_COMPANIES] Erro ao atualizar empresa:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar empresa' }, { status: 500 })
  }
}

// Deletar empresa
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[ADMIN_COMPANIES] Deletando empresa:', params.id)

    // Verificar se há transações ou portfolios
    const hasTransactions = await prisma.shareTransaction.count({
      where: { companyId: params.id }
    })

    const hasPortfolios = await prisma.investorPortfolio.count({
      where: { companyId: params.id }
    })

    if (hasTransactions > 0 || hasPortfolios > 0) {
      return NextResponse.json({ 
        error: 'Não é possível deletar empresa com transações ou portfolios existentes' 
      }, { status: 400 })
    }

    await prisma.investmentCompany.delete({
      where: { id: params.id }
    })

    console.log('[ADMIN_COMPANIES] Empresa deletada com sucesso')

    return NextResponse.json({ message: 'Empresa deletada com sucesso' })
  } catch (error: any) {
    console.error('[ADMIN_COMPANIES] Erro ao deletar empresa:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao deletar empresa' }, { status: 500 })
  }
}
