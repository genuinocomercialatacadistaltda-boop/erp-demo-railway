
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let notifications;

    // Admin vê suas notificações
    if (user?.userType === 'ADMIN') {
      notifications = await prisma.notification.findMany({
        where: {
          OR: [
            // Notificações antigas de NEW_ORDER (compatibilidade)
            { type: 'NEW_ORDER', isRead: false },
            // Notificações direcionadas para ADMIN (targetRole null = admin-only)
            { 
              targetRole: null,
              targetUserId: null
            }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });
    }
    // Clientes veem apenas suas notificações
    else if (user?.userType === 'CUSTOMER' && user?.customerId) {
      notifications = await prisma.notification.findMany({
        where: {
          targetRole: 'CUSTOMER',
          targetUserId: user.customerId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });
    }
    // Vendedores veem apenas suas notificações
    else if (user?.userType === 'SELLER' && user?.sellerId) {
      notifications = await prisma.notification.findMany({
        where: {
          targetRole: 'SELLER',
          targetUserId: user.sellerId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });
    }
    else {
      return NextResponse.json([]);
    }

    const serializedNotifications = notifications.map(notification => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
      readAt: notification.readAt?.toISOString() || null
    }))

    return NextResponse.json(serializedNotifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notificationId, markAllAsRead } = body

    if (markAllAsRead) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          type: 'NEW_ORDER',
          isRead: false
        },
        data: {
          isRead: true
        }
      })
    } else if (notificationId) {
      // Mark specific notification as read
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
