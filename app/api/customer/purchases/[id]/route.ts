
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth-options';

// DELETE - Excluir compra do cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    // Verificar autenticação
    if (!session || !user?.customerId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log(`\n🗑️ [DELETE_PURCHASE] Cliente ${user.customerId} solicitando exclusão da compra ${params.id}...`);

    // Buscar compra e validar ownership
    const purchase = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        PurchaseItem: true,
        Expense: true
      }
    });

    if (!purchase) {
      console.log('   ❌ Compra não encontrada');
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se a compra pertence ao cliente
    if (purchase.customerId !== user.customerId) {
      console.log('   ❌ Compra não pertence ao cliente');
      return NextResponse.json(
        { error: 'Você não tem permissão para excluir esta compra' },
        { status: 403 }
      );
    }

    // Bloquear exclusão se compra já foi paga
    if (purchase.status === 'PAID') {
      console.log('   ❌ Compra já foi paga - não pode ser excluída');
      return NextResponse.json(
        { error: 'Compras já pagas não podem ser excluídas' },
        { status: 400 }
      );
    }

    console.log(`   ℹ️ Compra encontrada: ${purchase.purchaseNumber}`);
    console.log(`   ℹ️ Status: ${purchase.status}`);
    console.log(`   ℹ️ Itens: ${purchase.PurchaseItem.length}`);

    // Executar exclusão em transação
    await prisma.$transaction(async (tx: any) => {
      console.log('   🔄 Iniciando transação de exclusão...');

      // 1. Excluir despesa associada (se existir)
      if (purchase.Expense) {
        console.log(`   💰 Excluindo despesa associada: ${purchase.Expense.id}`);
        await tx.expense.delete({
          where: { id: purchase.Expense.id }
        });
      }

      // 2. Excluir itens da compra
      console.log(`   📝 Excluindo ${purchase.PurchaseItem.length} itens...`);
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: params.id }
      });

      // 3. Excluir a compra
      console.log('   🗑️ Excluindo compra...');
      await tx.purchase.delete({
        where: { id: params.id }
      });

      console.log('   ✅ Transação concluída com sucesso!');
    });

    console.log(`✅ [DELETE_PURCHASE] Compra ${purchase.purchaseNumber} excluída com sucesso\n`);

    return NextResponse.json({ 
      message: 'Compra excluída com sucesso',
      purchaseNumber: purchase.purchaseNumber
    });

  } catch (error) {
    console.error('❌ [DELETE_PURCHASE_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao excluir compra' },
      { status: 500 }
    );
  }
}
