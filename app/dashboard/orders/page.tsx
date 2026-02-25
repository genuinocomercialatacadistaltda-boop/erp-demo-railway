
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { OrdersClient } from './_components/orders-client'

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'CUSTOMER') {
    redirect('/auth/login')
  }

  // Get customer data
  const customerData = await prisma.customer.findUnique({
    where: { id: user.customerId }
  })

  if (!customerData) {
    redirect('/auth/login')
  }

  // Get all orders for this customer with boletos
  const orders = await prisma.order.findMany({
    where: { customerId: customerData.id },
    include: {
      OrderItem: {
        include: {
          Product: true
        }
      },
      Boleto: true // Include boletos
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <OrdersClient 
      customer={customerData} 
      orders={orders}
      userName={user.name}
    />
  )
}
