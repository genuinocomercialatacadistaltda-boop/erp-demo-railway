'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { PendingTransactions } from './_components/pending-transactions';
import { ReceivedTransactions } from './_components/received-transactions';
import { FeeConfiguration } from './_components/fee-configuration';
import { CardReports } from './_components/card-reports';

export default function CardManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-orange-800">
              Gestão de Cartões
            </h1>
            <p className="text-orange-600 mt-1">
              Gerencie vendas com cartão de débito e crédito
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/customer/gestao")}
              variant="outline"
              size="sm"
            >
              <Home className="w-4 h-4 mr-2" />
              Meu Negócio
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-md">
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="received">Recebidos</TabsTrigger>
            <TabsTrigger value="fees">Taxas</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <PendingTransactions />
          </TabsContent>

          <TabsContent value="received" className="mt-6">
            <ReceivedTransactions />
          </TabsContent>

          <TabsContent value="fees" className="mt-6">
            <FeeConfiguration />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <CardReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
