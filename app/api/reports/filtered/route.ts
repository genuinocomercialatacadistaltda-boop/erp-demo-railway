export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'startDate e endDate são obrigatórios' },
        { status: 400 }
      )
    }

    const startDate = new Date(startDateParam)
    const endDate = new Date(endDateParam)
    endDate.setHours(23, 59, 59, 999) // Fim do dia

    // Calcular diferença de dias entre startDate e endDate
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const isSingleDay = startDateParam === endDateParam || daysDiff <= 1
    
    // Sales by period (adapta conforme o período selecionado)
    const monthsInPeriod: any[] = []
    
    if (isSingleDay) {
      // Para um único dia, mostrar apenas esse dia
      const dayOrders = await prisma.order.aggregate({
        _sum: { total: true },
        _count: { id: true },
        where: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
      
      monthsInPeriod.push({
        month: startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        revenue: Number(dayOrders._sum.total || 0),
        orders: dayOrders._count.id
      })
    } else {
      // Para períodos maiores, agrupar por mês
      const currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        // Usar o período exato para o primeiro e último mês
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999)
        
        // Ajustar para usar o período filtrado real
        const queryStart = monthStart < startDate ? startDate : monthStart
        const queryEnd = monthEnd > endDate ? endDate : monthEnd
        
        const orders = await prisma.order.aggregate({
          _sum: { total: true },
          _count: { id: true },
          where: {
            status: { not: 'CANCELLED' },
            createdAt: {
              gte: queryStart,
              lte: queryEnd
            }
          }
        })

        monthsInPeriod.push({
          month: monthStart.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          revenue: Number(orders._sum.total || 0),
          orders: orders._count.id
        })
        
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    }

    // Top customers (filtered by date)
    const customers = await prisma.customer.findMany({
      include: {
        Order: {
          where: {
            status: { not: 'CANCELLED' },
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            total: true
          }
        }
      }
    })

    const allCustomersRanked = customers
      .map((customer: any) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        city: customer.city,
        totalSpent: customer.Order.reduce((sum: number, order: any) => sum + Number(order.total), 0),
        orderCount: customer.Order.length
      }))
      .filter((c: any) => c.totalSpent > 0)
      .sort((a: any, b: any) => b.totalSpent - a.totalSpent)

    // Top products (filtered by date)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        Order: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      },
      include: {
        Product: {
          select: {
            name: true
          }
        }
      }
    })

    // Agrupar produtos
    const productsMap = new Map()
    orderItems.forEach((item: any) => {
      if (!item.productId) return
      
      const existing = productsMap.get(item.productId) || {
        id: item.productId,
        name: item.Product?.name || 'Produto não encontrado',
        quantitySold: 0,
        revenue: 0,
        orderCount: 0
      }
      
      existing.quantitySold += Number(item.quantity || 0)
      existing.revenue += Number(item.total || 0)
      existing.orderCount += 1
      
      productsMap.set(item.productId, existing)
    })

    const allProductsRanked = Array.from(productsMap.values())
      .sort((a: any, b: any) => b.revenue - a.revenue)

    // Overall stats (filtered by date)
    const totalRevenue = await prisma.order.aggregate({
      _sum: {
        total: true
      },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const totalOrders = await prisma.order.count({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const totalCustomers = await prisma.customer.count()

    const averageOrderValue = totalOrders > 0 
      ? Number(totalRevenue._sum.total || 0) / totalOrders
      : 0

    const stats = {
      totalRevenue: Number(totalRevenue._sum.total || 0),
      totalOrders,
      totalCustomers,
      averageOrderValue
    }

    // Inactive customers (no orders in the selected period)
    const customersWithOrders = await prisma.customer.findMany({
      include: {
        Order: {
          where: {
            status: { not: 'CANCELLED' }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    })

    const inactiveCustomers = customersWithOrders
      .filter((customer: any) => {
        if (!customer.Order || customer.Order.length === 0) return false
        const lastOrderDate = customer.Order[0]?.createdAt
        if (!lastOrderDate) return false
        return lastOrderDate < startDate
      })
      .map((customer: any) => {
        const lastOrderDate = customer.Order[0]?.createdAt
        const daysSinceLastOrder = lastOrderDate
          ? Math.floor((new Date().getTime() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
          : null
        
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          city: customer.city,
          lastOrderDate: lastOrderDate,
          daysSinceLastOrder
        }
      })
      .sort((a: any, b: any) => (b.daysSinceLastOrder || 0) - (a.daysSinceLastOrder || 0))

    // Sales by day for the filtered period
    const salesByDay: Array<{ day: string; revenue: number; orders: number }> = []
    const currentDay = new Date(startDate)
    
    while (currentDay <= endDate) {
      const dayStart = new Date(currentDay)
      dayStart.setHours(0, 0, 0, 0)
      
      const dayEnd = new Date(currentDay)
      dayEnd.setHours(23, 59, 59, 999)

      const dayOrders = await prisma.order.aggregate({
        _sum: { total: true },
        _count: { id: true },
        where: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      })

      salesByDay.push({
        day: dayStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: Number(dayOrders._sum.total || 0),
        orders: dayOrders._count.id
      })
      
      currentDay.setDate(currentDay.getDate() + 1)
    }

    return NextResponse.json({
      stats,
      salesByMonth: monthsInPeriod.reverse(),
      salesByDay,
      allCustomersRanked,
      allProductsRanked,
      inactiveCustomers
    })

  } catch (error) {
    console.error('[REPORTS_FILTERED_GET] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar relatórios filtrados' },
      { status: 500 }
    )
  }
}
