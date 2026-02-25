import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Listar empresas (admin)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const companies = await prisma.investmentCompany.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            portfolios: true,
            transactions: true
          }
        }
      }
    })

    // Converter BigInt para string
    const companiesSerializable = companies.map(company => ({
      ...company,
      totalShares: company.totalShares.toString()
    }))

    return NextResponse.json(companiesSerializable)
  } catch (error) {
    console.error('[ADMIN_COMPANIES] Erro ao buscar empresas:', error)
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 })
  }
}

// Criar empresa
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { name, description, logoUrl, totalShares, currentPrice, valuation } = await req.json()

    if (!name || !currentPrice || !valuation) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    console.log('[ADMIN_COMPANIES] Criando empresa:', name)

    const company = await prisma.investmentCompany.create({
      data: {
        name,
        description,
        logoUrl,
        totalShares: totalShares || 1000000,
        currentPrice,
        valuation
      }
    })

    console.log('[ADMIN_COMPANIES] Empresa criada com sucesso:', company.id)

    return NextResponse.json({
      ...company,
      totalShares: company.totalShares.toString()
    })
  } catch (error: any) {
    console.error('[ADMIN_COMPANIES] Erro ao criar empresa:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Empresa com este nome já existe' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 })
  }
}
