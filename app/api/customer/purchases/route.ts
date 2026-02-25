
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth-options';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    // Verificar autenticação
    if (!session || !user?.customerId) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    console.log(`\n📦 [CUSTOMER_PURCHASES] Carregando compras do cliente ${user.customerId}...`);

    // Buscar compras do cliente (pedidos que ele fez na fábrica)
    const purchases = await prisma.purchase.findMany({
      where: {
        customerId: user.customerId // 🛒 Compras do cliente (vendas para o admin)
      },
      include: {
        Supplier: {
          select: {
            id: true,
            name: true
          }
        },
        PurchaseItem: {
          include: {
            RawMaterial: {
              select: {
                id: true,
                name: true,
                measurementUnit: true
              }
            }
          }
        },
        Expense: {
          select: {
            id: true,
            status: true,
            paymentDate: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ [CUSTOMER_PURCHASES] ${purchases.length} compra(s) encontrada(s)`);

    // Serializar dados
    const serializedPurchases = purchases.map((purchase: any) => ({
      ...purchase,
      totalAmount: Number(purchase.totalAmount),
      purchaseDate: purchase.purchaseDate.toISOString(),
      dueDate: purchase.dueDate.toISOString(),
      paymentDate: purchase.paymentDate?.toISOString(),
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
      PurchaseItem: purchase.PurchaseItem.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    }));

    return NextResponse.json(serializedPurchases);
  } catch (error) {
    console.error('❌ [CUSTOMER_PURCHASES_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao carregar compras' },
      { status: 500 }
    );
  }
}
