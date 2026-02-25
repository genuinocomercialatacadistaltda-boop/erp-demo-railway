
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    // 🆕 CORREÇÃO: Permitir validação de cupons SEM autenticação (para varejo sem cadastro)
    const session = await getServerSession(authOptions)
    // Não bloquear mais se não tiver sessão - permitir para usuários não autenticados

    const { code, customerId, orderTotal, orderItems } = await request.json()

    console.log('🎟️ [COUPON_VALIDATE] Validando cupom:', {
      code: code?.toUpperCase(),
      hasSession: !!session,
      customerId: customerId || 'SEM CADASTRO',
      orderTotal
    })

    if (!code) {
      return NextResponse.json({ error: 'Código do cupom é obrigatório' }, { status: 400 })
    }

    // Find coupon
    // 🔧 CORREÇÃO: Só incluir CouponUsage se houver customerId
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: customerId ? {
        CouponUsage: {
          where: {
            customerId: customerId
          }
        }
      } : undefined
    })

    if (!coupon) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Cupom não encontrado' 
      }, { status: 404 })
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Cupom inativo' 
      }, { status: 400 })
    }

    // Check validity dates
    const now = new Date()
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Cupom ainda não está válido' 
      }, { status: 400 })
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Cupom expirado' 
      }, { status: 400 })
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Limite de uso do cupom atingido' 
      }, { status: 400 })
    }

    // Check if customer can use this coupon (one-time per customer)
    // 🔧 CORREÇÃO: Só verificar uso anterior se houver customerId
    if (customerId && coupon.isOneTimePerCustomer && coupon.CouponUsage && coupon.CouponUsage.length > 0) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Você já usou este cupom' 
      }, { status: 400 })
    }

    // Check minimum order value
    if (coupon.minOrderValue && orderTotal < coupon.minOrderValue) {
      return NextResponse.json({ 
        valid: false, 
        error: `Valor mínimo do pedido deve ser R$ ${coupon.minOrderValue.toFixed(2)}` 
      }, { status: 400 })
    }

    // Check if customer is in target audience
    // 🆕 Se o cupom NÃO é para todos, mas também não tem customerId (sem cadastro), pular validação
    if (!coupon.targetAllCustomers && customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          Order: {
            include: {
              OrderItem: {
                include: {
                  Product: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })

      if (!customer) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Cliente não encontrado' 
        }, { status: 404 })
      }

      // Check if customer is in specific list
      if (coupon.targetCustomerIds.length > 0 && !coupon.targetCustomerIds.includes(customerId)) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Este cupom não está disponível para você' 
        }, { status: 400 })
      }

      // Check if customer is in target city
      if (coupon.targetCities.length > 0 && !coupon.targetCities.includes(customer.city)) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Este cupom não está disponível para sua cidade' 
        }, { status: 400 })
      }

      // Check inactive days
      if (coupon.targetInactiveDays) {
        const lastOrder = customer.Order[0]
        if (lastOrder) {
          const daysSinceLastOrder = Math.floor(
            (now.getTime() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceLastOrder < coupon.targetInactiveDays) {
            return NextResponse.json({ 
              valid: false, 
              error: 'Este cupom é apenas para clientes inativos' 
            }, { status: 400 })
          }
        }
      }

      // Check purchase count
      if (coupon.targetMinPurchaseCount && customer.Order.length < coupon.targetMinPurchaseCount) {
        return NextResponse.json({ 
          valid: false, 
          error: `Este cupom requer no mínimo ${coupon.targetMinPurchaseCount} compras` 
        }, { status: 400 })
      }

      if (coupon.targetMaxPurchaseCount && customer.Order.length > coupon.targetMaxPurchaseCount) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Este cupom é apenas para novos clientes' 
        }, { status: 400 })
      }

      // Check specific products
      if (coupon.targetSpecificProducts.length > 0 && orderItems) {
        const hasTargetProduct = orderItems.some((item: any) => 
          coupon.targetSpecificProducts.includes(item.productId)
        )
        if (!hasTargetProduct) {
          return NextResponse.json({ 
            valid: false, 
            error: 'Este cupom é válido apenas para produtos específicos' 
          }, { status: 400 })
        }
      }
    }

    // Calculate discount
    let discountValue = 0
    if (coupon.discountType === 'FIXED') {
      discountValue = coupon.discountValue
    } else if (coupon.discountType === 'PERCENTAGE') {
      discountValue = orderTotal * (coupon.discountValue / 100)
    }

    // Apply maximum discount limit
    if (coupon.maxDiscount && discountValue > coupon.maxDiscount) {
      discountValue = coupon.maxDiscount
    }

    console.log('✅ [COUPON_VALIDATE] Cupom válido:', {
      code: coupon.code,
      discountAmount: discountValue,
      customerId: customerId || 'SEM CADASTRO'
    })

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discountAmount: discountValue
    })
  } catch (error) {
    console.error('Error validating coupon:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
