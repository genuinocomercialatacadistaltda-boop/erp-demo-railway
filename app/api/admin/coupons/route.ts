export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - List all coupons
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    const coupons = await prisma.coupon.findMany({
      where: isActive !== null ? { isActive: isActive === 'true' } : {},
      include: {
        CouponUsage: {
          include: {
            Customer: {
              select: {
                name: true
              }
            }
          }
        },
        Order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(coupons)
  } catch (error) {
    console.error('Error fetching coupons:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Create new coupon
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount,
      validFrom,
      validUntil,
      isActive,
      usageLimit,
      isOneTimePerCustomer,
      targetAllCustomers,
      targetInactiveDays,
      targetSpecificProducts,
      targetMinPurchaseCount,
      targetMaxPurchaseCount,
      targetCities,
      targetCustomerIds,
      targetDecreasingVolume,
      targetVolumeDecreasePercent,
      targetProductDiversityChange,
      targetPreviousProducts,
      targetCurrentProducts
    } = body

    // Validate required fields
    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: code, discountType, discountValue' },
        { status: 400 }
      )
    }

    // Check if coupon code already exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code }
    })

    if (existingCoupon) {
      return NextResponse.json(
        { error: 'Código de cupom já existe' },
        { status: 400 }
      )
    }

    // Processar datas com timezone de Brasília (UTC-3)
    let processedValidFrom: Date
    let processedValidUntil: Date | null = null

    if (validFrom && typeof validFrom === 'string' && validFrom.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = validFrom.split('-').map(Number)
      // Criar data às 00:00 em Brasília = 03:00 UTC
      processedValidFrom = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))
      console.log('[COUPON_CREATE] validFrom:', validFrom, '->', processedValidFrom.toISOString())
    } else if (validFrom) {
      processedValidFrom = new Date(validFrom)
    } else {
      processedValidFrom = new Date()
    }

    if (validUntil) {
      if (typeof validUntil === 'string' && validUntil.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = validUntil.split('-').map(Number)
        // Criar data às 23:59:59 em Brasília = 02:59:59 UTC do dia seguinte
        processedValidUntil = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59))
        console.log('[COUPON_CREATE] validUntil:', validUntil, '->', processedValidUntil.toISOString())
      } else {
        processedValidUntil = new Date(validUntil)
      }
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        id: `coupon_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        validFrom: processedValidFrom,
        validUntil: processedValidUntil,
        isActive: isActive !== false,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        isOneTimePerCustomer: isOneTimePerCustomer === true,
        targetAllCustomers: targetAllCustomers === true,
        targetInactiveDays: targetInactiveDays ? parseInt(targetInactiveDays) : null,
        targetSpecificProducts: targetSpecificProducts || [],
        targetMinPurchaseCount: targetMinPurchaseCount ? parseInt(targetMinPurchaseCount) : null,
        targetMaxPurchaseCount: targetMaxPurchaseCount ? parseInt(targetMaxPurchaseCount) : null,
        targetCities: targetCities || [],
        targetCustomerIds: targetCustomerIds || [],
        targetDecreasingVolume: targetDecreasingVolume === true,
        targetVolumeDecreasePercent: targetVolumeDecreasePercent ? parseFloat(targetVolumeDecreasePercent) : null,
        targetProductDiversityChange: targetProductDiversityChange === true,
        targetPreviousProducts: targetPreviousProducts || [],
        targetCurrentProducts: targetCurrentProducts || [],
        createdBy: (session.user as any).id,
        updatedAt: new Date()
      }
    })
    
    console.log('[COUPON_CREATE] Cupom criado com sucesso:', coupon.id)

    return NextResponse.json(coupon, { status: 201 })
  } catch (error) {
    console.error('Error creating coupon:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
