
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  ShoppingCart, 
  Table as TableIcon,
  Receipt,
  Package,
  AlertTriangle
} from "lucide-react";
import toast from "react-hot-toast";
import VendaNormalTab from "./_components/venda-normal-tab";
import ResumoVendasTab from "./_components/resumo-vendas-tab";
import ComandasTab from "./_components/comandas-tab";
import WasteTab from "./_components/waste-tab";

export default function PDVPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
    
    if (status === "authenticated" && (session?.user as any)?.userType !== "CUSTOMER") {
      toast.error("Acesso negado");
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => router.push("/customer/gestao")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              PDV / Vendas
            </h1>
            <p className="text-gray-600">Sistema de vendas e comandas</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="venda-normal" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="venda-normal" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Venda Normal
            </TabsTrigger>
            <TabsTrigger value="resumo-vendas" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Resumo do Dia
            </TabsTrigger>
            <TabsTrigger value="comandas" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Comandas/Mesas
            </TabsTrigger>
            <TabsTrigger value="desperdicio" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Desperdício
            </TabsTrigger>
          </TabsList>

          <TabsContent value="venda-normal">
            <VendaNormalTab />
          </TabsContent>

          <TabsContent value="resumo-vendas">
            <ResumoVendasTab />
          </TabsContent>

          <TabsContent value="comandas">
            <ComandasTab />
          </TabsContent>

          <TabsContent value="desperdicio">
            <WasteTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
