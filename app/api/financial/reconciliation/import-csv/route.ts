export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bankAccountId = formData.get('bankAccountId') as string;

    if (!file || !bankAccountId) {
      return NextResponse.json({ error: 'Arquivo e conta bancária são obrigatórios' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // Remove header if exists
    const dataLines = lines[0].includes('data') || lines[0].includes('Data') ? lines.slice(1) : lines;
    
    const imported: any[] = [];
    let errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        // Formato esperado: data,descricao,valor,tipo
        // Exemplo: 2025-11-06,Pagamento recebido,1500.00,CREDIT
        const parts = line.split(',').map((p: any) => p.trim());
        
        if (parts.length < 4) {
          errors.push(`Linha ${i + 1}: formato inválido`);
          continue;
        }

        const [dateStr, description, amountStr, type] = parts;
        const amount = parseFloat(amountStr.replace('R$', '').replace('.', '').replace(',', '.'));
        
        if (isNaN(amount)) {
          errors.push(`Linha ${i + 1}: valor inválido`);
          continue;
        }

        // Buscar saldo atual da conta
        const account = await prisma.bankAccount.findUnique({
          where: { id: bankAccountId }
        });
        
        const transactionAmount = type === 'CREDIT' || type === 'Crédito' ? Math.abs(amount) : -Math.abs(amount);
        const newBalance = (account?.balance || 0) + transactionAmount;
        
        const transaction = await prisma.transaction.create({
          data: {
            bankAccountId,
            type: type === 'CREDIT' || type === 'Crédito' ? 'INCOME' : 'EXPENSE',
            amount: Math.abs(amount),
            description,
            date: new Date(dateStr),
            category: description.toLowerCase().includes('pagamento') ? 'Recebimento' : 'Outros',
            balanceAfter: newBalance,
          },
        });

        imported.push(transaction);
      } catch (error: any) {
        errors.push(`Linha ${i + 1}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro ao importar CSV:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
