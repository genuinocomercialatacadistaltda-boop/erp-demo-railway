export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API de Produtos do Cliente
 * GET: Lista produtos do cliente (ClientProduct)
 * POST: Cria um novo produto manualmente
 */

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

    // Obter parâmetros de filtro da URL
    const { searchParams } = new URL(request.url);
    const catalogFilter = searchParams.get('catalog'); // 'public', 'all', ou undefined

    // Construir filtro de produtos
    const where: any = {
      customerId: customerId,
    };

    // Se filtrar por catálogo público
    if (catalogFilter === 'public') {
      where.showInPublicCatalog = true;
    }

    console.log('[CUSTOMER_PRODUCTS_GET] Filtros aplicados:', where);

    // Buscar produtos do cliente com filtro
    const products = await prisma.clientProduct.findMany({
      where,
      include: {
        Inventory: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`[CUSTOMER_PRODUCTS_GET] Produtos encontrados: ${products.length}`);
    console.log(`[CUSTOMER_PRODUCTS_GET] Filtro: ${catalogFilter || 'todos'}`);

    return NextResponse.json(products);
  } catch (error) {
    console.error("[CUSTOMER_PRODUCTS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const {
      name,
      description,
      category,
      unitPrice,
      costPrice,
      imageUrl,
      trackInventory,
      initialStock,
      minStock,
      maxStock,
      measurementUnit,
    } = body;

    // Validações
    if (!name || !category || unitPrice === undefined) {
      return NextResponse.json(
        { error: "Nome, categoria e preço são obrigatórios" },
        { status: 400 }
      );
    }

    // Criar produto em uma transação
    const result = await prisma.$transaction(async (tx: any) => {
      // Criar produto
      const product = await tx.clientProduct.create({
        data: {
          customerId,
          name,
          description,
          category,
          unitPrice: Number(unitPrice),
          costPrice: costPrice ? Number(costPrice) : null,
          imageUrl,
          trackInventory: trackInventory !== false,
          isActive: true,
        },
      });

      // Se controla estoque, criar inventário
      if (trackInventory !== false) {
        await tx.clientInventory.create({
          data: {
            customerId,
            productId: product.id,
            currentStock: initialStock ? Number(initialStock) : 0,
            minStock: minStock ? Number(minStock) : null,
            maxStock: maxStock ? Number(maxStock) : null,
            measurementUnit: measurementUnit || "UN",
          },
        });
      }

      // Retornar produto com inventário
      return await tx.clientProduct.findUnique({
        where: { id: product.id },
        include: { Inventory: true },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[CUSTOMER_PRODUCTS_POST_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao criar produto" },
      { status: 500 }
    );
  }
}
