
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET - Retorna dados do funcionário logado
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // ✅ Aceita tanto EMPLOYEE quanto SELLER (quando tem employeeId)
    const userType = (session.user as any)?.userType;
    if (!session || (userType !== 'EMPLOYEE' && userType !== 'SELLER')) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const employeeId = (session.user as any)?.employeeId;
    
    if (!employeeId) {
      console.log('[EMPLOYEE_PROFILE] ❌ Usuário não tem employeeId vinculado');
      return NextResponse.json(
        { error: 'ID do funcionário não encontrado na sessão' },
        { status: 400 }
      );
    }
    
    console.log('[EMPLOYEE_PROFILE] ✅ Buscando perfil - EmployeeId:', employeeId, 'UserType:', userType);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        receivables: {
          // Buscar todos os receivables para calcular crédito utilizado
          orderBy: { dueDate: 'asc' }
        },
        orders: {
          where: { paymentStatus: 'UNPAID' },
          select: { id: true, total: true, paymentStatus: true }
        },
        _count: {
          select: {
            timeRecords: true,
            documents: true,
            payments: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // ✅ LIMITE FIXO DE R$ 300 PARA TODOS FUNCIONÁRIOS (igual à API de customers-health)
    const EMPLOYEE_CREDIT_LIMIT = 300;
    
    // ✅ CALCULAR CRÉDITO UTILIZADO (igual à lógica de customers-health)
    // Receivables pendentes/atrasados
    const pendingReceivablesAmount = (employee.receivables || [])
      .filter((r: any) => r.status === 'PENDING' || r.status === 'OVERDUE')
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);
    
    // Pedidos não pagos que não têm receivable associado
    const unpaidOrdersAmount = (employee.orders || [])
      .filter((o: any) => {
        if (o.paymentStatus !== 'UNPAID') return false;
        // Verificar se existe receivable para este pedido
        const hasReceivable = (employee.receivables || []).some((r: any) => r.orderId === o.id);
        return !hasReceivable;
      })
      .reduce((sum: number, o: any) => sum + Number(o.total), 0);
    
    const totalUsed = pendingReceivablesAmount + unpaidOrdersAmount;
    const availableCredit = EMPLOYEE_CREDIT_LIMIT - totalUsed;
    
    // Contar boletos em aberto e em atraso
    const now = new Date();
    const openReceivables = (employee.receivables || []).filter((r: any) => 
      r.status === 'PENDING' || r.status === 'OVERDUE'
    );
    const overdueReceivables = openReceivables.filter((r: any) => {
      if (!r.dueDate) return false;
      const dueDate = new Date(r.dueDate);
      return dueDate < now;
    });
    
    console.log('[EMPLOYEE_PROFILE] 💰 Crédito calculado:', {
      employeeId,
      name: employee.name,
      limiteTotal: EMPLOYEE_CREDIT_LIMIT,
      utilizado: totalUsed,
      disponivel: availableCredit,
      receivablesPendentes: pendingReceivablesAmount,
      pedidosNaoPagos: unpaidOrdersAmount,
      boletosEmAberto: openReceivables.length,
      boletosEmAtraso: overdueReceivables.length
    });

    // Remove a senha e dados brutos do retorno
    const { password, receivables, orders, ...employeeData } = employee as any;

    // ✅ Retornar dados com crédito calculado corretamente
    return NextResponse.json({
      ...employeeData,
      // Dados de crédito calculados (igual ao formato de customers-health)
      creditLimit: EMPLOYEE_CREDIT_LIMIT,
      totalUsed: totalUsed,
      availableCredit: availableCredit,
      openBoletosCount: openReceivables.length,
      overdueBoletosCount: overdueReceivables.length,
      // Percentual utilizado
      usedPercentage: EMPLOYEE_CREDIT_LIMIT > 0 ? Math.round((totalUsed / EMPLOYEE_CREDIT_LIMIT) * 100) : 0,
      // Flags de hierarquia
      isSupervisor: employee.isSupervisor || false,
      isManager: employee.isManager || false,
      isCEO: employee.isCEO || false
    });
  } catch (error: any) {
    console.error('Erro ao buscar perfil do funcionário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar perfil', details: error.message },
      { status: 500 }
    );
  }
}
