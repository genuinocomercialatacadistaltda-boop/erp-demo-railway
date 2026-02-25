
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardFinanceiro from "./_components/dashboard-financeiro";
import ContasBancarias from "./_components/contas-bancarias";
import ContasPagar from "./_components/contas-pagar";
import ContasReceberFase2 from "./_components/contas-receber-fase2";
import CategoriasD from "./_components/categorias-despesas";
import Fornecedores from "./_components/fornecedores";
import RelatoriosCompletos from "./_components/relatorios-completos";
import CartoesCredito from "./_components/cartoes-credito";
import GestaoClientes from "./_components/gestao-clientes";
import { FinancialAlerts } from "./_components/financial-alerts";
import { CashflowPrediction } from "./_components/cashflow-prediction";
import { 
  LayoutDashboard, 
  Landmark, 
  FileText, 
  Receipt, 
  Tags,
  TrendingUp,
  Building2,
  BarChart3,
  AlertCircle,
  LineChart,
  CreditCard,
  Home,
  ArrowLeft,
  Users
} from "lucide-react";

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const router = useRouter();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Botões de Navegação */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = "/admin"}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Página Inicial
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.history.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            Gestão Financeira Completa
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Controle total, previsões inteligentes e alertas automáticos
          </p>
        </div>
      </div>

      <Card className="p-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-11 gap-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="previsao" className="flex items-center gap-1">
              <LineChart className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Previsão</span>
            </TabsTrigger>
            <TabsTrigger value="contas" className="flex items-center gap-1">
              <Landmark className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Contas</span>
            </TabsTrigger>
            <TabsTrigger value="cartoes" className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Cartões</span>
            </TabsTrigger>
            <TabsTrigger value="pagar" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">A Pagar</span>
            </TabsTrigger>
            <TabsTrigger value="receber" className="flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">A Receber</span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Fornecedores</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-1">
              <Tags className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">Categorias</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="dashboard" className="mt-0">
              <DashboardFinanceiro />
            </TabsContent>

            <TabsContent value="alertas" className="mt-0">
              <FinancialAlerts />
            </TabsContent>

            <TabsContent value="previsao" className="mt-0">
              <CashflowPrediction />
            </TabsContent>

            <TabsContent value="contas" className="mt-0">
              <ContasBancarias />
            </TabsContent>

            <TabsContent value="cartoes" className="mt-0">
              <CartoesCredito />
            </TabsContent>

            <TabsContent value="pagar" className="mt-0">
              <ContasPagar />
            </TabsContent>

            <TabsContent value="receber" className="mt-0">
              <ContasReceberFase2 />
            </TabsContent>

            <TabsContent value="clientes" className="mt-0">
              <GestaoClientes />
            </TabsContent>

            <TabsContent value="fornecedores" className="mt-0">
              <Fornecedores />
            </TabsContent>

            <TabsContent value="relatorios" className="mt-0">
              <RelatoriosCompletos />
            </TabsContent>

            <TabsContent value="categorias" className="mt-0">
              <CategoriasD />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
