export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * API para simulador de preços
 * POST: Calcula diferentes cenários de precificação
 */

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      cost,
      currentPrice,
      desiredMargin,
      desiredProfit,
      targetQuantity,
    } = body;

    console.log("[PRICE_SIMULATOR_POST] Simulando cenários:", {
      cost,
      currentPrice,
      desiredMargin,
      desiredProfit,
      targetQuantity,
    });

    // Validações
    if (!cost || cost <= 0) {
      return NextResponse.json(
        { error: "Custo deve ser maior que zero" },
        { status: 400 }
      );
    }

    const simulations: any = {};

    // Simulação 1: Baseado em margem desejada
    if (desiredMargin !== undefined && desiredMargin >= 0 && desiredMargin < 100) {
      const priceByMargin = cost / (1 - desiredMargin / 100);
      const profitByMargin = priceByMargin - cost;
      
      simulations.byMargin = {
        price: priceByMargin,
        profit: profitByMargin,
        margin: desiredMargin,
        breakeven: Math.ceil(cost / profitByMargin),
      };
    }

    // Simulação 2: Baseado em lucro desejado por unidade
    if (desiredProfit !== undefined && desiredProfit > 0) {
      const priceByProfit = cost + desiredProfit;
      const marginByProfit = (desiredProfit / priceByProfit) * 100;
      
      simulations.byProfit = {
        price: priceByProfit,
        profit: desiredProfit,
        margin: marginByProfit,
        breakeven: 1, // Sempre 1 unidade para recuperar o lucro desejado
      };
    }

    // Simulação 3: Quantidade alvo para atingir lucro total
    if (targetQuantity && targetQuantity > 0 && currentPrice && currentPrice > cost) {
      const profitPerUnit = currentPrice - cost;
      const totalProfit = profitPerUnit * targetQuantity;
      const totalRevenue = currentPrice * targetQuantity;
      const totalCost = cost * targetQuantity;
      const overallMargin = (totalProfit / totalRevenue) * 100;
      
      simulations.byQuantity = {
        quantity: targetQuantity,
        pricePerUnit: currentPrice,
        totalRevenue,
        totalCost,
        totalProfit,
        profitPerUnit,
        margin: overallMargin,
      };
    }

    // Simulação 4: Comparação com preço atual (se fornecido)
    if (currentPrice && currentPrice > 0) {
      const currentProfit = currentPrice - cost;
      const currentMargin = currentPrice > cost ? (currentProfit / currentPrice) * 100 : 0;
      
      simulations.current = {
        price: currentPrice,
        profit: currentProfit,
        margin: currentMargin,
        status: currentProfit > 0 ? 'profitable' : 'unprofitable',
        breakeven: currentProfit > 0 ? Math.ceil(cost / currentProfit) : Infinity,
      };
    }

    // Simulação 5: Cenários de diferentes margens
    const commonMargins = [15, 20, 25, 30, 35, 40, 45, 50];
    simulations.scenarios = commonMargins.map((margin) => {
      const price = cost / (1 - margin / 100);
      const profit = price - cost;
      
      return {
        margin,
        price,
        profit,
        breakeven: Math.ceil(cost / profit),
        isRecommended: margin >= 25 && margin <= 35,
      };
    });

    // Análise e Recomendações
    const analysis = {
      minimumPrice: cost,
      recommendedMinMargin: 25,
      recommendedMaxMargin: 35,
      idealPrice: cost / (1 - 30 / 100), // 30% de margem como ideal
      warnings: [],
    } as any;

    if (currentPrice && currentPrice < cost) {
      analysis.warnings.push({
        severity: 'critical',
        message: 'Preço atual está abaixo do custo! Você está tendo prejuízo.',
      });
    }

    if (currentPrice && currentPrice < cost * 1.15) {
      analysis.warnings.push({
        severity: 'warning',
        message: 'Margem muito baixa. Recomendamos aumentar o preço.',
      });
    }

    console.log("[PRICE_SIMULATOR_POST] Simulações geradas com sucesso");

    return NextResponse.json({
      input: {
        cost,
        currentPrice,
        desiredMargin,
        desiredProfit,
        targetQuantity,
      },
      simulations,
      analysis,
    });
  } catch (error) {
    console.error("[PRICE_SIMULATOR_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao simular preços" },
      { status: 500 }
    );
  }
}
