export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// PUT /api/production/records/[id] - Editar registro de produção
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const {
      quantity,
      date,
      shift,
      notes,
      qualityScore,
      rejectedQty
    } = body

    console.log('[PRODUCTION_RECORDS_PUT] Editando registro:', id, body)

    // Verificar se registro existe
    const existing = await prisma.productionRecord.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Registro não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar
    const updateData: any = {}
    
    if (quantity !== undefined) {
      if (quantity <= 0) {
        return NextResponse.json(
          { error: 'Quantidade deve ser maior que zero' },
          { status: 400 }
        )
      }
      updateData.quantity = parseFloat(quantity)
    }
    
    if (date !== undefined) updateData.date = new Date(date)
    if (shift !== undefined) updateData.shift = shift
    if (notes !== undefined) updateData.notes = notes || null
    if (qualityScore !== undefined) updateData.qualityScore = qualityScore ? parseFloat(qualityScore) : null
    if (rejectedQty !== undefined) updateData.rejectedQty = rejectedQty ? parseFloat(rejectedQty) : null

    const record = await prisma.productionRecord.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            imageUrl: true
          }
        }
      }
    })

    console.log('[PRODUCTION_RECORDS_PUT] ✅ Registro atualizado:', id)

    return NextResponse.json({ record }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_RECORDS_PUT] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao editar registro', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/production/records/[id] - Excluir registro de produção
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params

    console.log('[PRODUCTION_RECORDS_DELETE] Excluindo registro:', id)

    // Verificar se registro existe
    const existing = await prisma.productionRecord.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Registro não encontrado' },
        { status: 404 }
      )
    }

    // Excluir
    await prisma.productionRecord.delete({
      where: { id }
    })

    console.log('[PRODUCTION_RECORDS_DELETE] ✅ Registro excluído:', id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_RECORDS_DELETE] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir registro', details: error.message },
      { status: 500 }
    )
  }
}
