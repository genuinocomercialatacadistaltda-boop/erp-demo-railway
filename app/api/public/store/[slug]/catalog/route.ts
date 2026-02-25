import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getImageUrl } from "@/lib/s3";
import { sortProductsByCategory } from "@/lib/category-sort";

/**
 * API Pública - Catálogo de Produtos da Loja
 * GET: Retorna produtos públicos de um cliente específico
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Buscar cliente pelo slug
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
      select: {
        id: true,
        name: true,
        storeName: true,
        storeSlug: true,
        storeLogo: true,
        phone: true,
        city: true,
        address: true,
        isActive: true,
      },
    });

    if (!customer || !customer.isActive) {
      return NextResponse.json(
        { error: "Loja não encontrada" },
        { status: 404 }
      );
    }

    // Buscar produtos públicos do cliente
    const rawProducts = await prisma.clientProduct.findMany({
      where: {
        customerId: customer.id,
        isActive: true,
        showInPublicCatalog: true,
      },
      include: {
        Inventory: {
          select: {
            currentStock: true,
            measurementUnit: true,
          },
        },
      },
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
    });

    // Processar URLs das imagens
    const products = await Promise.all(
      rawProducts.map(async (product) => ({
        ...product,
        imageUrl: product.imageUrl ? await getImageUrl(product.imageUrl) : null,
      }))
    );

    // 📦 Ordenar por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(products);

    // Processar URL da logo da loja (S3 -> URL assinada)
    let storeLogoUrl = null;
    if (customer.storeLogo) {
      try {
        storeLogoUrl = await getImageUrl(customer.storeLogo);
        console.log(`[PUBLIC_CATALOG] Logo processada: ${customer.storeLogo} -> ${storeLogoUrl}`);
      } catch (error) {
        console.error('[PUBLIC_CATALOG] Erro ao processar logo:', error);
        storeLogoUrl = null;
      }
    }

    return NextResponse.json({
      store: {
        ...customer,
        storeLogo: storeLogoUrl, // URL assinada em vez do caminho S3
      },
      products: sortedProducts,
    });
  } catch (error) {
    console.error("[PUBLIC_CATALOG_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao buscar catálogo" },
      { status: 500 }
    );
  }
}
