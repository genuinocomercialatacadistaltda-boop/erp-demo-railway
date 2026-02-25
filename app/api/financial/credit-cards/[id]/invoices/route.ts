export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    console.log('📋 [GET_INVOICES] Buscando faturas do cartão:', params.id);

    const invoices = await prisma.creditCardInvoice.findMany({
      where: {
        creditCardId: params.id
      },
      orderBy: {
        referenceMonth: 'desc'
      },
      select: {
        id: true,
        referenceMonth: true,
        closingDate: true,
        dueDate: true,
        totalAmount: true,
        status: true,
        _count: {
          select: {
            Expenses: true
          }
        }
      }
    });

    console.log('✅ [GET_INVOICES] Faturas encontradas:', invoices.length);

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('❌ [GET_INVOICES] Erro:', error);
    return NextResponse.json(
      { error: "Erro ao buscar faturas" },
      { status: 500 }
    );
  }
}
