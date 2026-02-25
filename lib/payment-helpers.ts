
import { prisma } from '@/lib/prisma';

/**
 * Verifica se um funcionário assinou o CONTRACHEQUE (não o pagamento)
 * @param employeeId ID do funcionário
 * @param month Mês de referência
 * @param year Ano de referência
 * @returns true se assinou o contracheque, false caso contrário
 */
export async function hasEmployeeAcknowledgedContracheque(
  employeeId: string,
  month: number,
  year: number
): Promise<boolean> {
  try {
    // Buscar contracheque do funcionário para o mês/ano
    const contracheque = await prisma.employeeDocument.findFirst({
      where: {
        employeeId,
        documentType: 'CONTRACHEQUE',
        title: {
          contains: `${month}/${year}`
        }
      },
      include: {
        documentAck: true
      }
    });

    // Verificar se tem assinatura digital
    return !!contracheque?.documentAck;
  } catch (error) {
    console.error('[hasEmployeeAcknowledgedContracheque] Erro:', error);
    return false;
  }
}

/**
 * Verifica aceites digitais de CONTRACHEQUES para múltiplos pagamentos
 * IMPORTANTE: Verifica em DUAS tabelas:
 *   1. EmployeePaymentAcknowledgment (aceite na aba "Pagamentos")
 *   2. DocumentAcknowledgment (aceite na aba "Contracheques")
 * Se assinou em QUALQUER uma, considera como assinado.
 * @param paymentIds Array de IDs de pagamentos
 * @returns Array com status de aceite para cada pagamento
 */
export async function checkMultiplePaymentAcknowledgments(
  paymentIds: string[]
): Promise<Array<{
  paymentId: string;
  employeeId: string;
  employeeName: string;
  hasAcknowledgment: boolean;
  month: number;
  year: number;
}>> {
  try {
    // Buscar todos os pagamentos com informações do funcionário
    const payments = await prisma.employeePayment.findMany({
      where: {
        id: {
          in: paymentIds
        }
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Para cada pagamento, verificar aceite em AMBAS as tabelas
    const results = await Promise.all(payments.map(async (payment) => {
      // 1. Verificar aceite do PAGAMENTO (aba "Pagamentos")
      const paymentAck = await prisma.employeePaymentAcknowledgment.findFirst({
        where: {
          paymentId: payment.id,
          employeeId: payment.employeeId
        }
      });

      // 2. Verificar aceite do DOCUMENTO/CONTRACHEQUE (aba "Contracheques")
      // Buscar o documento do contracheque para este mês/ano
      const contracheque = await prisma.employeeDocument.findFirst({
        where: {
          employeeId: payment.employeeId,
          documentType: 'CONTRACHEQUE',
          title: { contains: `${payment.month}/${payment.year}` }
        },
        include: {
          documentAck: true
        }
      });

      // Considera assinado se assinou em QUALQUER uma das tabelas
      const hasAck = !!paymentAck || !!contracheque?.documentAck;

      return {
        paymentId: payment.id,
        employeeId: payment.employee.id,
        employeeName: payment.employee.name,
        hasAcknowledgment: hasAck,
        month: payment.month,
        year: payment.year
      };
    }));

    return results;
  } catch (error) {
    console.error('[checkMultiplePaymentAcknowledgments] Erro:', error);
    return [];
  }
}

/**
 * Obtém lista de funcionários que não assinaram o CONTRACHEQUE
 * @param paymentIds Array de IDs de pagamentos
 * @returns Array com funcionários pendentes
 */
export async function getEmployeesWithoutAcknowledgment(
  paymentIds: string[]
): Promise<Array<{
  employeeId: string;
  employeeName: string;
  paymentId: string;
  month: number;
  year: number;
}>> {
  try {
    const results = await checkMultiplePaymentAcknowledgments(paymentIds);
    
    // Filtrar apenas os que NÃO assinaram o contracheque
    const withoutAck = results.filter(r => !r.hasAcknowledgment);

    console.log(`[getEmployeesWithoutAcknowledgment] ${withoutAck.length} funcionários SEM assinatura de contracheque`);
    withoutAck.forEach(w => {
      console.log(`   - ${w.employeeName} (${w.month}/${w.year})`);
    });

    return withoutAck.map(w => ({
      employeeId: w.employeeId,
      employeeName: w.employeeName,
      paymentId: w.paymentId,
      month: w.month,
      year: w.year
    }));
  } catch (error) {
    console.error('[getEmployeesWithoutAcknowledgment] Erro:', error);
    return [];
  }
}
