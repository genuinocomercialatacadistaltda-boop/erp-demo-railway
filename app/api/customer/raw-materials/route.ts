export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API de Matérias-Primas para Clientes
 * GET: Lista matérias-primas disponíveis para o cliente
 * POST: Cria uma nova matéria-prima (estoque do cliente)
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

    // Buscar todas as matérias-primas ativas
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        isActive: true,
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true,
            document: true,
            phone: true,
          },
        },
        Category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(rawMaterials);
  } catch (error) {
    console.error("[CUSTOMER_RAW_MATERIALS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao buscar matérias-primas" },
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

    const body = await request.json();
    const {
      name,
      description,
      sku,
      measurementUnit,
      currentStock,
      minStock,
      maxStock,
      costPerUnit,
      supplierId,
      categoryId,
      imageUrl,
      notes,
    } = body;

    // Verificar se SKU já existe (se fornecido)
    if (sku) {
      const existingMaterial = await prisma.rawMaterial.findUnique({
        where: { sku },
      });

      if (existingMaterial) {
        return NextResponse.json(
          { error: "SKU já cadastrado" },
          { status: 400 }
        );
      }
    }

    // Criar matéria-prima
    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        name,
        description,
        sku,
        measurementUnit: measurementUnit || "UN",
        currentStock: currentStock || 0,
        minStock,
        maxStock,
        costPerUnit,
        supplierId,
        categoryId,
        imageUrl,
        notes,
        isActive: true,
      },
      include: {
        Supplier: true,
        Category: true,
      },
    });

    return NextResponse.json(rawMaterial, { status: 201 });
  } catch (error) {
    console.error("[CUSTOMER_RAW_MATERIALS_POST_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao criar matéria-prima" },
      { status: 500 }
    );
  }
}
