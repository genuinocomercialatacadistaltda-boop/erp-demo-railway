import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * API Pública - Login de Cliente Final
 * POST: Autentica um cliente final (ClientCustomer)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { phone, email, identifier, password } = body;

    // Aceita phone, email ou identifier (pode ser telefone ou email)
    const loginIdentifier = identifier || phone || email;

    if (!loginIdentifier || !password) {
      return NextResponse.json(
        { error: "E-mail/Telefone e senha são obrigatórios" },
        { status: 400 }
      );
    }

    console.log('[PUBLIC_LOGIN] Tentativa de login:', {
      slug,
      identifier: loginIdentifier,
      hasPassword: !!password
    });

    // Buscar cliente principal pelo slug
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
    });

    if (!customer || !customer.isActive) {
      console.log('[PUBLIC_LOGIN] Loja não encontrada:', slug);
      return NextResponse.json(
        { error: "Loja não encontrada" },
        { status: 404 }
      );
    }

    // Buscar cliente final por telefone OU email
    const clientCustomer = await prisma.clientCustomer.findFirst({
      where: {
        customerId: customer.id,
        isActive: true,
        OR: [
          { phone: loginIdentifier },
          { email: loginIdentifier }
        ]
      },
    });

    console.log('[PUBLIC_LOGIN] Cliente encontrado:', {
      found: !!clientCustomer,
      hasPassword: !!clientCustomer?.password,
      phone: clientCustomer?.phone,
      email: clientCustomer?.email
    });

    if (!clientCustomer || !clientCustomer.password) {
      return NextResponse.json(
        { error: "Usuário não encontrado ou senha não cadastrada" },
        { status: 401 }
      );
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(
      password,
      clientCustomer.password
    );

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    // Atualizar lastLoginAt
    await prisma.clientCustomer.update({
      where: { id: clientCustomer.id },
      data: { lastLoginAt: new Date() },
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
    console.error("[PUBLIC_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao fazer login" },
      { status: 500 }
    );
  }
}
