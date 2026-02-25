
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET - Lista todos os funcionários
export async function GET(req: NextRequest) {
  try {
    console.log('[HR_EMPLOYEES_API] ============================================');
    console.log('[HR_EMPLOYEES_API] Iniciando busca de funcionários...');
    console.log('[HR_EMPLOYEES_API] URL:', req.url);
    console.log('[HR_EMPLOYEES_API] Method:', req.method);
    console.log('[HR_EMPLOYEES_API] Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    console.log('[HR_EMPLOYEES_API] PASSO 1: Verificando sessão...');
    const session = await getServerSession(authOptions);
    console.log('[HR_EMPLOYEES_API] Session existe?', !!session);
    console.log('[HR_EMPLOYEES_API] Session.user:', session?.user ? 'existe' : 'null');
    console.log('[HR_EMPLOYEES_API] userType:', (session?.user as any)?.userType);
    console.log('[HR_EMPLOYEES_API] Full session:', JSON.stringify(session, null, 2));
    
    const userType = (session?.user as any)?.userType;
    // Permitir ADMIN ou EMPLOYEE (encarregados podem buscar subordinados)
    if (!session || (userType !== 'ADMIN' && userType !== 'EMPLOYEE')) {
      console.log('[HR_EMPLOYEES_API] ❌ Acesso negado - sessão inválida');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }
    
    console.log('[HR_EMPLOYEES_API] ✅ PASSO 1: Sessão OK');

    console.log('[HR_EMPLOYEES_API] PASSO 2: Parseando filtros...');
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const departmentId = searchParams.get('departmentId');
    const supervisorId = searchParams.get('supervisorId');
    console.log('[HR_EMPLOYEES_API] Filtros:', JSON.stringify({ status, departmentId, supervisorId }));

    const where: any = {};
    
    if (status) {
      where.status = status;
      console.log('[HR_EMPLOYEES_API] Filtro status aplicado:', status);
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
      console.log('[HR_EMPLOYEES_API] Filtro departmentId aplicado:', departmentId);
    }
    
    // Filtro por supervisorId - busca subordinados de um encarregado
    if (supervisorId) {
      where.supervisorId = supervisorId;
      console.log('[HR_EMPLOYEES_API] Filtro supervisorId aplicado:', supervisorId);
    }
    
    console.log('[HR_EMPLOYEES_API] ✅ PASSO 2: Filtros OK');
    console.log('[HR_EMPLOYEES_API] Where final:', JSON.stringify(where));

    console.log('[HR_EMPLOYEES_API] PASSO 3: Verificando conexão Prisma...');
    console.log('[HR_EMPLOYEES_API] Prisma client existe?', !!prisma);
    console.log('[HR_EMPLOYEES_API] Prisma.employee existe?', !!prisma?.employee);
    
    console.log('[HR_EMPLOYEES_API] PASSO 4: Executando query Prisma...');
    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: true,
        supervisor: {
          select: {
            id: true,
            name: true,
            employeeNumber: true
          }
        },
        supervisees: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        orders: {
          where: {
            paymentStatus: 'UNPAID'
          },
          select: {
            id: true,
            total: true,
            paymentStatus: true
          }
        },
        receivables: {
          where: {
            OR: [
              { status: 'PENDING' },
              { status: 'OVERDUE' }
            ]
          },
          select: {
            id: true,
            amount: true,
            status: true,
            orderId: true  // 🔥 Incluir orderId para evitar duplicação no cálculo de crédito
          }
        },
        _count: {
          select: {
            timeRecords: true,
            documents: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { name: 'asc' },
      ],
    });
    
    console.log('[HR_EMPLOYEES_API] ✅ PASSO 4: Query executada com sucesso');
    console.log('[HR_EMPLOYEES_API] Funcionários encontrados:', employees.length);
    console.log('[HR_EMPLOYEES_API] Primeiro funcionário:', employees[0] ? JSON.stringify(employees[0], null, 2) : 'nenhum');
    console.log('[HR_EMPLOYEES_API] ============================================');
    
    return NextResponse.json(employees);
  } catch (error: any) {
    console.error('[HR_EMPLOYEES_API] ❌❌❌ ERRO CAPTURADO ❌❌❌');
    console.error('[HR_EMPLOYEES_API] Tipo de erro:', typeof error);
    console.error('[HR_EMPLOYEES_API] Erro é objeto?', error instanceof Error);
    console.error('[HR_EMPLOYEES_API] Error.name:', error?.name);
    console.error('[HR_EMPLOYEES_API] Error.message:', error?.message);
    console.error('[HR_EMPLOYEES_API] Error.code:', (error as any)?.code);
    console.error('[HR_EMPLOYEES_API] Error.meta:', JSON.stringify((error as any)?.meta));
    console.error('[HR_EMPLOYEES_API] Stack completo:', error?.stack);
    console.error('[HR_EMPLOYEES_API] Erro completo:', JSON.stringify(error, null, 2));
    console.error('[HR_EMPLOYEES_API] ============================================');
    
    return NextResponse.json(
      { 
        error: 'Erro ao buscar funcionários',
        details: error?.message || 'Erro desconhecido',
        code: (error as any)?.code,
        meta: (error as any)?.meta
      },
      { status: 500 }
    );
  }
}

