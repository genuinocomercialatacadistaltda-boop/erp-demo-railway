'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Building2,
  Package,
  Home,
  ArrowLeft,
  Info,
  Lightbulb,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClientSimuladorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // === INFORMAÇÕES DO NEGÓCIO ===
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [rent, setRent] = useState('');
  const [utilities, setUtilities] = useState(''); // água, energia, gás
  const [labor, setLabor] = useState(''); // mão de obra (funcionários)
  const [taxes, setTaxes] = useState(''); // impostos
  const [otherExpenses, setOtherExpenses] = useState(''); // outras despesas
  const [totalProducts, setTotalProducts] = useState('1'); // quantos produtos diferentes vende

  // === INFORMAÇÕES DO PRODUTO ===
  const [productionCost, setProductionCost] = useState(''); // custo de matéria-prima/produção
  const [monthlyVolume, setMonthlyVolume] = useState(''); // quantas unidades vende por mês
  const [desiredMargin, setDesiredMargin] = useState('30'); // margem desejada

  // Estado do resultado
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated' && session?.user) {
      const userType = (session.user as any)?.userType;
      if (userType !== 'CUSTOMER') {
        toast.error('Acesso não autorizado');
        router.push('/customer/gestao');
        return;
      }
    }
  }, [status, session, router]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const calculateSimulation = () => {
    // Validações básicas
    const prodCost = parseFloat(productionCost) || 0;
    const volume = parseInt(monthlyVolume) || 1;
    const products = parseInt(totalProducts) || 1;
    const margin = parseFloat(desiredMargin) || 30;

    // === CÁLCULO DE DESPESAS OPERACIONAIS ===
    const rentCost = parseFloat(rent) || 0;
    const utilitiesCost = parseFloat(utilities) || 0;
    const laborCost = parseFloat(labor) || 0;
    const taxesCost = parseFloat(taxes) || 0;
    const otherCost = parseFloat(otherExpenses) || 0;

    // Despesas operacionais totais do negócio
    const totalOperationalCost = rentCost + utilitiesCost + laborCost + taxesCost + otherCost;

    // === RATEIO DE CUSTOS ===
    // Custo operacional que ESTE produto tem que pagar
    const operationalCostPerProduct = totalOperationalCost / products;

    // Custo operacional por unidade vendida
    const operationalCostPerUnit = operationalCostPerProduct / volume;

    // === CUSTO TOTAL REAL ===
    const totalCostPerUnit = prodCost + operationalCostPerUnit;

    // === PREÇO SUGERIDO ===
    const suggestedPrice = totalCostPerUnit / (1 - margin / 100);

    // === ANÁLISE DE LUCRO ===
    const profitPerUnit = suggestedPrice - totalCostPerUnit;
    const profitPerUnitRaw = suggestedPrice - prodCost; // lucro bruto (sem contar operacional)

    // === PONTO DE EQUILÍBRIO ===
    // Quantas unidades precisa vender para cobrir os custos operacionais deste produto
    const breakeven = profitPerUnit > 0 ? Math.ceil(operationalCostPerProduct / profitPerUnit) : 0;

    // === CENÁRIOS DE MARGEM ===
    const scenarios = [15, 20, 25, 30, 35, 40].map((marginScenario) => {
      const price = totalCostPerUnit / (1 - marginScenario / 100);
      const profit = price - totalCostPerUnit;
      return {
        margin: marginScenario,
        price,
        profit,
        isRecommended: marginScenario >= 25 && marginScenario <= 35,
      };
    });

    return {
      // Custos detalhados
      productionCost: prodCost,
      operationalCostPerUnit,
      totalCostPerUnit,
      
      // Despesas do negócio
      totalOperationalCost,
      operationalCostPerProduct,
      
      // Preço e lucro
      suggestedPrice,
      profitPerUnit,
      profitPerUnitRaw,
      margin,
      
      // Ponto de equilíbrio
      breakeven,
      monthlyVolume: volume,
      
      // Cenários
      scenarios,
      
      // Breakdown de despesas
      breakdown: {
        rent: rentCost,
        utilities: utilitiesCost,
        labor: laborCost,
        taxes: taxesCost,
        other: otherCost,
      },
    };
  };

  const handleSimulate = () => {
    // Validações
    if (!productionCost || parseFloat(productionCost) <= 0) {
      toast.error('Informe o custo de produção (matéria-prima)');
      return;
    }

    if (!monthlyVolume || parseInt(monthlyVolume) <= 0) {
      toast.error('Informe quantas unidades você vende por mês');
      return;
    }

    if (!totalProducts || parseInt(totalProducts) <= 0) {
      toast.error('Informe quantos produtos diferentes você vende');
      return;
    }

    setLoading(true);

    try {
      const simulationResult = calculateSimulation();
      setResult(simulationResult);
      toast.success('Simulação concluída! Veja os resultados abaixo.');
    } catch (error: any) {
      console.error('Erro na simulação:', error);
      toast.error('Erro ao calcular simulação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Simulador de Preços Completo</h1>
          <p className="text-gray-600 mt-1">Calcule o preço real considerando TODOS os custos do seu negócio</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/customer/gestao')}
          >
            <Home className="w-4 h-4 mr-2" />
            Página Inicial
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Alerta Educativo */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Por que este simulador é diferente?</h3>
            <p className="text-sm text-blue-800">
              A maioria dos empresários precifica produtos considerando apenas o custo de produção. 
              Mas o preço correto precisa cobrir <strong>TODAS as despesas do negócio</strong>: aluguel, energia, 
              funcionários, impostos, etc. Este simulador divide (rateia) essas despesas entre todos os seus 
              produtos, mostrando o custo operacional real de cada um.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FORMULÁRIO - ESQUERDA */}
        <div className="space-y-6">
          {/* 1. INFORMAÇÕES DO NEGÓCIO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Building2 className="w-5 h-5 mr-2 text-blue-500" />
                1. Informações do Negócio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Faturamento Mensal Total (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(e.target.value)}
                  placeholder="Ex: 50000.00"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Quanto você fatura por mês (total)</p>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm font-semibold text-gray-700 mb-3">Despesas Operacionais Mensais:</p>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Aluguel (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={rent}
                      onChange={(e) => setRent(e.target.value)}
                      placeholder="Ex: 2000.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Água, Energia, Gás (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={utilities}
                      onChange={(e) => setUtilities(e.target.value)}
                      placeholder="Ex: 800.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Funcionários / Mão de Obra (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={labor}
                      onChange={(e) => setLabor(e.target.value)}
                      placeholder="Ex: 5000.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Impostos (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={taxes}
                      onChange={(e) => setTaxes(e.target.value)}
                      placeholder="Ex: 1500.00"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Simples Nacional, MEI, ISS, etc.</p>
                  </div>

                  <div>
                    <Label className="text-sm">Outras Despesas (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={otherExpenses}
                      onChange={(e) => setOtherExpenses(e.target.value)}
                      placeholder="Ex: 500.00"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Contador, internet, manutenção, etc.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Label className="text-sm font-medium">Quantos produtos diferentes você vende? *</Label>
                <Input
                  type="number"
                  step="1"
                  value={totalProducts}
                  onChange={(e) => setTotalProducts(e.target.value)}
                  placeholder="Ex: 2"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: Se você vende espeto e jantinha, são <strong>2 produtos</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. INFORMAÇÕES DO PRODUTO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Package className="w-5 h-5 mr-2 text-purple-500" />
                2. Informações do Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Custo de Produção Unitário (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productionCost}
                  onChange={(e) => setProductionCost(e.target.value)}
                  placeholder="Ex: 4.00"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Custo de matéria-prima para fazer 1 unidade</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Quantas unidades você vende por mês? *</Label>
                <Input
                  type="number"
                  step="1"
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(e.target.value)}
                  placeholder="Ex: 1000"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Volume de vendas estimado (não precisa ser exato)</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Margem de Lucro Desejada (%)</Label>
                <Input
                  type="number"
                  step="1"
                  value={desiredMargin}
                  onChange={(e) => setDesiredMargin(e.target.value)}
                  placeholder="Ex: 30"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Percentual de lucro sobre o preço final</p>
              </div>

              <Button
                onClick={handleSimulate}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                <Calculator className="w-4 h-4 mr-2" />
                {loading ? 'Calculando...' : 'Calcular Preço Correto'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RESULTADOS - DIREITA */}
        {result && (
          <div className="space-y-6">
            {/* RESUMO EXECUTIVO */}
            <Card className="border-2 border-green-300 shadow-lg">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center text-lg">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  💰 Resultado: Preço Correto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">PREÇO SUGERIDO</p>
                  <p className="text-4xl font-bold text-green-600 mt-1">
                    {formatCurrency(result.suggestedPrice)}
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Com margem de {formatPercent(result.margin)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Lucro por Unidade</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(result.profitPerUnit)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Ponto de Equilíbrio</p>
                    <p className="text-lg font-bold text-gray-900">{result.breakeven} un/mês</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DETALHAMENTO DE CUSTOS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Info className="w-4 h-4 mr-2 text-blue-500" />
                  📊 Detalhamento de Custos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-900">Custo de Produção (matéria-prima)</span>
                    <span className="font-bold text-blue-900">{formatCurrency(result.productionCost)}</span>
                  </div>
                </div>

                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-orange-900">+ Custo Operacional por Unidade</span>
                    <span className="font-bold text-orange-900">{formatCurrency(result.operationalCostPerUnit)}</span>
                  </div>
                  <p className="text-xs text-orange-700 mt-1">
                    (Despesas fixas rateadas por produto e volume)
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg border-2 border-green-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-green-900">= CUSTO TOTAL REAL</span>
                    <span className="font-bold text-lg text-green-900">{formatCurrency(result.totalCostPerUnit)}</span>
                  </div>
                </div>

                {/* Detalhamento das Despesas Operacionais */}
                {result.totalOperationalCost > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Despesas Operacionais do Negócio:</p>
                    <div className="space-y-1 text-sm">
                      {result.breakdown.rent > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">• Aluguel:</span>
                          <span className="text-gray-900">{formatCurrency(result.breakdown.rent)}</span>
                        </div>
                      )}
                      {result.breakdown.utilities > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">• Água/Energia/Gás:</span>
                          <span className="text-gray-900">{formatCurrency(result.breakdown.utilities)}</span>
                        </div>
                      )}
                      {result.breakdown.labor > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">• Funcionários:</span>
                          <span className="text-gray-900">{formatCurrency(result.breakdown.labor)}</span>
                        </div>
                      )}
                      {result.breakdown.taxes > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">• Impostos:</span>
                          <span className="text-gray-900">{formatCurrency(result.breakdown.taxes)}</span>
                        </div>
                      )}
                      {result.breakdown.other > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">• Outras Despesas:</span>
                          <span className="text-gray-900">{formatCurrency(result.breakdown.other)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t font-semibold">
                        <span className="text-gray-900">TOTAL MENSAL:</span>
                        <span className="text-gray-900">{formatCurrency(result.totalOperationalCost)}</span>
                      </div>
                      <div className="flex justify-between text-orange-700">
                        <span>Rateio para este produto:</span>
                        <span>{formatCurrency(result.operationalCostPerProduct)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EXPLICAÇÃO DIDÁTICA */}
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Lightbulb className="w-4 h-4 mr-2 text-yellow-600" />
                  💡 Como o cálculo funciona?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <strong>1. Despesas Operacionais ({formatCurrency(result.totalOperationalCost)}/mês)</strong>
                    <br />são divididas igualmente entre todos os produtos que você vende.
                  </p>
                  <p>
                    <strong>2. Este produto tem que pagar ({formatCurrency(result.operationalCostPerProduct)}/mês)</strong>
                    <br />das despesas operacionais totais.
                  </p>
                  <p>
                    <strong>3. Vendendo {result.monthlyVolume} unidades/mês,</strong>
                    <br />cada unidade precisa cobrir {formatCurrency(result.operationalCostPerUnit)} de custo operacional.
                  </p>
                  <p>
                    <strong>4. Somando produção + operacional = {formatCurrency(result.totalCostPerUnit)}</strong>
                    <br />é o custo REAL de cada unidade.
                  </p>
                  <p className="pt-2 border-t text-green-700 font-semibold">
                    ✓ Precificando a {formatCurrency(result.suggestedPrice)}, você garante {formatPercent(result.margin)} 
                    de margem sobre o custo total, cobrindo TODAS as despesas do negócio.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CENÁRIOS DE MARGEM */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <TrendingUp className="w-4 h-4 mr-2 text-purple-500" />
                  📈 Cenários com Diferentes Margens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.scenarios.map((scenario: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        scenario.isRecommended
                          ? 'bg-green-50 border-2 border-green-300'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {scenario.isRecommended && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <div>
                          <span className="font-bold text-gray-900">
                            {formatPercent(scenario.margin)}
                          </span>
                          {scenario.isRecommended && (
                            <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                              Recomendado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(scenario.price)}
                        </p>
                        <p className="text-xs text-gray-600">
                          Lucro: {formatCurrency(scenario.profit)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ALERTA DE AÇÃO */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-yellow-900 mb-1">⚠️ Atenção:</h4>
                  <p className="text-sm text-yellow-800">
                    Se você precificar abaixo de <strong>{formatCurrency(result.totalCostPerUnit)}</strong>, 
                    está perdendo dinheiro! O preço MÍNIMO deve cobrir produção + custos operacionais. 
                    Com margem de {formatPercent(result.margin)}, você garante lucro E cobertura de todas as despesas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
