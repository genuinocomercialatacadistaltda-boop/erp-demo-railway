
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { ReportsPage } from './reports-page'

export const dynamic = "force-dynamic"

export default async function Reports() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'ADMIN') {
    redirect('/auth/login')
  }

  // Get current date info
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Sales by month (last 12 months)
  const salesByMonth = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const date = new Date(currentYear, currentMonth - i, 1)
      const nextMonth = new Date(currentYear, currentMonth - i + 1, 1)

      const orders = await prisma.order.aggregate({
        _sum: {
          total: true
        },
        _count: {
          id: true
        },
        where: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: date,
            lt: nextMonth
          }
        }
      })

      return {
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        revenue: Number(orders._sum.total || 0),
        orders: orders._count.id
      }
    })
  )

  // Sales by day (last 30 days)
  const salesByDay = await Promise.all(
    Array.from({ length: 30 }, async (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      date.setHours(0, 0, 0, 0)
      
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const orders = await prisma.order.aggregate({
        _sum: {
          total: true
        },
        _count: {
          id: true
        },
        where: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: date,
            lt: nextDay
          }
        }
      })

      return {
        day: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: Number(orders._sum.total || 0),
        orders: orders._count.id
      }
    })
  )

  // Top customers
  const customers = await prisma.customer.findMany({
    include: {
      Order: {
        where: {
          status: { not: 'CANCELLED' }
        },
        select: {
          total: true
        }
      }
    }
  })

  // 🔧 Agora busca TODOS os clientes (não limita a 10)
  const allCustomersRanked = customers
    .map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      city: customer.city,
      totalSpent: customer.Order.reduce((sum: number, order: any) => sum + Number(order.total), 0),
      orderCount: customer.Order.length
    }))
    .filter((c: any) => c.totalSpent > 0) // Filtra clientes com vendas
    .sort((a: any, b: any) => b.totalSpent - a.totalSpent)

  // 🔧 Agora busca TODOS os produtos (não limita a 10)
  const orderItems = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: {
      quantity: true,
      total: true
    },
    _count: {
      id: true
    },
    orderBy: {
      _sum: {
        total: 'desc'
      }
    }
    // ❌ Removido: take: 10
  })

  const productIds = orderItems
    .map((item: any) => item.productId)
    .filter((id: any) => id !== null) // 🔧 Filtrar IDs nulos
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds }
    }
  })

  const allProductsRanked = orderItems.map((item: any) => {
    const product = products.find((p: any) => p.id === item.productId)
    return {
      id: item.productId,
      name: product?.name || 'Produto não encontrado',
      quantitySold: Number(item._sum.quantity || 0),
      revenue: Number(item._sum.total || 0),
      orderCount: item._count.id
    }
  })

  // Overall stats
  const totalRevenue = await prisma.order.aggregate({
    _sum: {
      total: true
    },
    where: {
      status: { not: 'CANCELLED' }
    }
  })

  const totalOrders = await prisma.order.count({
    where: {
      status: { not: 'CANCELLED' }
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

  // Inactive customers (no orders in last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const allCustomersWithOrders = await prisma.customer.findMany({
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

  const inactiveCustomers = allCustomersWithOrders
    .filter((customer: any) => {
      // Customer has no orders OR last order was more than 7 days ago
      if (customer.Order.length === 0) {
        return true
      }
      const lastOrder = customer.Order[0]
      return lastOrder.createdAt < sevenDaysAgo
    })
    .map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      lastOrderDate: customer.Order[0]?.createdAt || null,
      daysSinceLastOrder: customer.Order[0] 
        ? Math.floor((now.getTime() - customer.Order[0].createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null
    }))
    .sort((a: any, b: any) => {
      // Sort by days since last order (highest first), then by name
      if (a.daysSinceLastOrder === null && b.daysSinceLastOrder === null) return a.name.localeCompare(b.name)
      if (a.daysSinceLastOrder === null) return -1
      if (b.daysSinceLastOrder === null) return 1
      return b.daysSinceLastOrder - a.daysSinceLastOrder
    })

  return (
    <ReportsPage 
      stats={stats}
      salesByMonth={salesByMonth.reverse()}
      salesByDay={salesByDay}
      allCustomersRanked={allCustomersRanked}
      allProductsRanked={allProductsRanked}
      inactiveCustomers={inactiveCustomers}
    />
  )
}