// POST - Cria novo funcionário
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      employeeNumber,
      name,
      cpf,
      position,
      salary,
      admissionDate,
      birthDate,
      departmentId,
      departmentName,
      email,
      phone,
      address,
      notes,
      receivesAdvance = false,
      foodVoucherAmount = 0,
      creditLimit = 0,
      password,
      sellerId,
      isSupervisor = false,
      isManager = false,
      isCEO = false,
      supervisorId,
      managerId,
      isDeliveryPerson = false,
    } = body;

    console.log('[CREATE_EMPLOYEE] Dados recebidos:', { 
      employeeNumber, name, cpf, hasPassword: !!password, receivesAdvance 
    });

    // Validações básicas
    if (!employeeNumber || !name || !cpf || !position || !admissionDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: employeeNumber, name, cpf, position, admissionDate' },
        { status: 400 }
      );
    }

    // Verifica se já existe funcionário com mesmo CPF
    const existingByCpf = await prisma.employee.findUnique({
      where: { cpf },
    });

    if (existingByCpf) {
      return NextResponse.json(
        { error: 'Já existe um funcionário cadastrado com este CPF' },
        { status: 400 }
      );
    }

    // Verifica se já existe funcionário com mesmo número
    const existingByNumber = await prisma.employee.findUnique({
      where: { employeeNumber: parseInt(employeeNumber) },
    });

    if (existingByNumber) {
      return NextResponse.json(
        { error: 'Já existe um funcionário cadastrado com este número' },
        { status: 400 }
      );
    }

    // Prepara dados da criação
    const employeeData: any = {
      employeeNumber: parseInt(employeeNumber),
      name,
      cpf,
      position,
      salary: salary ? parseFloat(salary) : null,
      admissionDate: new Date(admissionDate),
      birthDate: birthDate ? new Date(birthDate) : null,
      departmentId: departmentId || null,
      departmentName: departmentName || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      notes: notes || null,
      receivesAdvance: Boolean(receivesAdvance),
      foodVoucherAmount: foodVoucherAmount ? parseFloat(String(foodVoucherAmount).replace(',', '.')) : 0,
      // Converte vírgula para ponto para aceitar formato brasileiro
      creditLimit: creditLimit ? parseFloat(String(creditLimit).replace(',', '.')) : 0,
      isSupervisor: Boolean(isSupervisor),
      isManager: Boolean(isManager),
      isCEO: Boolean(isCEO),
      supervisorId: supervisorId && supervisorId !== '' ? supervisorId : null,
      managerId: managerId && managerId !== '' ? managerId : null,
      isDeliveryPerson: Boolean(isDeliveryPerson),
    };
    
    // Vincula ao vendedor se fornecido e válido
    if (sellerId && sellerId !== 'no-seller' && sellerId !== '') {
      console.log('[CREATE_EMPLOYEE] Verificando vendedor:', sellerId);
      const sellerExists = await prisma.seller.findUnique({
        where: { id: sellerId }
      });
      
      if (sellerExists) {
        console.log('[CREATE_EMPLOYEE] ✅ Vendedor encontrado, vinculando:', sellerExists.name);
        employeeData.sellerId = sellerId;
      } else {
        console.log('[CREATE_EMPLOYEE] ⚠️ Vendedor não encontrado, criando sem vínculo');
      }
    } else {
      console.log('[CREATE_EMPLOYEE] Nenhum vendedor selecionado');
    }

    // Se senha foi fornecida, faz hash
    if (password && password.trim().length > 0) {
      console.log('[CREATE_EMPLOYEE] Hasheando senha...');
      const hashedPassword = await bcrypt.hash(password, 10);
      employeeData.password = hashedPassword;
      console.log('[CREATE_EMPLOYEE] ✅ Senha hasheada');
    }

    const employee = await prisma.employee.create({
      data: employeeData,
      include: {
        department: true,
      },
    });

    console.log('[CREATE_EMPLOYEE] ✅ Funcionário criado:', employee.id);

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro ao criar funcionário', details: error.message },
      { status: 500 }
    );
  }
}
