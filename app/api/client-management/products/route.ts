export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const products = await prisma.clientProduct.findMany({
      where: { customerId },
      include: {
        Inventory: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("[CLIENT_PRODUCTS_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar produtos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const product = await prisma.clientProduct.create({
      data: {
        customerId,
        name: body.name,
        description: body.description,
        category: body.category,
        unitPrice: body.unitPrice,
        costPrice: body.costPrice,
        imageUrl: body.imageUrl,
        isActive: body.isActive !== undefined ? body.isActive : true,
        trackInventory: body.trackInventory !== undefined ? body.trackInventory : true,
      },
    });

    // Criar estoque se trackInventory estiver ativado
    if (body.trackInventory) {
      await prisma.clientInventory.create({
        data: {
          customerId,
          productId: product.id,
          currentStock: body.initialStock || 0,
          minStock: body.minStock,
          measurementUnit: body.measurementUnit || "UN",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("[CLIENT_PRODUCTS_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar produto" },
      { status: 500 }
    );
  }
}
