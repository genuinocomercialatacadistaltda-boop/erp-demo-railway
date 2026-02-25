import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API para Toggle de Produto no Catálogo Público
 * PATCH: Liga/desliga exibição do produto na loja pública
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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
    const productId = params.id;

    // Buscar o produto
    const product = await prisma.clientProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se o produto pertence ao cliente
    if (product.customerId !== customerId) {
      return NextResponse.json(
        { error: "Produto não pertence ao cliente" },
        { status: 403 }
      );
    }

    // Toggle o status
    const updatedProduct = await prisma.clientProduct.update({
      where: { id: productId },
      data: {
        showInPublicCatalog: !product.showInPublicCatalog,
      },
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("[TOGGLE_PUBLIC_CATALOG_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar produto" },
      { status: 500 }
    );
  }
}
