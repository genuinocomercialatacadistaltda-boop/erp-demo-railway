
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface PredictionData {
  // Informações do mês
  currentDay: number;
  totalDaysInMonth: number;
  
  // Receita Bruta
  receitaBrutaAteHoje: number;
  mediaDiariaReceitaBruta: number;
  previsaoReceitaBruta: number;
  
  // Receita Líquida
  receitaLiquidaAteHoje: number;
  mediaDiariaReceitaLiquida: number;
  previsaoReceitaLiquida: number;
  
  // Despesas Operacionais
  despesasOpAteHoje: number;
  mediaDiariaDespesasOp: number;
  previsaoDespesasOp: number;
  
  // Despesas com Produtos
  despesasProdAteHoje: number;
  mediaDiariaDespesasProd: number;
  previsaoDespesasProd: number;
  
  // Compras de Mercadorias
  comprasMercadoriasAteHoje: number;
  mediaDiariaComprasMercadorias: number;
  previsaoComprasMercadorias: number;
  
  // Investimentos
  investimentosAteHoje: number;
  mediaDiariaInvestimentos: number;
  previsaoInvestimentos: number;
  
  // Prolabore
  prolaboresAteHoje: number;
  mediaDiariaProlabore: number;
  previsaoProlabore: number;
  
  // Lucros
  custosDiretosPrevisto: number;
  custosIndiretosPrevisto: number;
  lucroBrutoPrevisto: number;
  lucroLiquidoPrevisto: number;
  
  // Fluxo de caixa
  currentBalance: number;
  avgDailyCredit: number;
  avgDailyDebit: number;
  projection: Array<{
    date: string;
    expectedCredit: number;
    expectedDebit: number;
    projectedBalance: number;
    scheduledReceivables: number;
    scheduledExpenses: number;
  }>;
  alerts: Array<{
    date: string;
    message: string;
    severity: string;
  }>;
}

