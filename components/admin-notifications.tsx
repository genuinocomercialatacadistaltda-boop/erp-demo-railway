
'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [hasPlayedSound, setHasPlayedSound] = useState(false)

  // Poll for notifications every 10 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [])

  // Play sound when new notification arrives
  useEffect(() => {
    if (unreadCount > 0 && !hasPlayedSound) {
      playNotificationSound()
      setHasPlayedSound(true)
      
      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification('Novo Pedido - Espetos Genuíno', {
          body: 'Você recebeu um novo pedido!',
          icon: '/logo.jpg',
          badge: '/logo.jpg'
        })
      }
    }
    
    if (unreadCount === 0) {
      setHasPlayedSound(false)
    }
  }, [unreadCount, hasPlayedSound])

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const playNotificationSound = () => {
    try {
      // Create audio element with notification sound
      const audio = new Audio('data:audio/wav;base64,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')
      audio.volume = 0.3
      audio.play().catch(e => console.log('Audio play failed:', e))
    } catch (e) {
      console.log('Could not play sound:', e)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.isRead).length)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 animate-pulse"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? `${unreadCount} nova(s) notificação(ões)` : 'Nenhuma notificação nova'}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {unreadCount > 0 && (
            <Button 
              onClick={markAllAsRead} 
              variant="outline" 
              size="sm" 
              className="w-full"
            >
              Marcar todas como lidas
            </Button>
          )}
          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma notificação
              </p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    !notification.isRead
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{notification.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
