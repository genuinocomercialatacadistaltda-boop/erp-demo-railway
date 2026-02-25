
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API de Sincronização de Produtos
 * POST: Sincroniza catálogo personalizado do admin com produtos do cliente
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é cliente
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { Customer: true },
    });

    if (!user?.Customer || user.userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso permitido apenas para clientes" },
        { status: 403 }
      );
    }

    const customerId = user.Customer.id;

    console.log("[SYNC_PRODUCTS] Iniciando sincronização para cliente:", customerId);

    // Buscar produtos do catálogo personalizado (produtos da fábrica que o cliente pode comprar)
    const catalogProducts = await prisma.customerProduct.findMany({
      where: {
        customerId: customerId,
        isVisible: true,
      },
      include: {
        Product: true,
      },
    });

    console.log("[SYNC_PRODUCTS] Produtos do catálogo encontrados:", catalogProducts.length);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Para cada produto do catálogo
    for (const catalogProduct of catalogProducts) {
      const product = catalogProduct.Product;

      // Verificar se já existe no ClientProduct (procurar por nome similar)
      const existingProduct = await prisma.clientProduct.findFirst({
        where: {
          customerId: customerId,
          name: {
            equals: product.name,
            mode: 'insensitive',
          },
        },
      });

      if (existingProduct) {
        // Atualizar preços se mudaram
        const factoryPrice = product.priceWholesale || product.priceRetail;
        // Preço de venda: se houver customPrice usa ele, senão usa o DOBRO do custo
        const sellPrice = catalogProduct.customPrice || (factoryPrice * 2);
        const needsUpdate =
          existingProduct.unitPrice !== sellPrice ||
          existingProduct.costPrice !== factoryPrice;

        if (needsUpdate) {
          await prisma.clientProduct.update({
            where: { id: existingProduct.id },
            data: {
              unitPrice: sellPrice,
              costPrice: factoryPrice,
              imageUrl: product.imageUrl,
              isActive: true,
            },
          });
          updated++;
          console.log("[SYNC_PRODUCTS] Atualizado:", product.name, "| Custo:", factoryPrice, "| Venda:", sellPrice);
        } else {
          skipped++;
        }
      } else {
        // Criar novo produto
        const factoryPrice = product.priceWholesale || product.priceRetail;
        // Preço de venda: se houver customPrice usa ele, senão usa o DOBRO do custo
        const sellPrice = catalogProduct.customPrice || (factoryPrice * 2);
        const newProduct = await prisma.clientProduct.create({
          data: {
            customerId,
            name: product.name,
            description: product.description,
            category: product.category,
            unitPrice: sellPrice, // Preço de venda = dobro do custo
            costPrice: factoryPrice, // O preço da fábrica é o custo para o cliente
            imageUrl: product.imageUrl,
            trackInventory: true,
            isActive: true,
          },
        });

        console.log("[SYNC_PRODUCTS] Criado:", product.name, "| Custo:", factoryPrice, "| Venda:", sellPrice);

        // Criar inventário para o novo produto
        await prisma.clientInventory.create({
          data: {
            customerId,
            productId: newProduct.id,
            currentStock: 0,
            minStock: 10, // Padrão
            measurementUnit: "UN",
          },
        });

        created++;
        console.log("[SYNC_PRODUCTS] Criado:", product.name);
      }
    }

    const result = {
      success: true,
      message: "Sincronização concluída",
      stats: {
        catalogProducts: catalogProducts.length,
        created,
        updated,
        skipped,
      },
    };

    console.log("[SYNC_PRODUCTS] Resultado:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SYNC_PRODUCTS_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar produtos" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é cliente
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { Customer: true },
    });

    if (!user?.Customer || user.userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso permitido apenas para clientes" },
        { status: 403 }
      );
    }

    const customerId = user.Customer.id;

    // Verificar status da sincronização
    const catalogCount = await prisma.customerProduct.count({
      where: {
        customerId: customerId,
        isVisible: true,
      },
    });

    const clientProductsCount = await prisma.clientProduct.count({
      where: {
        customerId: customerId,
      },
    });

    return NextResponse.json({
      catalogProducts: catalogCount,
      clientProducts: clientProductsCount,
      needsSync: catalogCount > clientProductsCount,
    });
  } catch (error) {
    console.error("[SYNC_STATUS_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    );
  }
}
