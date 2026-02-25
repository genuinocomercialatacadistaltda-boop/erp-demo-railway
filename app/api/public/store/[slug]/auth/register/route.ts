import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * API Pública - Cadastro de Cliente Final
 * POST: Cria uma nova conta de cliente final (ClientCustomer)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { name, phone, email, password, document, address } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: "Nome, telefone e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar cliente principal pelo slug
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
    });

    if (!customer || !customer.isActive) {
      return NextResponse.json(
        { error: "Loja não encontrada" },
        { status: 404 }
      );
    }

    // Verificar se o telefone já está cadastrado para este cliente principal
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        customerId: customer.id,
        phone: phone,
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Telefone já cadastrado" },
        { status: 400 }
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar cliente final
    const clientCustomer = await prisma.clientCustomer.create({
      data: {
        customerId: customer.id,
        name,
        phone,
        email: email || null,
        password: hashedPassword,
        document: document || null,
        address: address || null,
        creditLimit: 0,
        currentDebt: 0,
        pointsBalance: 0,
        totalPointsEarned: 0,
        pointsMultiplier: 1.0,
        isActive: true,
      },
    });

    // Retornar dados do cliente (sem a senha)
    return NextResponse.json({
      success: true,
      customer: {
        id: clientCustomer.id,
        name: clientCustomer.name,
        phone: clientCustomer.phone,
        email: clientCustomer.email,
        pointsBalance: clientCustomer.pointsBalance,
        creditLimit: clientCustomer.creditLimit,
        currentDebt: clientCustomer.currentDebt,
      },
    });
  } catch (error) {
    console.error("[PUBLIC_REGISTER_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}
