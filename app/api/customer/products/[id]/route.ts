
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API de Produto Individual do Cliente
 * GET: Busca um produto específico
 * PUT: Atualiza um produto
 * DELETE: Remove um produto
 */

export async function GET(
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

    const product = await prisma.clientProduct.findFirst({
      where: {
        id: params.id,
        customerId: user.Customer.id,
      },
      include: {
        Inventory: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("[CUSTOMER_PRODUCT_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao buscar produto" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Verificar se o produto pertence ao cliente
    const existingProduct = await prisma.clientProduct.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      unitPrice,
      costPrice,
      imageUrl,
      trackInventory,
      isActive,
      minStock,
      maxStock,
      measurementUnit,
    } = body;

    // Atualizar produto
    const updatedProduct = await prisma.clientProduct.update({
      where: { id: params.id },
      data: {
        name: name || existingProduct.name,
        description: description !== undefined ? description : existingProduct.description,
        category: category || existingProduct.category,
        unitPrice: unitPrice !== undefined ? Number(unitPrice) : existingProduct.unitPrice,
        costPrice: costPrice !== undefined ? (costPrice ? Number(costPrice) : null) : existingProduct.costPrice,
        imageUrl: imageUrl !== undefined ? imageUrl : existingProduct.imageUrl,
        trackInventory: trackInventory !== undefined ? trackInventory : existingProduct.trackInventory,
        isActive: isActive !== undefined ? isActive : existingProduct.isActive,
      },
      include: {
        Inventory: true,
      },
    });

    // Atualizar inventário se existir
    if (updatedProduct.Inventory && (minStock !== undefined || maxStock !== undefined || measurementUnit !== undefined)) {
      await prisma.clientInventory.update({
        where: { id: updatedProduct.Inventory.id },
        data: {
          minStock: minStock !== undefined ? (minStock ? Number(minStock) : null) : updatedProduct.Inventory.minStock,
          maxStock: maxStock !== undefined ? (maxStock ? Number(maxStock) : null) : updatedProduct.Inventory.maxStock,
          measurementUnit: measurementUnit || updatedProduct.Inventory.measurementUnit,
        },
      });
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("[CUSTOMER_PRODUCT_PUT_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar produto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verificar se o produto pertence ao cliente
    const existingProduct = await prisma.clientProduct.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se há vendas vinculadas
    const salesCount = await prisma.clientSaleItem.count({
      where: {
        productId: params.id,
      },
    });

    if (salesCount > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir produto com vendas registradas" },
        { status: 400 }
      );
    }

    // Deletar produto (inventário será deletado em cascata)
    await prisma.clientProduct.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CUSTOMER_PRODUCT_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao deletar produto" },
      { status: 500 }
    );
  }
}
