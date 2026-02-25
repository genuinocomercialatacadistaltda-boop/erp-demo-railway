
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { NotificationsClient } from './_components/notifications-client'

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
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

  // Get notifications for this customer
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        {
          targetRole: null,
          targetUserId: null
        },
        {
          targetUserId: customerData.id
        }
      ]
    },
    orderBy: { createdAt: 'desc' }
  })

  // Serialize the data to avoid hydration issues
  const serializedCustomerData = JSON.parse(JSON.stringify(customerData))
  const serializedNotifications = JSON.parse(JSON.stringify(notifications))

  return (
    <NotificationsClient 
      customer={serializedCustomerData} 
      notifications={serializedNotifications}
      userName={user.name}
    />
  )
}
