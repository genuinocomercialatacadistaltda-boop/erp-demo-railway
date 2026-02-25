export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// Helper para obter início do dia em Brasília (00:00 BRT = 03:00 UTC)
function getBrasiliaToday() {
  const now = new Date()
  // Ajusta para horário de Brasília (UTC-3)
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
  
  const year = brasiliaTime.getUTCFullYear()
  const month = brasiliaTime.getUTCMonth()
  const day = brasiliaTime.getUTCDate()
  
  // Retorna UTC equivalente a 00:00 de Brasília (03:00 UTC)
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

// GET - Listar contas a receber
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const customerId = searchParams.get("customerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Atualizar status dos receivables vencidos usando horário de Brasília
    const brasiliaToday = getBrasiliaToday()
    console.log('[RECEIVABLES_GET] Verificando receivables vencidos...')
    console.log('[RECEIVABLES_GET] Data de referência (início do dia de Brasília):', brasiliaToday.toISOString())

    // Buscar receivables PENDING com vencimento anterior ao dia de hoje
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: brasiliaToday
        }
      },
      select: {
        id: true,
        dueDate: true,
        customerId: true,
      }
    })

    console.log(`[RECEIVABLES_GET] Encontrados ${overdueReceivables.length} receivables vencidos`)

    // Marcar como OVERDUE
    if (overdueReceivables.length > 0) {
      for (const receivable of overdueReceivables) {
        console.log(`[RECEIVABLES_GET] Marcando como OVERDUE: ${receivable.id}, customerId=${receivable.customerId}, vencimento=${receivable.dueDate.toISOString()}`)
      }

      await prisma.receivable.updateMany({
        where: {
          id: {
            in: overdueReceivables.map((r) => r.id),
          },
        },
        data: {
          status: 'OVERDUE',
        },
      })
      
      console.log(`[RECEIVABLES_GET] ✅ ${overdueReceivables.length} receivables marcados como OVERDUE`)
    }

    const where: any = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (paymentMethod && paymentMethod !== "all") {
      where.paymentMethod = paymentMethod;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate && endDate) {
      where.dueDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const receivables = await prisma.receivable.findMany({
      where,
      orderBy: { dueDate: "asc" },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Employee: { // 🆕 Incluir funcionário
          select: {
            id: true,
            name: true,
            phone: true,
            employeeNumber: true,
            position: true,
          },
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            casualCustomerName: true, // 🆕 Nome do cliente avulso (legado)
            customerName: true, // 🔧 CORREÇÃO: Campo principal para clientes avulsos
          },
        },
        Boleto: {
          select: {
            id: true,
            boletoNumber: true,
          },
        },
        BankAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 🎯 FILTRAR RECEIVABLES: Excluir os que têm boletoId (para evitar duplicação)
    console.log('[RECEIVABLES_GET] 🎯 Filtrando receivables (excluir os que têm boleto)...')
    const receivablesWithoutBoleto = receivables.filter((r: any) => !r.boletoId);
    console.log('[RECEIVABLES_GET] 📊 Receivables SEM boleto:', receivablesWithoutBoleto.length)
    console.log('[RECEIVABLES_GET] 📊 Receivables COM boleto (excluídos):', receivables.length - receivablesWithoutBoleto.length)

    // 🆕 BUSCAR BOLETOS TAMBÉM (para mostrar em "Contas a Receber")
    console.log('[RECEIVABLES_GET] 🎯 Buscando BOLETOS para incluir em "Contas a Receber"...')
    
    const boletoWhere: any = {};
    
    // Aplicar os mesmos filtros para boletos
    if (status && status !== "all") {
      // Mapear status de receivable para status de boleto
      if (status === 'PENDING') {
        boletoWhere.status = 'PENDING'
      } else if (status === 'OVERDUE') {
        boletoWhere.status = 'OVERDUE'
      } else if (status === 'PAID') {
        boletoWhere.status = 'PAID'
      }
    }
    
    if (customerId) {
      boletoWhere.customerId = customerId;
    }
    
    if (startDate && endDate) {
      boletoWhere.dueDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const boletos = await prisma.boleto.findMany({
      where: boletoWhere,
      orderBy: { dueDate: "asc" },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            casualCustomerName: true, // 🆕 Nome do cliente avulso (legado)
            customerName: true, // 🔧 CORREÇÃO: Campo principal para clientes avulsos
          },
        },
      },
    });
    
    console.log('[RECEIVABLES_GET] 📊 Boletos encontrados:', boletos.length)
    
    // 🆕 CONVERTER BOLETOS PARA O FORMATO DE RECEIVABLE
    const boletosAsReceivables = boletos.map((boleto: any) => ({
      id: boleto.id,
      customerId: boleto.customerId,
      orderId: boleto.orderId,
      boletoId: boleto.id, // Referência ao próprio boleto
      description: `Boleto ${boleto.boletoNumber}`,
      amount: boleto.amount,
      dueDate: boleto.dueDate,
      paymentDate: boleto.paymentDate,
      status: boleto.status,
      paymentMethod: 'BOLETO',
      notes: boleto.notes,
      referenceNumber: boleto.boletoNumber,
      feeAmount: null,
      netAmount: boleto.amount,
      isInstallment: boleto.isInstallment,
      installmentNumber: boleto.installmentNumber,
      totalInstallments: boleto.totalInstallments,
      bankAccountId: null,
      createdBy: null,
      createdAt: boleto.createdAt,
      updatedAt: boleto.updatedAt,
      competenceDate: null,
      Customer: boleto.Customer,
      Order: boleto.Order,
      Boleto: {
        id: boleto.id,
        boletoNumber: boleto.boletoNumber,
      },
      BankAccount: null,
      // Flag para identificar que é um boleto (não um receivable puro)
      isBoleto: true
    }));
    
    // 🆕 COMBINAR APENAS:
    // - Receivables SEM boleto (PIX, dinheiro, etc)
    // - Boletos (que representam pedidos com boleto)
    // ✅ SEM DUPLICAÇÃO!
    const combined = [...receivablesWithoutBoleto, ...boletosAsReceivables];
    
    // Ordenar por data de vencimento
    combined.sort((a: any, b: any) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });
    
    console.log('[RECEIVABLES_GET] ✅ Total combinado (SEM duplicação):', combined.length)
    console.log('[RECEIVABLES_GET] ✅ Breakdown: Receivables puros:', receivablesWithoutBoleto.length, '+ Boletos:', boletos.length)

    return NextResponse.json(combined);
  } catch (error) {
    console.error("Erro ao buscar contas a receber:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas a receber" },
      { status: 500 }
    );
  }
}

