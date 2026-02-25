
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import BoletosManagement from "./_components/boletos-management";

export default async function BoletosPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!session || user?.userType !== 'ADMIN') {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Boletos</h1>
        <p className="text-muted-foreground mt-2">
          Controle total sobre todos os boletos do sistema
        </p>
      </div>

      <BoletosManagement />
    </div>
  );
}
