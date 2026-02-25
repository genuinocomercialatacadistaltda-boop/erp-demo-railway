export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { verifyClientCustomerToken } from '@/lib/client-customer-auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const result = await verifyClientCustomerToken(token);

    if (!result.valid) {
      return NextResponse.json(
        { authenticated: false, message: 'Sessão inválida ou expirada' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      clientCustomer: result.session,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { authenticated: false, message: 'Erro ao verificar sessão' },
      { status: 500 }
    );
  }
}
