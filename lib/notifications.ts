
import { prisma } from "@/lib/db";
import { NotificationCategory, NotificationType, UserRole } from "@prisma/client";

/**
 * Cria uma notificação automática no sistema
 */
export async function createNotification({
  title,
  message,
  category,
  targetRole,
  targetUserId,
  type = "COMMUNICATION",
}: {
  title: string;
  message: string;
  category: NotificationCategory;
  targetRole: UserRole;
  targetUserId: string;
  type?: NotificationType;
}) {
  try {
    await prisma.notification.create({
      data: {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title,
        message,
        category,
        deliveryMode: "AUTOMATIC",
        targetRole,
        targetUserId,
        type,
      },
    });
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
  }
}

/**
 * Notifica cliente sobre mudança de status do pedido
 */
export async function notifyOrderStatusChange(
  orderId: string,
  customerId: string,
  status: string
) {
  const statusMessages: Record<string, { title: string; message: string }> = {
    CONFIRMED: {
      title: "✅ Pedido Confirmado",
      message: "Seu pedido foi confirmado e está sendo preparado!",
    },
    PREPARING: {
      title: "👨‍🍳 Pedido em Preparo",
      message: "Estamos preparando seu pedido com todo carinho!",
    },
    READY: {
      title: "📦 Pedido Pronto",
      message: "Seu pedido está pronto para retirada ou entrega!",
    },
    DELIVERED: {
      title: "🎉 Pedido Entregue",
      message: "Parabéns! Seu pedido chegou!",
    },
    CANCELLED: {
      title: "❌ Pedido Cancelado",
      message: "Seu pedido foi cancelado. Entre em contato para mais informações.",
    },
  };

  const notification = statusMessages[status];
  if (notification) {
    await createNotification({
      title: notification.title,
      message: notification.message,
      category: "ORDER" as NotificationCategory,
      targetRole: "CUSTOMER" as UserRole,
      targetUserId: customerId,
      type: "ORDER_UPDATE" as NotificationType,
    });
  }
}

/**
 * Notifica cliente sobre vencimento próximo de boleto
 */
export async function notifyBoletoDueSoon(
  boletoId: string,
  customerId: string,
  dueDate: Date
) {
  await createNotification({
    title: "⚠️ Boleto Vencendo",
    message: `Seu boleto vence em ${dueDate.toLocaleDateString("pt-BR")}. Não esqueça de pagar!`,
    category: "BOLETO" as NotificationCategory,
    targetRole: "CUSTOMER" as UserRole,
    targetUserId: customerId,
    type: "COMMUNICATION" as NotificationType,
  });
}

/**
 * Notifica cliente sobre boleto vencido
 */
export async function notifyBoletoOverdue(
  boletoId: string,
  customerId: string
) {
  await createNotification({
    title: "🚨 Boleto Vencido",
    message: "Seu boleto está vencido. Entre em contato para regularizar.",
    category: "BOLETO" as NotificationCategory,
    targetRole: "CUSTOMER" as UserRole,
    targetUserId: customerId,
    type: "COMMUNICATION" as NotificationType,
  });
}

/**
 * Notifica vendedor sobre nova comissão
 */
export async function notifyNewCommission(
  sellerId: string,
  amount: number
) {
  await createNotification({
    title: "💰 Nova Comissão",
    message: `Você tem uma nova comissão de R$ ${amount.toFixed(2)} disponível!`,
    category: "COMMISSION" as NotificationCategory,
    targetRole: "SELLER" as UserRole,
    targetUserId: sellerId,
    type: "COMMUNICATION" as NotificationType,
  });
}

/**
 * Notifica vendedor sobre cliente inativo
 */
export async function notifyInactiveCustomer(
  sellerId: string,
  customerName: string,
  daysInactive: number
) {
  await createNotification({
    title: "⚠️ Cliente Inativo",
    message: `${customerName} está sem comprar há ${daysInactive} dias. Entre em contato!`,
    category: "CUSTOMER_ALERT" as NotificationCategory,
    targetRole: "SELLER" as UserRole,
    targetUserId: sellerId,
    type: "COMMUNICATION" as NotificationType,
  });
}