export function CashflowPrediction() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPrediction();
  }, [days]);

  const loadPrediction = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/financial/predictions/simple?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Validar dados recebidos
      if (!result.projection || !Array.isArray(result.projection)) {
        throw new Error('Dados de projeção inválidos');
      }
      
      setData(result);
    } catch (error: any) {
      console.error('Erro ao carregar previsão:', error);
      setError(error.message || 'Erro ao carregar previsão');
      toast.error('Erro ao carregar previsão de fluxo de caixa');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-96 bg-gray-100 rounded-lg" />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.projection || data.projection.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 text-center">Sem dados disponíveis para previsão</p>
        </CardContent>
      </Card>
    );
  }

  const lastProjection = data.projection[data.projection.length - 1];
  const trend = lastProjection.projectedBalance > data.currentBalance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Previsão de Fluxo de Caixa</h3>
        <div className="text-sm text-gray-600">
          Hoje é dia <span className="font-bold">{data.currentDay}</span> de <span className="font-bold">{data.totalDaysInMonth}</span>
        </div>
      </div>

      {/* RECEITAS */}
      <div className="space-y-3">
        <h4 className="font-semibold text-green-700 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Receitas
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Receita Bruta */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">💰 Receita Bruta (Faturamento)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje (dia {data.currentDay})</p>
                <p className="text-lg font-bold text-green-700">R$ {data.receitaBrutaAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média diária</p>
                <p className="text-base font-semibold">R$ {data.mediaDiariaReceitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">📈 Previsão para o mês ({data.totalDaysInMonth} dias)</p>
                <p className="text-xl font-bold text-green-600">R$ {data.previsaoReceitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Receita Líquida */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">💵 Receita Líquida (Valores Pagos/Recebidos)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje (dia {data.currentDay})</p>
                <p className="text-lg font-bold text-emerald-700">R$ {data.receitaLiquidaAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média diária</p>
                <p className="text-base font-semibold">R$ {data.mediaDiariaReceitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">📈 Previsão para o mês ({data.totalDaysInMonth} dias)</p>
                <p className="text-xl font-bold text-emerald-600">R$ {data.previsaoReceitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DESPESAS E INVESTIMENTOS */}
      <div className="space-y-3">
        <h4 className="font-semibold text-red-700 flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Despesas e Investimentos
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Despesas Operacionais */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">📉 Despesas Operacionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje</p>
                <p className="text-base font-bold text-red-700">R$ {data.despesasOpAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média/dia</p>
                <p className="text-sm font-semibold">R$ {data.mediaDiariaDespesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">Previsão mês</p>
                <p className="text-lg font-bold text-red-600">R$ {data.previsaoDespesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Despesas com Produtos */}
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">🛒 Despesas com Produtos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje</p>
                <p className="text-base font-bold text-orange-700">R$ {data.despesasProdAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média/dia</p>
                <p className="text-sm font-semibold">R$ {data.mediaDiariaDespesasProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">Previsão mês</p>
                <p className="text-lg font-bold text-orange-600">R$ {data.previsaoDespesasProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Compras de Mercadorias */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">🛍️ Compras de Mercadorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje</p>
                <p className="text-base font-bold text-amber-700">R$ {data.comprasMercadoriasAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média/dia</p>
                <p className="text-sm font-semibold">R$ {data.mediaDiariaComprasMercadorias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">Previsão mês</p>
                <p className="text-lg font-bold text-amber-600">R$ {data.previsaoComprasMercadorias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Investimentos */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">📈 Investimentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje</p>
                <p className="text-base font-bold text-purple-700">R$ {data.investimentosAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média/dia</p>
                <p className="text-sm font-semibold">R$ {data.mediaDiariaInvestimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">Previsão mês</p>
                <p className="text-lg font-bold text-purple-600">R$ {data.previsaoInvestimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Prolabore */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">👔 Prolabore</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Até hoje</p>
                <p className="text-base font-bold text-blue-700">R$ {data.prolaboresAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Média/dia</p>
                <p className="text-sm font-semibold">R$ {data.mediaDiariaProlabore.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">Previsão mês</p>
                <p className="text-lg font-bold text-blue-600">R$ {data.previsaoProlabore.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* LUCROS PREVISTOS NO FINAL DO MÊS */}
      <div className="space-y-3">
        <h4 className="font-semibold text-indigo-700 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Lucros Previstos no Final do Mês
        </h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LUCRO BRUTO */}
          <Card className={`border-l-4 ${data.lucroBrutoPrevisto >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">💼 Lucro Bruto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Receita Bruta */}
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-semibold text-green-700">💰 Receita Bruta (Faturamento)</span>
                <span className="text-lg font-bold text-green-700">
                  R$ {data.previsaoReceitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Custos Diretos */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">(-) Despesas Operacionais</span>
                  <span className="text-red-600 font-semibold">
                    R$ {data.previsaoDespesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">(-) Despesas com Produtos</span>
                  <span className="text-red-600 font-semibold">
                    R$ {data.previsaoDespesasProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">(-) Compras de Mercadorias</span>
                  <span className="text-red-600 font-semibold">
                    R$ {data.previsaoComprasMercadorias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Total Custos Diretos */}
              <div className="flex justify-between items-center py-2 border-t border-b">
                <span className="text-sm font-semibold text-gray-700">Total Custos Diretos</span>
                <span className="text-base font-bold text-red-600">
                  R$ {data.custosDiretosPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Lucro Bruto */}
              <div className="flex justify-between items-center pt-3 border-t-2">
                <span className="text-base font-bold text-gray-800">💼 LUCRO BRUTO</span>
                <span className={`text-2xl font-bold ${data.lucroBrutoPrevisto >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {data.lucroBrutoPrevisto >= 0 ? '+' : ''}R$ {data.lucroBrutoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* LUCRO LÍQUIDO */}
          <Card className={`border-l-4 ${data.lucroLiquidoPrevisto >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">🎯 Lucro Líquido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Lucro Bruto */}
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-semibold text-blue-700">💼 Lucro Bruto</span>
                <span className="text-lg font-bold text-blue-700">
                  R$ {data.lucroBrutoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Custos Indiretos */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">(-) Investimentos</span>
                  <span className="text-red-600 font-semibold">
                    R$ {data.previsaoInvestimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">(-) Prolabore</span>
                  <span className="text-red-600 font-semibold">
                    R$ {data.previsaoProlabore.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Total Custos Indiretos */}
              <div className="flex justify-between items-center py-2 border-t border-b">
                <span className="text-sm font-semibold text-gray-700">Total Custos Indiretos</span>
                <span className="text-base font-bold text-red-600">
                  R$ {data.custosIndiretosPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Lucro Líquido */}
              <div className="flex justify-between items-center pt-3 border-t-2">
                <span className="text-base font-bold text-gray-800">🎯 LUCRO LÍQUIDO</span>
                <span className={`text-2xl font-bold ${data.lucroLiquidoPrevisto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.lucroLiquidoPrevisto >= 0 ? '+' : ''}R$ {data.lucroLiquidoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explicação sobre Receita Líquida */}
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div className="flex-1">
                <h5 className="font-semibold text-emerald-800 mb-2">💵 Receita Líquida - Indicador de Saúde Financeira</h5>
                <p className="text-sm text-emerald-700 mb-2">
                  A <strong>Receita Líquida</strong> representa os valores <strong>efetivamente pagos e recebidos</strong> 
                  (dinheiro, cartão, PIX, boletos pagos).
                </p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-emerald-600 font-semibold">Até hoje (dia {data.currentDay})</p>
                    <p className="text-lg font-bold text-emerald-800">
                      R$ {data.receitaLiquidaAteHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-semibold">Previsão para o mês</p>
                    <p className="text-lg font-bold text-emerald-800">
                      R$ {data.previsaoReceitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-600 mt-2 italic">
                  * Este valor serve como referência para verificar se haverá fluxo de caixa disponível para honrar os compromissos do mês.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">⚠️ Alertas</h4>
          {data.alerts.map((alert, index) => (
            <Alert key={index} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{new Date(alert.date).toLocaleDateString('pt-BR')}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
