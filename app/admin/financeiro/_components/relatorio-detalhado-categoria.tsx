"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Receipt, CreditCard, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RelatorioDetalhadoCategoriaProps {
  categoryName: string;
  categoryColor: string;
  startDate: string;
  endDate: string;
  onBack: () => void;
}

interface ExpenseDetail {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  type: 'EXPENSE' | 'CREDIT_CARD' | 'PURCHASE';
}

export default function RelatorioDetalhadoCategoria({
  categoryName,
  categoryColor,
  startDate,
  endDate,
  onBack
}: RelatorioDetalhadoCategoriaProps) {
  const [details, setDetails] = useState<ExpenseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategoryDetails();
  }, [categoryName, startDate, endDate]);

  const fetchCategoryDetails = async () => {
    try {
      setLoading(true);
      const url = `/api/financial/dashboard/category-details?categoryName=${encodeURIComponent(categoryName)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      console.log('🔍 [CATEGORY-DETAILS] Buscando:', url);
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Erro ao carregar detalhes');
      }
      
      const data = await res.json();
      setDetails(data.details || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CREDIT_CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'PURCHASE':
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CREDIT_CARD':
        return 'Cartão de Crédito';
      case 'PURCHASE':
        return 'Compra de Mercadoria';
      default:
        return 'Despesa Operacional';
    }
  };

  const total = details.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                />
                <CardTitle>{categoryName}</CardTitle>
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              R$ {total.toFixed(2)}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Detalhes */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes das Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : details.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma despesa encontrada nesta categoria
            </div>
          ) : (
            <div className="space-y-3">
              {details.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      {getTypeIcon(item.type)}
                    </div>
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-gray-500">
                        {getTypeLabel(item.type)} • {new Date(item.date).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      R$ {item.amount.toFixed(2)}
                    </div>
                    <div className="text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.status === 'PAID' ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
