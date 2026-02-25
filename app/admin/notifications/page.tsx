
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import NotificationsManagement from "./_components/notifications-management";
import AutomaticConfigsTab from "./_components/automatic-configs-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminNotificationsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!session || user?.userType !== 'ADMIN') {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Notificações</h1>
        <p className="text-muted-foreground mt-2">
          Envie notificações manuais e gerencie configurações automáticas do sistema
        </p>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList>
          <TabsTrigger value="manual">Enviar Notificações</TabsTrigger>
          <TabsTrigger value="automatic">Configurações Automáticas</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <NotificationsManagement />
        </TabsContent>

        <TabsContent value="automatic" className="space-y-6">
          <AutomaticConfigsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
