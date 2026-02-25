
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = params;

    // Buscar o boleto antes de deletar
    const boleto = await prisma.boleto.findUnique({
      where: { id },
    });

    if (!boleto) {
      return NextResponse.json({ error: "Boleto não encontrado" }, { status: 404 });
    }

    // Se o boleto tem orderId e foi pago, precisamos ajustar o crédito
    if (boleto.orderId && boleto.status === "PAID") {
      const customer = await prisma.customer.findUnique({
        where: { id: boleto.customerId },
      });

      if (customer) {
        // Restaurar o crédito (respeitando o limite)
        const newAvailableCredit = Number(customer.availableCredit) + Number(boleto.amount);
        const finalAvailableCredit = Math.min(newAvailableCredit, Number(customer.creditLimit));
        
        await prisma.customer.update({
          where: { id: boleto.customerId },
          data: {
            availableCredit: finalAvailableCredit,
          },
        });
        
        console.log('[DELETE_BOLETO] Crédito restaurado ao cliente:');
        console.log('[DELETE_BOLETO]   Crédito anterior:', customer.availableCredit);
        console.log('[DELETE_BOLETO]   Valor do boleto:', boleto.amount);
        console.log('[DELETE_BOLETO]   Crédito calculado:', newAvailableCredit);
        console.log('[DELETE_BOLETO]   Limite do cliente:', customer.creditLimit);
        console.log('[DELETE_BOLETO]   Crédito final:', finalAvailableCredit);
        
        if (newAvailableCredit > customer.creditLimit) {
          console.log('[DELETE_BOLETO]   ⚠️ LIMITE EXCEDIDO! Crédito ajustado para respeitar o limite');
        }
      }
    }

    // Deletar o boleto
    await prisma.boleto.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Boleto deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar boleto:", error);
    return NextResponse.json(
      { error: "Erro ao deletar boleto" },
      { status: 500 }
    );
  }
}
