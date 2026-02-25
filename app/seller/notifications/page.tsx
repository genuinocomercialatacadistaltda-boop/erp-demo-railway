
import { Suspense } from "react";
import { Metadata } from "next";
import NotificationsClient from "./_components/notifications-client";

export const metadata: Metadata = {
  title: "Notificações | Vendedor",
  description: "Suas notificações e alertas",
};

export default function SellerNotificationsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Suspense fallback={<div>Carregando notificações...</div>}>
        <NotificationsClient />
      </Suspense>
    </div>
  );
}
