import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const { isActive } = await request.json()
    
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { isActive }
    })

    console.log(`🔄 Cliente ${customer.name} ${isActive ? 'ATIVADO' : 'INATIVADO'}`)

    return NextResponse.json(customer)
  } catch (error: any) {
    console.error('Erro ao atualizar status do cliente:', error)
    return NextResponse.json(
      { error: 'Falha ao atualizar status do cliente', details: error.message },
      { status: 500 }
    )
  }
}