// POST - Criar conta a receber
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const amount = parseFloat(body.amount);
    const customerId = body.customerId;
    const employeeId = body.employeeId; // 🆕 Suporte para funcionários

    console.log('[RECEIVABLE_CREATE] Criando nova notinha...')
    console.log('[RECEIVABLE_CREATE] Cliente:', customerId)
    console.log('[RECEIVABLE_CREATE] Funcionário:', employeeId) // 🆕
    console.log('[RECEIVABLE_CREATE] Valor:', amount)
    console.log('[RECEIVABLE_CREATE] Status:', body.status || "PENDING")

    // CRÍTICO: Criar receivable E descontar limite do cliente/funcionário em uma transação atômica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar o receivable
      const receivable = await tx.receivable.create({
        data: {
          customerId: customerId || null,
          employeeId: employeeId || null, // 🆕 Adicionar employeeId
          orderId: body.orderId,
          boletoId: body.boletoId,
          description: body.description,
          amount: amount,
          dueDate: new Date(body.dueDate),
          competenceDate: body.competenceDate ? new Date(body.competenceDate) : null,
          status: body.status || "PENDING",
          paymentMethod: body.paymentMethod,
          notes: body.notes,
          referenceNumber: body.referenceNumber,
          feeAmount: body.feeAmount ? parseFloat(body.feeAmount) : null,
          netAmount: body.netAmount ? parseFloat(body.netAmount) : null,
          isInstallment: body.isInstallment || false,
          installmentNumber: body.installmentNumber,
          totalInstallments: body.totalInstallments,
          bankAccountId: body.bankAccountId,
          createdBy: (session.user as any)?.id,
        },
        include: {
          Customer: true,
          Employee: true, // 🆕 Incluir funcionário
          Order: true,
          Boleto: true,
          BankAccount: true,
        },
      });

      console.log('[RECEIVABLE_CREATE] Receivable criado:', receivable.id)

      // 2. CRÍTICO: Descontar limite disponível do cliente OU funcionário
      if (receivable.status !== 'PAID') {
        if (employeeId) {
          // 🆕 Descontar limite do funcionário
          const employee = await tx.employee.findUnique({
            where: { id: employeeId },
            select: {
              creditLimit: true,
              name: true,
            },
          })

          if (employee && employee.creditLimit > 0) {
            // Nota: Employee não tem campo availableCredit no BD, 
            // o cálculo é feito dinamicamente, então não precisa atualizar nada aqui
            console.log('[RECEIVABLE_CREATE] 🔥 FUNCIONÁRIO:', employee.name)
            console.log('[RECEIVABLE_CREATE] 🔥 Limite total do funcionário:', employee.creditLimit)
            console.log('[RECEIVABLE_CREATE] 🔥 Valor descontado (calculado dinamicamente):', amount)
          }
        } else if (customerId) {
          // Descontar limite do cliente
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: {
              availableCredit: true,
              creditLimit: true,
            },
          })

          if (customer) {
            const newAvailableCredit = customer.availableCredit - amount;

            await tx.customer.update({
              where: { id: customerId },
              data: {
                availableCredit: newAvailableCredit,
              },
            })

            console.log('[RECEIVABLE_CREATE] ✅ LIMITE DESCONTADO DO CLIENTE')
            console.log('[RECEIVABLE_CREATE] Limite anterior:', customer.availableCredit)
            console.log('[RECEIVABLE_CREATE] Valor descontado:', amount)
            console.log('[RECEIVABLE_CREATE] Novo limite disponível:', newAvailableCredit)
          }
        } else {
          console.log('[RECEIVABLE_CREATE] ⚠️ Receivable sem cliente/funcionário, limite não foi descontado')
        }
      } else {
        console.log('[RECEIVABLE_CREATE] ⚠️ Receivable já está PAID, limite não foi descontado')
      }

      return receivable;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta a receber:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta a receber" },
      { status: 500 }
    );
  }
}