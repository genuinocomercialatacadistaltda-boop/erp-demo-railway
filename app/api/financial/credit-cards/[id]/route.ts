
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// DELETE - Excluir cartão
export async function DELETE(
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

    console.log(`🗑️ [DELETE_CARD] Tentando excluir cartão: ${params.id}`);

    const card = await prisma.creditCard.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            Invoices: true,
            Expenses: true
          }
        }
      }
    });

    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado" },
        { status: 404 }
      );
    }

    console.log(`🗑️ [DELETE_CARD] Cartão: ${card.name}, Faturas: ${card._count.Invoices}, Despesas: ${card._count.Expenses}`);

    // Bloquear se houver DESPESAS vinculadas
    if (card._count.Expenses > 0) {
      return NextResponse.json(
        { 
          error: `Não é possível excluir. Existem ${card._count.Expenses} despesa(s) vinculada(s) ao cartão. Exclua primeiro as despesas.`
        },
        { status: 400 }
      );
    }

    // Se houver apenas faturas vazias (sem despesas), excluir as faturas automaticamente
    if (card._count.Invoices > 0) {
      console.log(`🧹 [DELETE_CARD] Limpando ${card._count.Invoices} fatura(s) vazia(s)...`);
      
      await prisma.creditCardInvoice.deleteMany({
        where: { 
          creditCardId: params.id
        }
      });
      
      console.log(`✅ [DELETE_CARD] Faturas vazias excluídas`);
    }

    await prisma.creditCard.delete({
      where: { id: params.id }
    });

    console.log(`✅ [DELETE_CARD] Cartão excluído com sucesso`);

    return NextResponse.json({ message: "Cartão excluído com sucesso" });
  } catch (error: any) {
    console.error("❌ [DELETE_CARD] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir cartão" },
      { status: 500 }
    );
  }
}
