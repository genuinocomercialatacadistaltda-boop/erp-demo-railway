import { NextRequest, NextResponse } from 'next/server';
import { authenticateClientCustomer } from '@/lib/client-customer-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await authenticateClientCustomer(email, password);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 401 }
      );
    }

    // Criar resposta com cookie
    const response = NextResponse.json({
      success: true,
      clientCustomer: result.clientCustomer,
    });

    // Configurar cookie com o token
    response.cookies.set('client-customer-token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
