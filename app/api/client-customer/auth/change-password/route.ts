import { NextRequest, NextResponse } from 'next/server';
import { verifyClientCustomerToken, changeClientCustomerPassword } from '@/lib/client-customer-auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Senha atual e nova senha são obrigatórias' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'A nova senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    const result = await changeClientCustomerPassword(
      session.id,
      currentPassword,
      newPassword
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao alterar senha' },
      { status: 500 }
    );
  }
}
