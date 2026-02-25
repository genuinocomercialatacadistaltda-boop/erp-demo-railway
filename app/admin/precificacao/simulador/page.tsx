'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Building2,
  Package,
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  Home,
  ArrowLeft,
  Info,
  Lightbulb,
  Zap,
  ListChecks
} from 'lucide-react';
import { toast } from 'sonner';

export default function SimuladorPrecosPage() {
  // === MODO COMPLETO - INFORMAÇÕES DO NEGÓCIO ===
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [rent, setRent] = useState('');
  const [utilities, setUtilities] = useState(''); // água, energia, gás
  const [labor, setLabor] = useState(''); // mão de obra (funcionários)
  const [taxes, setTaxes] = useState(''); // impostos
  const [otherExpenses, setOtherExpenses] = useState(''); // outras despesas
  const [totalProducts, setTotalProducts] = useState('1'); // quantos produtos diferentes vende

  // === MODO COMPLETO - INFORMAÇÕES DO PRODUTO ===
  const [productionCost, setProductionCost] = useState(''); // custo de matéria-prima/produção
  const [monthlyVolume, setMonthlyVolume] = useState(''); // quantas unidades vende por mês
  const [desiredMargin, setDesiredMargin] = useState('30'); // margem desejada

  // === MODO SIMPLES ===
  const [simpleCost, setSimpleCost] = useState(''); // custo de produção
  const [simpleOperationalPercent, setSimpleOperationalPercent] = useState('20'); // % médio de custos operacionais
  const [simpleMargin, setSimpleMargin] = useState('30'); // margem desejada
  
  // === MODO SIMPLES - PREÇO PERSONALIZADO ===
  const [customPrice, setCustomPrice] = useState(''); // preço que o usuário quer vender
  
  // === MODO SIMPLES - SELEÇÃO DE RECEITA ===
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // === MODO PONTO DE EQUILÍBRIO ===
  const [useDetailedExpenses, setUseDetailedExpenses] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(''); // despesas totais diretas
  // Despesas detalhadas
  const [beRent, setBeRent] = useState('');
  const [beUtilities, setBeUtilities] = useState('');
  const [beLabor, setBeLabor] = useState('');
  const [beTaxes, setBeTaxes] = useState('');
  const [beOther, setBeOther] = useState('');
  // Produto
  const [beCost, setBeCost] = useState(''); // custo unitário
  const [bePrice, setBePrice] = useState(''); // preço de venda
  
  // Estados para cenários editáveis
  const [editableScenarios, setEditableScenarios] = useState<{[key: number]: {units: string, revenue: string}}>({});

  // Estado do resultado
  const [result, setResult] = useState<any>(null);
  const [simpleResult, setSimpleResult] = useState<any>(null);
  const [breakevenResult, setBreakevenResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Buscar receitas disponíveis
  const loadRecipes = async () => {
    try {
      setLoadingRecipes(true);
      const response = await fetch('/api/admin/pricing/recipes');
      if (!response.ok) throw new Error('Erro ao carregar receitas');
      const data = await response.json();
      
      // Filtrar apenas receitas ativas
      const activeRecipes = data.filter((r: any) => r.isActive !== false);
      setRecipes(activeRecipes);
      console.log('Receitas carregadas:', activeRecipes.length);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
      toast.error('Erro ao carregar receitas');
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Carregar receitas ao montar o componente
  useEffect(() => {
    loadRecipes();
  }, []);

  // Quando uma receita é selecionada, preencher o custo automaticamente
  const handleRecipeSelect = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    
    if (!recipeId || recipeId === 'none') {
      // Se limpar a seleção, não mexe no custo (usuário pode ter digitado manualmente)
      return;
    }
    
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe && recipe.calculatedCost) {
      const cost = recipe.calculatedCost.totalCost.toFixed(2);
      setSimpleCost(cost);
      toast.success(`Custo da receita "${recipe.name}" carregado: R$ ${cost}`);
    }
  };

  // Função para calcular margem sobre preço personalizado
  const calculateCustomPriceMargin = () => {
    if (!simpleResult || !customPrice) return null;
    
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= 0) return null;
    
    const totalCost = simpleResult.totalCost;
    const profit = price - totalCost;
    const margin = ((profit / price) * 100);
    
    // Determinar status da margem
    let status: 'excellent' | 'good' | 'acceptable' | 'low' | 'danger';
    if (margin >= 35) status = 'excellent';
    else if (margin >= 25) status = 'good';
    else if (margin >= 15) status = 'acceptable';
    else if (margin >= 5) status = 'low';
    else status = 'danger';
    
    return {
      price,
      totalCost,
      profit,
      margin,
      status,
      isNegative: profit < 0,
    };
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

  // === CÁLCULO PONTO DE EQUILÍBRIO ===
  const calculateBreakeven = () => {
    const cost = parseFloat(beCost) || 0;
    const price = parseFloat(bePrice) || 0;
    
    // Calcular despesas operacionais
    let operationalExpenses = 0;
    
    if (useDetailedExpenses) {
      // Soma das despesas detalhadas
      const rent = parseFloat(beRent) || 0;
      const utilities = parseFloat(beUtilities) || 0;
      const labor = parseFloat(beLabor) || 0;
      const taxes = parseFloat(beTaxes) || 0;
      const other = parseFloat(beOther) || 0;
      
      operationalExpenses = rent + utilities + labor + taxes + other;
    } else {
      // Despesas totais diretas
      operationalExpenses = parseFloat(totalExpenses) || 0;
    }
    
    // Adicionar 5% de margem de segurança (despesas esquecidas)
    const safetyMargin = operationalExpenses * 0.05;
    const totalExpensesWithSafety = operationalExpenses + safetyMargin;
    
    // Lucro por unidade
    const profitPerUnit = price - cost;
    
    // Ponto de equilíbrio (quantas unidades precisa vender)
    const breakeven = profitPerUnit > 0 ? Math.ceil(totalExpensesWithSafety / profitPerUnit) : 0;
    
    // Cenários de projeção
    const scenarios = [
      { units: Math.floor(breakeven * 0.5), label: '50% do PE' },
      { units: Math.floor(breakeven * 0.75), label: '75% do PE' },
      { units: breakeven, label: 'Ponto de Equilíbrio', highlight: true },
      { units: Math.floor(breakeven * 1.5), label: '150% do PE' },
      { units: Math.floor(breakeven * 2), label: '200% do PE' },
      { units: Math.floor(breakeven * 3), label: '300% do PE' },
    ].map((scenario) => {
      const revenue = scenario.units * price;
      const totalCost = (scenario.units * cost) + totalExpensesWithSafety;
      const profit = revenue - totalCost;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      return {
        ...scenario,
        revenue,
        totalCost,
        profit,
        profitMargin,
        isBreakeven: scenario.units === breakeven,
      };
    });
    
    return {
      cost,
      price,
      profitPerUnit,
      operationalExpenses,
      safetyMargin,
      totalExpensesWithSafety,
      breakeven,
      scenarios,
      breakdown: useDetailedExpenses ? {
        rent: parseFloat(beRent) || 0,
        utilities: parseFloat(beUtilities) || 0,
        labor: parseFloat(beLabor) || 0,
        taxes: parseFloat(beTaxes) || 0,
        other: parseFloat(beOther) || 0,
      } : null,
    };
  };

  const handleBreakevenCalculate = () => {
    // Validações
    if (!beCost || parseFloat(beCost) <= 0) {
      toast.error('Informe o custo do produto');
      return;
    }

    if (!bePrice || parseFloat(bePrice) <= 0) {
      toast.error('Informe o preço de venda');
      return;
    }

    if (parseFloat(bePrice) <= parseFloat(beCost)) {
      toast.error('O preço de venda deve ser maior que o custo!');
      return;
    }

    if (useDetailedExpenses) {
      const totalDetailed = (parseFloat(beRent) || 0) + 
                            (parseFloat(beUtilities) || 0) + 
                            (parseFloat(beLabor) || 0) + 
                            (parseFloat(beTaxes) || 0) + 
                            (parseFloat(beOther) || 0);
      if (totalDetailed <= 0) {
        toast.error('Informe pelo menos uma despesa operacional');
        return;
      }
    } else {
      if (!totalExpenses || parseFloat(totalExpenses) <= 0) {
        toast.error('Informe o total de despesas operacionais');
        return;
      }
    }

    setLoading(true);

    try {
      const calculationResult = calculateBreakeven();
      setBreakevenResult(calculationResult);
      setEditableScenarios({}); // Limpar edições anteriores
      toast.success('✅ Ponto de equilíbrio calculado!');
    } catch (error: any) {
      console.error('Erro no cálculo de ponto de equilíbrio:', error);
      toast.error('Erro ao calcular ponto de equilíbrio');
    } finally {
      setLoading(false);
    }
  };

  // Função para recalcular cenário quando unidades são editadas
  const handleScenarioUnitsChange = (index: number, newUnits: string) => {
    if (!breakevenResult) return;
    
    const units = parseFloat(newUnits) || 0;
    const revenue = units * breakevenResult.price;
    
    setEditableScenarios(prev => ({
      ...prev,
      [index]: {
        units: newUnits,
        revenue: revenue.toFixed(2)
      }
    }));
  };

  // Função para recalcular cenário quando faturamento é editado
  const handleScenarioRevenueChange = (index: number, newRevenue: string) => {
    if (!breakevenResult) return;
    
    const revenue = parseFloat(newRevenue) || 0;
    const units = breakevenResult.price > 0 ? Math.round(revenue / breakevenResult.price) : 0;
    
    setEditableScenarios(prev => ({
      ...prev,
      [index]: {
        units: units.toString(),
        revenue: newRevenue
      }
    }));
  };

  // Função para calcular valores do cenário (editável ou original)
  const getScenarioValues = (scenario: any, index: number) => {
    if (!breakevenResult) return scenario;

    const edited = editableScenarios[index];
    if (!edited) return scenario;

    const units = parseFloat(edited.units) || scenario.units;
    const revenue = parseFloat(edited.revenue) || scenario.revenue;
    const totalCost = (units * breakevenResult.cost) + breakevenResult.totalExpensesWithSafety;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      ...scenario,
      units,
      revenue,
      totalCost,
      profit,
      profitMargin
    };
  };

  // === CÁLCULO MODO SIMPLES ===
  const calculateSimpleSimulation = () => {
    const prodCost = parseFloat(simpleCost) || 0;
    const operationalPercent = parseFloat(simpleOperationalPercent) || 20;
    const margin = parseFloat(simpleMargin) || 30;

    // Custo operacional estimado como % do custo de produção
    const operationalCost = prodCost * (operationalPercent / 100);
    
    // Custo total
    const totalCost = prodCost + operationalCost;
    
    // Preço com margem desejada
    const suggestedPrice = totalCost / (1 - margin / 100);
    
    // Lucro por unidade
    const profitPerUnit = suggestedPrice - totalCost;
    
    // Cenários de margem
    const scenarios = [15, 20, 25, 30, 35, 40].map((marginScenario) => {
      const price = totalCost / (1 - marginScenario / 100);
      const profit = price - totalCost;
      return {
        margin: marginScenario,
        price,
        profit,
        isRecommended: marginScenario >= 25 && marginScenario <= 35,
      };
    });

    return {
      productionCost: prodCost,
      operationalCost,
      operationalPercent,
      totalCost,
      suggestedPrice,
      profitPerUnit,
      margin,
      scenarios,
    };
  };

  const handleSimpleSimulate = () => {
    // Validação mínima - só precisa do custo de produção
    if (!simpleCost || parseFloat(simpleCost) <= 0) {
      toast.error('Informe o custo de produção (matéria-prima)');
      return;
    }

    setLoading(true);

    try {
      const simulationResult = calculateSimpleSimulation();
      setSimpleResult(simulationResult);
      toast.success('✅ Preço calculado! Veja o resultado abaixo.');
    } catch (error: any) {
      console.error('Erro na simulação simples:', error);
      toast.error('Erro ao calcular preço');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Simulador de Preços</h1>
          <p className="text-gray-600 mt-1">Escolha o modo que melhor se adapta ao seu momento</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin'}
          >
            <Home className="w-4 h-4 mr-2" />
            Página Inicial
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Tabs - Modo Simples vs Completo vs Ponto de Equilíbrio */}
      <Tabs defaultValue="simples" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="simples" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Modo Simples
            <span className="ml-1 text-xs bg-green-500 text-white px-2 py-0.5 rounded">Recomendado</span>
          </TabsTrigger>
          <TabsTrigger value="completo" className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            Modo Completo
          </TabsTrigger>
          <TabsTrigger value="equilibrio" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ponto de Equilíbrio
          </TabsTrigger>
        </TabsList>

        {/* MODO SIMPLES */}
        <TabsContent value="simples">
          {/* Alerta Educativo - Modo Simples */}
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">🚀 Modo Simples - Perfeito para Começar!</h3>
                <p className="text-sm text-green-800">
                  Ideal para quem está começando ou não tem todos os dados do negócio. 
                  Usamos <strong>médias e estimativas</strong> para calcular um preço aproximado. 
                  Você só precisa informar o <strong>custo de produção</strong> e ajustar a margem!
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FORMULÁRIO SIMPLES - ESQUERDA */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Package className="w-5 h-5 mr-2 text-green-500" />
                    📦 Informações Básicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* OPÇÃO 1: Selecionar Receita */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <Label className="text-sm font-semibold text-green-900 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Opção 1: Selecionar uma Receita Cadastrada
                    </Label>
                    <p className="text-xs text-green-700 mt-1 mb-3">
                      O custo será calculado automaticamente com base nos ingredientes
                    </p>
                    <Select
                      value={selectedRecipeId}
                      onValueChange={handleRecipeSelect}
                      disabled={loadingRecipes}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder={loadingRecipes ? "Carregando receitas..." : "Selecione uma receita..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma (digitar manualmente)</SelectItem>
                        {recipes.map((recipe) => (
                          <SelectItem key={recipe.id} value={recipe.id}>
                            {recipe.name} - {recipe.Product?.name || 'Produto'}
                            {recipe.calculatedCost && ` (R$ ${recipe.calculatedCost.totalCost.toFixed(2)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* OPÇÃO 2: Digitar Custo Manualmente */}
                  <div className="relative">
                    <div className="absolute inset-x-0 top-0 flex items-center">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <span className="px-3 text-xs text-gray-500 bg-white">OU</span>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>
                    <div className="pt-6">
                      <Label className="text-sm font-medium text-gray-900">
                        Opção 2: Digitar Custo Manualmente (R$) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={simpleCost}
                        onChange={(e) => setSimpleCost(e.target.value)}
                        placeholder="Ex: 4.00"
                        className="mt-2 text-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Quanto custa a matéria-prima para fazer 1 unidade?
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-gray-900">
                      2. Custos Operacionais Estimados (%)
                    </Label>
                    <div className="mt-2">
                      <Input
                        type="number"
                        step="1"
                        value={simpleOperationalPercent}
                        onChange={(e) => setSimpleOperationalPercent(e.target.value)}
                        placeholder="Ex: 20"
                        className="text-lg"
                      />
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs">
                        <p className="text-blue-900 font-medium mb-2">💡 Sugestões de Percentual:</p>
                        <div className="space-y-1 text-blue-800">
                          <p>• <strong>15-20%</strong> - Negócio pequeno, home office</p>
                          <p>• <strong>20-30%</strong> - Estabelecimento físico pequeno</p>
                          <p>• <strong>30-40%</strong> - Estabelecimento com funcionários</p>
                          <p>• <strong>40-50%</strong> - Operação completa (aluguel + equipe)</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Percentual médio de despesas (aluguel, luz, funcionários, etc)
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-gray-900">
                      3. Margem de Lucro Desejada (%)
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={simpleMargin}
                      onChange={(e) => setSimpleMargin(e.target.value)}
                      placeholder="Ex: 30"
                      className="mt-2 text-lg"
                    />
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                      <strong>Recomendado:</strong> 25% a 35% para a maioria dos negócios
                    </div>
                  </div>

                  <Button
                    onClick={handleSimpleSimulate}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white mt-4"
                    size="lg"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {loading ? 'Calculando...' : 'Calcular Preço Rápido'}
                  </Button>
                </CardContent>
              </Card>

              {/* Explicação Didática */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Info className="w-4 h-4 mr-2 text-green-600" />
                    Como funciona?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>1. Custo de Produção:</strong> O que você gasta em matéria-prima.
                    </p>
                    <p>
                      <strong>2. Custos Operacionais (%):</strong> Uma estimativa das outras despesas do negócio 
                      (aluguel, energia, funcionários, etc) como percentual do custo de produção.
                    </p>
                    <p>
                      <strong>3. Margem:</strong> Seu lucro sobre o preço final.
                    </p>
                    <p className="pt-2 border-t text-green-700 font-medium">
                      ✓ O resultado é um preço aproximado, perfeito para validar a viabilidade do negócio!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RESULTADOS SIMPLES - DIREITA */}
            {simpleResult && (
              <div className="space-y-6">
                {/* RESUMO EXECUTIVO */}
                <Card className="border-2 border-green-300 shadow-lg">
                  <CardHeader className="bg-green-50">
                    <CardTitle className="flex items-center text-lg">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      💰 Preço Sugerido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="text-center p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                      <p className="text-sm text-green-700 font-medium">VENDA POR</p>
                      <p className="text-5xl font-bold text-green-600 mt-2">
                        {formatCurrency(simpleResult.suggestedPrice)}
                      </p>
                      <p className="text-sm text-green-700 mt-3">
                        Lucro: {formatCurrency(simpleResult.profitPerUnit)} por unidade
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* TESTE SEU PREÇO PERSONALIZADO */}
                <Card className="border-2 border-blue-300 shadow-lg">
                  <CardHeader className="bg-blue-50">
                    <CardTitle className="flex items-center text-lg">
                      <Zap className="w-5 h-5 mr-2 text-blue-600" />
                      🎯 Teste Seu Preço
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="customPrice" className="text-sm font-medium">
                        Quanto você quer vender?
                      </Label>
                      <div className="relative mt-2">
                        <span className="absolute left-3 top-3 text-gray-500">R$</span>
                        <Input
                          id="customPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          className="pl-10 text-lg font-semibold"
                          placeholder="0,00"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Digite o preço que você está pensando em vender
                      </p>
                    </div>

                    {(() => {
                      const customCalc = calculateCustomPriceMargin();
                      if (!customCalc) return null;

                      const statusConfig = {
                        excellent: {
                          bg: 'bg-green-100',
                          border: 'border-green-400',
                          text: 'text-green-900',
                          icon: '🌟',
                          label: 'Excelente',
                          message: 'Margem muito boa! Perfeita para o negócio.',
                        },
                        good: {
                          bg: 'bg-green-50',
                          border: 'border-green-300',
                          text: 'text-green-800',
                          icon: '✅',
                          label: 'Boa',
                          message: 'Margem saudável e recomendada.',
                        },
                        acceptable: {
                          bg: 'bg-yellow-50',
                          border: 'border-yellow-300',
                          text: 'text-yellow-900',
                          icon: '⚠️',
                          label: 'Aceitável',
                          message: 'Margem baixa, mas ainda viável.',
                        },
                        low: {
                          bg: 'bg-orange-50',
                          border: 'border-orange-300',
                          text: 'text-orange-900',
                          icon: '📉',
                          label: 'Baixa',
                          message: 'Margem muito baixa. Cuidado!',
                        },
                        danger: {
                          bg: 'bg-red-50',
                          border: 'border-red-300',
                          text: 'text-red-900',
                          icon: '🚨',
                          label: 'Prejuízo',
                          message: 'Você terá prejuízo neste preço!',
                        },
                      };

                      const config = customCalc.isNegative ? statusConfig.danger : statusConfig[customCalc.status];

                      return (
                        <div className={`mt-4 p-4 rounded-lg border-2 ${config.bg} ${config.border}`}>
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-2xl">{config.icon}</span>
                            <div className="flex-1">
                              <h4 className={`font-bold ${config.text}`}>
                                {config.label}
                              </h4>
                              <p className={`text-sm ${config.text} mt-1`}>
                                {config.message}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 mt-4">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-700">Custo Total:</span>
                              <span className="font-semibold">{formatCurrency(customCalc.totalCost)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-700">Seu Preço:</span>
                              <span className="font-semibold">{formatCurrency(customCalc.price)}</span>
                            </div>
                            <div className={`flex justify-between items-center pt-2 border-t ${config.border}`}>
                              <span className="text-sm font-bold">Lucro por unidade:</span>
                              <span className={`font-bold ${customCalc.isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(customCalc.profit)}
                              </span>
                            </div>
                            <div className={`flex justify-between items-center p-3 rounded-lg ${config.bg} border ${config.border}`}>
                              <span className="font-bold ${config.text}">
                                Margem de Lucro:
                              </span>
                              <span className={`font-bold text-xl ${config.text}`}>
                                {formatPercent(customCalc.margin)}
                              </span>
                            </div>
                          </div>

                          {/* Comparação com preço sugerido */}
                          <div className="mt-4 pt-4 border-t border-gray-300">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-gray-600">
                                <strong>Preço sugerido:</strong> {formatCurrency(simpleResult.suggestedPrice)} 
                                ({formatPercent(simpleResult.margin)} de margem)
                                {customCalc.price < simpleResult.suggestedPrice && (
                                  <span className="block mt-1 text-orange-600">
                                    💡 Você está vendendo {formatCurrency(simpleResult.suggestedPrice - customCalc.price)} mais barato que o sugerido
                                  </span>
                                )}
                                {customCalc.price > simpleResult.suggestedPrice && (
                                  <span className="block mt-1 text-green-600">
                                    💡 Você está vendendo {formatCurrency(customCalc.price - simpleResult.suggestedPrice)} mais caro que o sugerido
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* DETALHAMENTO SIMPLES */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-base">
                      <Calculator className="w-4 h-4 mr-2 text-blue-500" />
                      📊 Como chegamos nesse valor?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-900">Custo de Produção</span>
                        <span className="font-bold text-blue-900">{formatCurrency(simpleResult.productionCost)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-orange-900">
                          + Custos Operacionais ({simpleResult.operationalPercent}%)
                        </span>
                        <span className="font-bold text-orange-900">{formatCurrency(simpleResult.operationalCost)}</span>
                      </div>
                      <p className="text-xs text-orange-700 mt-1">
                        Aluguel, energia, funcionários, etc. (estimativa)
                      </p>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-lg border-2 border-purple-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-purple-900">= CUSTO TOTAL</span>
                        <span className="font-bold text-lg text-purple-900">{formatCurrency(simpleResult.totalCost)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-green-100 rounded-lg border-2 border-green-400">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-green-900">
                          + Margem de {formatPercent(simpleResult.margin)}
                        </span>
                        <span className="font-bold text-green-900">{formatCurrency(simpleResult.profitPerUnit)}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg">
                      <div className="flex justify-between items-center text-white">
                        <span className="font-bold">💰 PREÇO FINAL</span>
                        <span className="font-bold text-2xl">{formatCurrency(simpleResult.suggestedPrice)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CENÁRIOS DE MARGEM */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-base">
                      <TrendingUp className="w-4 h-4 mr-2 text-purple-500" />
                      📈 Teste Outras Margens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {simpleResult.scenarios.map((scenario: any, index: number) => (
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
                                Margem: {formatPercent(scenario.margin)}
                              </span>
                              {scenario.isRecommended && (
                                <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                                  ⭐ Ideal
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

                {/* ALERTA */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 mb-1">⚠️ Lembre-se:</h4>
                      <p className="text-sm text-yellow-800">
                        Este é um cálculo <strong>aproximado</strong>. Para uma análise mais precisa 
                        com seus dados reais, use o <strong>"Modo Completo"</strong> acima.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* MODO COMPLETO */}
        <TabsContent value="completo">
          {/* Alerta Educativo - Modo Completo */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">📊 Modo Completo - Análise Detalhada</h3>
                <p className="text-sm text-blue-800">
                  Ideal para quem já tem o negócio estabelecido e conhece suas despesas mensais. 
                  Este simulador <strong>rateia todas as despesas</strong> entre seus produtos, 
                  mostrando o custo operacional real de cada um.
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
        </TabsContent>

        {/* PONTO DE EQUILÍBRIO */}
        <TabsContent value="equilibrio">
          {/* Alerta Educativo - Ponto de Equilíbrio */}
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-purple-900 mb-1">📊 Ponto de Equilíbrio - Planeje suas Vendas</h3>
                <p className="text-sm text-purple-800">
                  Descubra <strong>quantas unidades você precisa vender</strong> para cobrir todas as despesas. 
                  O sistema adiciona automaticamente <strong>5% de margem de segurança</strong> para despesas imprevistas 
                  e mostra <strong>projeções de lucro</strong> em diferentes cenários de vendas.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FORMULÁRIO PONTO DE EQUILÍBRIO - ESQUERDA */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <DollarSign className="w-5 h-5 mr-2 text-purple-500" />
                    💰 Despesas Operacionais Mensais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Toggle: Valor Total vs Detalhado */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <Label className="text-sm font-medium">Modo de Entrada:</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!useDetailedExpenses ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUseDetailedExpenses(false)}
                      >
                        Valor Total
                      </Button>
                      <Button
                        type="button"
                        variant={useDetailedExpenses ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUseDetailedExpenses(true)}
                      >
                        Detalhado
                      </Button>
                    </div>
                  </div>

                  {/* MODO SIMPLES - VALOR TOTAL */}
                  {!useDetailedExpenses && (
                    <div>
                      <Label className="text-sm font-medium text-gray-900">
                        Total de Despesas Mensais (R$) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={totalExpenses}
                        onChange={(e) => setTotalExpenses(e.target.value)}
                        placeholder="Ex: 30000.00"
                        className="mt-2 text-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Soma de todas as despesas do mês (aluguel + energia + funcionários + impostos + outros)
                      </p>
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                        💡 Automaticamente adicionaremos <strong>+5% de margem de segurança</strong> para despesas esquecidas
                      </div>
                    </div>
                  )}

                  {/* MODO DETALHADO - DESPESAS SEPARADAS */}
                  {useDetailedExpenses && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">Informe cada despesa:</p>
                      
                      <div>
                        <Label className="text-sm">Aluguel (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={beRent}
                          onChange={(e) => setBeRent(e.target.value)}
                          placeholder="Ex: 2000.00"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Água, Energia, Gás (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={beUtilities}
                          onChange={(e) => setBeUtilities(e.target.value)}
                          placeholder="Ex: 800.00"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Funcionários / Mão de Obra (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={beLabor}
                          onChange={(e) => setBeLabor(e.target.value)}
                          placeholder="Ex: 5000.00"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Impostos (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={beTaxes}
                          onChange={(e) => setBeTaxes(e.target.value)}
                          placeholder="Ex: 1500.00"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Outras Despesas (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={beOther}
                          onChange={(e) => setBeOther(e.target.value)}
                          placeholder="Ex: 500.00"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Contador, internet, manutenção, etc.</p>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Subtotal:</span>
                          <span className="font-bold text-purple-600">
                            {formatCurrency(
                              (parseFloat(beRent) || 0) + 
                              (parseFloat(beUtilities) || 0) + 
                              (parseFloat(beLabor) || 0) + 
                              (parseFloat(beTaxes) || 0) + 
                              (parseFloat(beOther) || 0)
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          + 5% margem de segurança = {formatCurrency(
                            ((parseFloat(beRent) || 0) + 
                            (parseFloat(beUtilities) || 0) + 
                            (parseFloat(beLabor) || 0) + 
                            (parseFloat(beTaxes) || 0) + 
                            (parseFloat(beOther) || 0)) * 1.05
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* INFORMAÇÕES DO PRODUTO */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Package className="w-5 h-5 mr-2 text-purple-500" />
                    📦 Informações do Produto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-900">
                      Custo do Produto (R$) *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={beCost}
                      onChange={(e) => setBeCost(e.target.value)}
                      placeholder="Ex: 4.00"
                      className="mt-2 text-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Quanto custa produzir 1 unidade?
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-900">
                      Preço de Venda (R$) *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bePrice}
                      onChange={(e) => setBePrice(e.target.value)}
                      placeholder="Ex: 6.00"
                      className="mt-2 text-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Por quanto você vende cada unidade?
                    </p>
                  </div>

                  {beCost && bePrice && parseFloat(bePrice) > parseFloat(beCost) && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-900">Lucro por Unidade:</span>
                        <span className="font-bold text-lg text-green-600">
                          {formatCurrency(parseFloat(bePrice) - parseFloat(beCost))}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleBreakevenCalculate}
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-4"
                    size="lg"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    {loading ? 'Calculando...' : 'Calcular Ponto de Equilíbrio'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* RESULTADOS PONTO DE EQUILÍBRIO - DIREITA */}
            {breakevenResult && (
              <div className="space-y-6">
                {/* PONTO DE EQUILÍBRIO */}
                <Card className="border-2 border-purple-300 shadow-lg">
                  <CardHeader className="bg-purple-50">
                    <CardTitle className="flex items-center text-lg">
                      <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                      🎯 Ponto de Equilíbrio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                      <p className="text-sm text-purple-700 font-medium">VOCÊ PRECISA VENDER</p>
                      <p className="text-5xl font-bold text-purple-600 mt-2">
                        {breakevenResult.breakeven.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-sm text-purple-700 mt-2">unidades por mês</p>
                      <p className="text-xs text-purple-600 mt-3">
                        Para cobrir {formatCurrency(breakevenResult.totalExpensesWithSafety)} de despesas
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600">Custo Unitário</p>
                        <p className="text-lg font-bold text-blue-900">{formatCurrency(breakevenResult.cost)}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600">Preço de Venda</p>
                        <p className="text-lg font-bold text-green-900">{formatCurrency(breakevenResult.price)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* BREAKDOWN DE DESPESAS */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-base">
                      <Calculator className="w-4 h-4 mr-2 text-purple-500" />
                      💰 Composição das Despesas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-sm">Despesas Informadas:</span>
                        <span className="font-bold">{formatCurrency(breakevenResult.operationalExpenses)}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-sm">+ Margem de Segurança (5%):</span>
                        <span className="font-bold text-orange-600">{formatCurrency(breakevenResult.safetyMargin)}</span>
                      </div>
                      <p className="text-xs text-orange-700 mt-1">Reserva para despesas esquecidas</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-lg border-2 border-purple-300">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold">TOTAL COM SEGURANÇA:</span>
                        <span className="font-bold text-lg text-purple-900">{formatCurrency(breakevenResult.totalExpensesWithSafety)}</span>
                      </div>
                    </div>

                    {breakevenResult.breakdown && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Detalhamento:</p>
                        <div className="space-y-1 text-sm">
                          {breakevenResult.breakdown.rent > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">• Aluguel:</span>
                              <span>{formatCurrency(breakevenResult.breakdown.rent)}</span>
                            </div>
                          )}
                          {breakevenResult.breakdown.utilities > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">• Água/Energia/Gás:</span>
                              <span>{formatCurrency(breakevenResult.breakdown.utilities)}</span>
                            </div>
                          )}
                          {breakevenResult.breakdown.labor > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">• Funcionários:</span>
                              <span>{formatCurrency(breakevenResult.breakdown.labor)}</span>
                            </div>
                          )}
                          {breakevenResult.breakdown.taxes > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">• Impostos:</span>
                              <span>{formatCurrency(breakevenResult.breakdown.taxes)}</span>
                            </div>
                          )}
                          {breakevenResult.breakdown.other > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">• Outras:</span>
                              <span>{formatCurrency(breakevenResult.breakdown.other)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* PROJEÇÕES DE VENDAS */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-base">
                      <TrendingUp className="w-4 h-4 mr-2 text-purple-500" />
                      📈 Projeções de Vendas
                    </CardTitle>
                    <p className="text-xs text-gray-600 mt-1">
                      ✏️ Edite as unidades ou faturamento para simular diferentes cenários
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {breakevenResult.scenarios.map((scenario: any, index: number) => {
                        const scenarioData = getScenarioValues(scenario, index);
                        const isBreakeven = scenario.isBreakeven;
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg ${
                              isBreakeven
                                ? 'bg-purple-100 border-2 border-purple-400'
                                : scenarioData.profit > 0
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {isBreakeven && (
                                  <CheckCircle className="w-5 h-5 text-purple-600" />
                                )}
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">{scenario.label}</p>
                                  {isBreakeven ? (
                                    <p className="font-bold text-gray-900">
                                      {scenarioData.units.toLocaleString('pt-BR')} unidades
                                    </p>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        value={editableScenarios[index]?.units || scenarioData.units}
                                        onChange={(e) => handleScenarioUnitsChange(index, e.target.value)}
                                        className="w-24 h-8 text-sm font-bold"
                                        placeholder="Unidades"
                                      />
                                      <span className="text-xs text-gray-600">unidades</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isBreakeven && (
                                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded font-bold">
                                  EQUILÍBRIO
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Faturamento:</p>
                                {isBreakeven ? (
                                  <p className="font-bold">{formatCurrency(scenarioData.revenue)}</p>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs">R$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editableScenarios[index]?.revenue || scenarioData.revenue.toFixed(2)}
                                      onChange={(e) => handleScenarioRevenueChange(index, e.target.value)}
                                      className="w-28 h-8 text-sm font-bold"
                                      placeholder="Faturamento"
                                    />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Custo Total:</p>
                                <p className="font-bold">{formatCurrency(scenarioData.totalCost)}</p>
                              </div>
                            </div>

                            <div className={`mt-2 pt-2 border-t ${
                              scenarioData.profit > 0 ? 'border-green-300' : 'border-red-300'
                            }`}>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold">
                                  {scenarioData.profit > 0 ? '💰 Lucro:' : '⚠️ Prejuízo:'}
                                </span>
                                <span className={`font-bold text-lg ${
                                  scenarioData.profit > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(Math.abs(scenarioData.profit))}
                                </span>
                              </div>
                              {scenarioData.profit > 0 && (
                                <p className="text-xs text-gray-600 mt-1 text-right">
                                  Margem: {scenarioData.profitMargin.toFixed(1)}%
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* DICA IMPORTANTE */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">💡 Interpretação:</h4>
                      <p className="text-sm text-blue-800">
                        <strong>Abaixo do Ponto de Equilíbrio:</strong> Você está operando com prejuízo.<br />
                        <strong>No Ponto de Equilíbrio:</strong> Você cobre todas as despesas, sem lucro nem prejuízo.<br />
                        <strong>Acima do Ponto de Equilíbrio:</strong> Você está gerando lucro!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}