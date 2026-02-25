
'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  BellOff,
  ArrowLeft,
  LogOut,
  Home,
  CheckCircle2,
  AlertCircle,
  Info,
  Package,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface NotificationsClientProps {
  customer: any
  notifications: any[]
  userName: string
}

export function NotificationsClient({ customer, notifications, userName }: NotificationsClientProps) {
  const [notificationsList, setNotificationsList] = useState(notifications)
  const [markingAsRead, setMarkingAsRead] = useState(false)

  const formatDate = (date: string) => {
    const notifDate = new Date(date)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - notifDate.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffTime / (1000 * 60))

    if (diffMinutes < 1) return 'Agora'
    if (diffMinutes < 60) return `${diffMinutes} min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    
    return notifDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: notifDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      NEW_ORDER: <Package className="w-5 h-5 text-blue-600" />,
      ORDER_STATUS: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      PAYMENT: <DollarSign className="w-5 h-5 text-emerald-600" />,
      PROMOTION: <TrendingUp className="w-5 h-5 text-orange-600" />,
      ALERT: <AlertCircle className="w-5 h-5 text-red-600" />,
      INFO: <Info className="w-5 h-5 text-gray-600" />
    }
    return icons[type] || icons.INFO
  }

  const getNotificationColor = (type: string) => {
    const colors: Record<string, string> = {
      NEW_ORDER: 'bg-blue-50 border-blue-200',
      ORDER_STATUS: 'bg-green-50 border-green-200',
      PAYMENT: 'bg-emerald-50 border-emerald-200',
      PROMOTION: 'bg-orange-50 border-orange-200',
      ALERT: 'bg-red-50 border-red-200',
      INFO: 'bg-gray-50 border-gray-200'
    }
    return colors[type] || colors.INFO
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      })

      if (response.ok) {
        setNotificationsList(prev => 
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        )
        toast.success('Notificação marcada como lida')
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Erro ao marcar notificação como lida')
    }
  }

  const markAllAsRead = async () => {
    setMarkingAsRead(true)
    try {
      const unreadNotifications = notificationsList.filter(n => !n.isRead)
      
      await Promise.all(
        unreadNotifications.map(n => 
          fetch(`/api/notifications/${n.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRead: true })
          })
        )
      )

      setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })))
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Erro ao marcar notificações como lidas')
    } finally {
      setMarkingAsRead(false)
    }
  }

  const unreadCount = notificationsList.filter(n => !n.isRead).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">[SUA EMPRESA]</h1>
              <p className="text-xs text-gray-600">Notificações</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <Home className="w-5 h-5" />
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-4xl px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Notificações
              </h1>
              <p className="text-lg text-gray-600">
                {unreadCount > 0 ? (
                  <span>Você tem <strong>{unreadCount}</strong> notificação{unreadCount !== 1 ? 'ões' : ''} não lida{unreadCount !== 1 ? 's' : ''}</span>
                ) : (
                  <span>Todas as notificações foram lidas</span>
                )}
              </p>
            </div>
            
            {unreadCount > 0 && (
              <Button 
                onClick={markAllAsRead}
                disabled={markingAsRead}
                variant="outline"
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {notificationsList.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BellOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nenhuma notificação
              </h3>
              <p className="text-gray-600">
                Você não tem notificações no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notificationsList.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={`
                    ${getNotificationColor(notification.type)} 
                    border shadow-sm hover:shadow-md transition-all
                    ${!notification.isRead ? 'border-l-4' : ''}
                  `}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                            <Badge className="bg-red-600 text-white shrink-0">Novo</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-3">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {formatDate(notification.createdAt)}
                          </span>
                          
                          {!notification.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs"
                            >
                              Marcar como lida
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
