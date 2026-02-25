
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const categoryColors: Record<string, string> = {
  COMMISSION: "bg-green-500",
  CUSTOMER_ALERT: "bg-amber-500",
  PRODUCT_ALERT: "bg-blue-500",
  COUPON: "bg-purple-500",
  FINANCIAL: "bg-red-500",
  GENERAL: "bg-gray-500",
};

const categoryLabels: Record<string, string> = {
  COMMISSION: "Comissão",
  CUSTOMER_ALERT: "Cliente",
  PRODUCT_ALERT: "Produto",
  COUPON: "Cupom",
  FINANCIAL: "Financeiro",
  GENERAL: "Geral",
};

export default function NotificationsClient() {
  const { data: session } = useSession() || {};
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      fetchNotifications();
    }
  }, [session]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      toast.error("Erro ao carregar notificações");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (!response.ok) throw new Error();

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      toast.success("Notificação marcada como lida");
    } catch (error) {
      toast.error("Erro ao marcar notificação");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notificação deletada");
    } catch (error) {
      toast.error("Erro ao deletar notificação");
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? (
              <>
                Você tem <strong>{unreadCount}</strong> notificação{unreadCount !== 1 ? "ões" : ""} não lida{unreadCount !== 1 ? "s" : ""}
              </>
            ) : (
              "Todas as notificações foram lidas"
            )}
          </p>
        </div>
        <Button onClick={fetchNotifications} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma notificação ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`${
                notification.isRead ? "bg-muted/30" : "bg-card border-l-4 border-l-blue-500"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="secondary"
                        className={`${categoryColors[notification.category]} text-white`}
                      >
                        {categoryLabels[notification.category] || notification.category}
                      </Badge>
                      {!notification.isRead && (
                        <Badge variant="default">Nova</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {format(new Date(notification.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    {!notification.isRead && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">{notification.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
