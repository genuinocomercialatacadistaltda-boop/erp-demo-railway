export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// Get list of customers that match the coupon criteria
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
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
    } = await request.json()

    let customerQuery: any = {
      where: {},
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
            createdAt: 'desc' as const
          }
        }
      }
    }

    // If specific customer IDs are provided
    if (targetCustomerIds && targetCustomerIds.length > 0) {
      customerQuery.where.id = { in: targetCustomerIds }
    }

    // If specific cities are targeted
    if (targetCities && targetCities.length > 0) {
      customerQuery.where.city = { in: targetCities }
    }

    // Fetch all customers based on basic filters
    let customers = await prisma.customer.findMany(customerQuery)

    const now = new Date()

    // Apply inactive days filter
    if (targetInactiveDays) {
      customers = customers.filter((customer: any) => {
        if (customer.Order.length === 0) return true
        const lastOrder = customer.Order[0]
        const daysSinceLastOrder = Math.floor(
          (now.getTime() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysSinceLastOrder >= targetInactiveDays
      })
    }

    // Apply purchase count filters
    if (targetMinPurchaseCount) {
      customers = customers.filter((customer: any) => customer.Order.length >= targetMinPurchaseCount)
    }

    if (targetMaxPurchaseCount) {
      customers = customers.filter((customer: any) => customer.Order.length <= targetMaxPurchaseCount)
    }

    // Apply specific products filter
    if (targetSpecificProducts && targetSpecificProducts.length > 0) {
      customers = customers.filter((customer: any) => {
        // Check if customer has purchased any of the target products
        const hasPurchasedTargetProduct = customer.Order.some((order: any) =>
          order.OrderItem.some((item: any) => targetSpecificProducts.includes(item.productId))
        )
        return hasPurchasedTargetProduct
      })
    }

    // FILTRO ESTRATÉGICO 1: Volume de compras decrescente
    if (targetDecreasingVolume && targetVolumeDecreasePercent) {
      customers = customers.filter((customer: any) => {
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

        // Total dos últimos 30 dias
        const recentTotal = customer.Order
          .filter((order: any) => new Date(order.createdAt) >= last30Days)
          .reduce((sum: number, order: any) => sum + order.total, 0)

        // Total dos 30-60 dias anteriores
        const previousTotal = customer.Order
          .filter((order: any) => {
            const orderDate = new Date(order.createdAt)
            return orderDate >= last60Days && orderDate < last30Days
          })
          .reduce((sum: number, order: any) => sum + order.total, 0)

        // Calcular queda percentual
        if (previousTotal === 0) return false // Não houve compras anteriores para comparar
        
        const decreasePercent = ((previousTotal - recentTotal) / previousTotal) * 100
        return decreasePercent >= targetVolumeDecreasePercent
      })
    }

    // FILTRO ESTRATÉGICO 2: Mudança no padrão de produtos
    if (targetProductDiversityChange && targetPreviousProducts && targetCurrentProducts && 
        targetPreviousProducts.length > 0 && targetCurrentProducts.length > 0) {
      customers = customers.filter((customer: any) => {
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

        // Produtos comprados nos últimos 30 dias
        const recentProductIds = new Set(
          customer.Order
            .filter((order: any) => new Date(order.createdAt) >= last30Days)
            .flatMap((order: any) => 
              order.OrderItem.map((item: any) => item.productId)
            )
        )

        // Produtos comprados entre 60-90 dias atrás
        const previousProductIds = new Set(
          customer.Order
            .filter((order: any) => {
              const orderDate = new Date(order.createdAt)
              return orderDate >= last90Days && orderDate < last60Days
            })
            .flatMap((order: any) => 
              order.OrderItem.map((item: any) => item.productId)
            )
        )

        // Verificar se o cliente comprava os produtos anteriores
        const boughtPreviousProducts = targetPreviousProducts.some(
          (productId: string) => previousProductIds.has(productId)
        )

        // Verificar se o cliente compra os produtos atuais
        const buyingCurrentProducts = targetCurrentProducts.some(
          (productId: string) => recentProductIds.has(productId)
        )

        // Verificar se diminuiu a variedade (comprava produtos anteriores mas agora não)
        const stoppedBuyingPreviousProducts = targetPreviousProducts.some(
          (productId: string) => previousProductIds.has(productId) && !recentProductIds.has(productId)
        )

        return boughtPreviousProducts && buyingCurrentProducts && stoppedBuyingPreviousProducts
      })
    }

    // Format customer data for response
    const formattedCustomers = customers.map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      orderCount: customer.Order.length,
      lastOrderDate: customer.Order[0]?.createdAt || null,
      daysSinceLastOrder: customer.Order[0] 
        ? Math.floor((now.getTime() - new Date(customer.Order[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : null
    }))

    return NextResponse.json({
      count: formattedCustomers.length,
      customers: formattedCustomers
    })
  } catch (error) {
    console.error('Error fetching target customers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
