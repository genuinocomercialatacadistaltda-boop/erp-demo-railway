import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const companies = await prisma.investmentCompany.findMany({
      orderBy: { name: 'asc' }
    })

    // Converter BigInt para string para serialização JSON
    const companiesSerializable = companies.map(company => ({
      ...company,
      totalShares: company.totalShares.toString()
    }))

    return NextResponse.json(companiesSerializable)
  } catch (error) {
    console.error('Erro ao buscar empresas:', error)
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 })
  }
}
