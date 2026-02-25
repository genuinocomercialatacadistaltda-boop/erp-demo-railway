
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Get specific coupon
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id: params.id },
      include: {
        CouponUsage: {
          include: {
            Customer: true,
            Coupon: true
          }
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            total: true,
            couponDiscount: true,
            createdAt: true
          }
        }
      }
    })

    if (!coupon) {
      return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 })
    }

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('Error fetching coupon:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Update coupon
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    console.log('[COUPON_UPDATE] Dados recebidos:', JSON.stringify(body, null, 2))

    // Preparar dados para atualização com conversões adequadas
    const updateData: any = {
      updatedAt: new Date()
    }

    // Campos de texto
    if (body.code !== undefined) updateData.code = body.code.toUpperCase()
    if (body.description !== undefined) updateData.description = body.description || null

    // Tipo e valor do desconto
    if (body.discountType !== undefined) updateData.discountType = body.discountType
    if (body.discountValue !== undefined) updateData.discountValue = parseFloat(body.discountValue)

    // Valores numéricos opcionais
    if (body.minOrderValue !== undefined) {
      updateData.minOrderValue = body.minOrderValue ? parseFloat(body.minOrderValue) : null
    }
    if (body.maxDiscount !== undefined) {
      updateData.maxDiscount = body.maxDiscount ? parseFloat(body.maxDiscount) : null
    }
    if (body.usageLimit !== undefined) {
      updateData.usageLimit = body.usageLimit ? parseInt(body.usageLimit) : null
    }

    // CORREÇÃO DE TIMEZONE: Datas
    if (body.validFrom !== undefined) {
      // Se vier no formato YYYY-MM-DD, criar data às 00:00 horário local (Brasília)
      if (typeof body.validFrom === 'string' && body.validFrom.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = body.validFrom.split('-').map(Number)
        // Criar data em Brasília (UTC-3), mas armazenar como UTC
        // Para 28/11/2025 em Brasília = 2025-11-28T03:00:00Z em UTC
        updateData.validFrom = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))
        console.log('[COUPON_UPDATE] validFrom convertido:', body.validFrom, '->', updateData.validFrom.toISOString())
      } else {
        updateData.validFrom = new Date(body.validFrom)
      }
    }

    if (body.validUntil !== undefined) {
      if (body.validUntil === null || body.validUntil === '') {
        updateData.validUntil = null
      } else if (typeof body.validUntil === 'string' && body.validUntil.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = body.validUntil.split('-').map(Number)
        // Criar data às 23:59:59 do dia em Brasília
        // Para 29/11/2025 em Brasília = 2025-11-30T02:59:59Z em UTC
        updateData.validUntil = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59))
        console.log('[COUPON_UPDATE] validUntil convertido:', body.validUntil, '->', updateData.validUntil.toISOString())
      } else {
        updateData.validUntil = new Date(body.validUntil)
      }
    }

    // Flags booleanas
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.isOneTimePerCustomer !== undefined) updateData.isOneTimePerCustomer = body.isOneTimePerCustomer
    if (body.targetAllCustomers !== undefined) updateData.targetAllCustomers = body.targetAllCustomers
    if (body.targetDecreasingVolume !== undefined) updateData.targetDecreasingVolume = body.targetDecreasingVolume
    if (body.targetProductDiversityChange !== undefined) updateData.targetProductDiversityChange = body.targetProductDiversityChange

    // Campos numéricos de targeting
    if (body.targetInactiveDays !== undefined) {
      updateData.targetInactiveDays = body.targetInactiveDays ? parseInt(body.targetInactiveDays) : null
    }
    if (body.targetMinPurchaseCount !== undefined) {
      updateData.targetMinPurchaseCount = body.targetMinPurchaseCount ? parseInt(body.targetMinPurchaseCount) : null
    }
    if (body.targetMaxPurchaseCount !== undefined) {
      updateData.targetMaxPurchaseCount = body.targetMaxPurchaseCount ? parseInt(body.targetMaxPurchaseCount) : null
    }
    if (body.targetVolumeDecreasePercent !== undefined) {
      updateData.targetVolumeDecreasePercent = body.targetVolumeDecreasePercent ? parseFloat(body.targetVolumeDecreasePercent) : null
    }

    // Arrays
    if (body.targetSpecificProducts !== undefined) updateData.targetSpecificProducts = body.targetSpecificProducts || []
    if (body.targetCities !== undefined) updateData.targetCities = body.targetCities || []
    if (body.targetCustomerIds !== undefined) updateData.targetCustomerIds = body.targetCustomerIds || []
    if (body.targetPreviousProducts !== undefined) updateData.targetPreviousProducts = body.targetPreviousProducts || []
    if (body.targetCurrentProducts !== undefined) updateData.targetCurrentProducts = body.targetCurrentProducts || []

    console.log('[COUPON_UPDATE] Dados processados para atualização:', JSON.stringify(updateData, null, 2))

    const coupon = await prisma.coupon.update({
      where: { id: params.id },
      data: updateData
    })

    console.log('[COUPON_UPDATE] Cupom atualizado com sucesso:', coupon.id)

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('[COUPON_UPDATE] Erro ao atualizar cupom:', error)
    console.error('[COUPON_UPDATE] Stack:', (error as Error).stack)
    return NextResponse.json({ 
      error: 'Erro ao atualizar cupom',
      details: (error as Error).message 
    }, { status: 500 })
  }
}

// DELETE - Delete coupon
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.coupon.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Cupom deletado com sucesso' })
  } catch (error) {
    console.error('Error deleting coupon:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
