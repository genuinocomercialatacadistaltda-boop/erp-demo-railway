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

    const finalCustomers = await prisma.clientCustomer.findMany({
      where: { customerId },
      orderBy: [
        { name: "asc" },
      ],
    });

    // Buscar contas a receber para cada cliente
    const customersWithDebts = await Promise.all(
      finalCustomers.map(async (customer) => {
        const unpaidSales = await prisma.clientSale.findMany({
          where: {
            customerId,
            linkedCustomerId: customer.id,
            isPaid: false,
            paymentStatus: "PENDING",
          },
          select: {
            id: true,
            total: true,
            createdAt: true,
            saleNumber: true,
          },
        });

        const totalDebt = unpaidSales.reduce((sum, sale) => sum + sale.total, 0);
        const oldestDebt = unpaidSales.length > 0 ? unpaidSales.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0] : null;

        // Calcular dias em atraso
        const daysOverdue = oldestDebt
          ? Math.floor(
              (new Date().getTime() - new Date(oldestDebt.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        return {
          ...customer,
          totalDebt,
          unpaidSalesCount: unpaidSales.length,
          oldestDebtDate: oldestDebt?.createdAt || null,
          daysOverdue,
          isOverdue: daysOverdue > 0,
          unpaidSales,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: customersWithDebts,
    });
  } catch (error) {
    console.error("[CLIENT_FINAL_CUSTOMERS_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar clientes" },
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
    const { name, phone, email, address, document, creditLimit, notes } = body;

    // Validações
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se já existe um cliente com este nome
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        customerId,
        name: name.trim(),
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Já existe um cliente com este nome" },
        { status: 400 }
      );
    }

    const finalCustomer = await prisma.clientCustomer.create({
      data: {
        customerId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        document: document?.trim() || null,
        creditLimit: creditLimit || 0,
        currentDebt: 0,
        notes: notes?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: finalCustomer,
    });
  } catch (error) {
    console.error("[CLIENT_FINAL_CUSTOMERS_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar cliente" },
      { status: 500 }
    );
  }
}
