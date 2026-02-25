export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET - Busca funcionário específico
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        timeRecords: {
          orderBy: { dateTime: 'desc' },
          take: 100, // Últimos 100 registros
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            timeRecords: true,
            documents: true,
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

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Erro ao buscar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar funcionário' },
      { status: 500 }
    );
  }
}

// PUT - Atualiza funcionário
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('========================================');
    console.log('[UPDATE_EMPLOYEE] INÍCIO DA ATUALIZAÇÃO');
    console.log('[UPDATE_EMPLOYEE] ID do funcionário:', params.id);
    
    const session = await getServerSession(authOptions);
    console.log('[UPDATE_EMPLOYEE] Session existe?', !!session);
    console.log('[UPDATE_EMPLOYEE] userType:', (session?.user as any)?.userType);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      console.log('[UPDATE_EMPLOYEE] ❌ Acesso negado');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    console.log('[UPDATE_EMPLOYEE] Body recebido:', JSON.stringify(body, null, 2));
    
    // Verifica se funcionário existe
    console.log('[UPDATE_EMPLOYEE] Verificando se funcionário existe...');
    const existing = await prisma.employee.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      console.log('[UPDATE_EMPLOYEE] ❌ Funcionário não encontrado');
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }
    console.log('[UPDATE_EMPLOYEE] ✅ Funcionário encontrado:', existing.name);

    // Se estiver mudando o CPF, verifica se já existe outro funcionário com esse CPF
    if (body.cpf && body.cpf !== existing.cpf) {
      console.log('[UPDATE_EMPLOYEE] Verificando CPF duplicado...');
      const existingByCpf = await prisma.employee.findUnique({
        where: { cpf: body.cpf },
      });

      if (existingByCpf) {
        console.log('[UPDATE_EMPLOYEE] ❌ CPF já cadastrado');
        return NextResponse.json(
          { error: 'Já existe outro funcionário cadastrado com este CPF' },
          { status: 400 }
        );
      }
      console.log('[UPDATE_EMPLOYEE] ✅ CPF disponível');
    }

    // Prepara dados de atualização
    const updateData: any = {};
    
    console.log('[UPDATE_EMPLOYEE] Preparando dados de atualização...');
    
    // Campos básicos
    if (body.name !== undefined) {
      console.log('[UPDATE_EMPLOYEE] name:', body.name);
      updateData.name = body.name;
    }
    if (body.cpf !== undefined) {
      console.log('[UPDATE_EMPLOYEE] cpf:', body.cpf);
      updateData.cpf = body.cpf;
    }
    if (body.position !== undefined) {
      console.log('[UPDATE_EMPLOYEE] position:', body.position);
      updateData.position = body.position;
    }
    if (body.salary !== undefined) {
      console.log('[UPDATE_EMPLOYEE] salary (original):', body.salary, 'tipo:', typeof body.salary);
      const salaryValue = body.salary && body.salary !== '' ? parseFloat(body.salary) : null;
      console.log('[UPDATE_EMPLOYEE] salary (convertido):', salaryValue);
      updateData.salary = salaryValue;
    }
    if (body.admissionDate !== undefined) {
      console.log('[UPDATE_EMPLOYEE] admissionDate:', body.admissionDate);
      updateData.admissionDate = new Date(body.admissionDate);
    }
    if (body.terminationDate !== undefined) {
      console.log('[UPDATE_EMPLOYEE] terminationDate:', body.terminationDate);
      updateData.terminationDate = body.terminationDate ? new Date(body.terminationDate) : null;
    }
    if (body.birthDate !== undefined) {
      console.log('[UPDATE_EMPLOYEE] birthDate:', body.birthDate);
      updateData.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    }
    
    // Campo departmentName (texto livre)
    if (body.departmentName !== undefined) {
      console.log('[UPDATE_EMPLOYEE] departmentName:', body.departmentName);
      updateData.departmentName = body.departmentName || null;
    }
    
    // CORREÇÃO: Se departmentId for "Nenhum", null, vazio ou inválido, define como null
    if (body.departmentId !== undefined) {
      console.log('[UPDATE_EMPLOYEE] departmentId (original):', body.departmentId, 'tipo:', typeof body.departmentId);
      
      if (!body.departmentId || body.departmentId === 'Nenhum' || body.departmentId === '') {
        console.log('[UPDATE_EMPLOYEE] departmentId definido como null (vazio ou Nenhum)');
        updateData.departmentId = null;
      } else if (typeof body.departmentId === 'string' && body.departmentId.trim() === '') {
        console.log('[UPDATE_EMPLOYEE] departmentId definido como null (string vazia)');
        updateData.departmentId = null;
      } else {
        // Verifica se o departamento existe no banco de dados
        console.log('[UPDATE_EMPLOYEE] Verificando se departamento existe:', body.departmentId);
        const departmentExists = await prisma.department.findUnique({
          where: { id: body.departmentId }
        });
        
        if (departmentExists) {
          console.log('[UPDATE_EMPLOYEE] ✅ Departamento encontrado:', departmentExists.name);
          updateData.departmentId = body.departmentId;
        } else {
          console.log('[UPDATE_EMPLOYEE] ⚠️ Departamento não encontrado, definindo como null');
          updateData.departmentId = null;
        }
      }
    }
    
    if (body.status !== undefined) {
      console.log('[UPDATE_EMPLOYEE] status:', body.status);
      updateData.status = body.status;
    }
    if (body.email !== undefined) {
      console.log('[UPDATE_EMPLOYEE] email:', body.email);
      updateData.email = body.email;
    }
    if (body.phone !== undefined) {
      console.log('[UPDATE_EMPLOYEE] phone:', body.phone);
      updateData.phone = body.phone;
    }
    if (body.address !== undefined) {
      console.log('[UPDATE_EMPLOYEE] address:', body.address);
      updateData.address = body.address;
    }
    if (body.notes !== undefined) {
      console.log('[UPDATE_EMPLOYEE] notes:', body.notes);
      updateData.notes = body.notes;
    }
    if (body.receivesAdvance !== undefined) {
      console.log('[UPDATE_EMPLOYEE] receivesAdvance:', body.receivesAdvance);
      updateData.receivesAdvance = Boolean(body.receivesAdvance);
    }
    if (body.foodVoucherAmount !== undefined) {
      console.log('[UPDATE_EMPLOYEE] foodVoucherAmount (original):', body.foodVoucherAmount);
      const foodVoucherValue = body.foodVoucherAmount && body.foodVoucherAmount !== '' ? parseFloat(body.foodVoucherAmount) : 0;
      console.log('[UPDATE_EMPLOYEE] foodVoucherAmount (convertido):', foodVoucherValue);
      updateData.foodVoucherAmount = foodVoucherValue;
    }
    if (body.creditLimit !== undefined) {
      console.log('[UPDATE_EMPLOYEE] creditLimit (original):', body.creditLimit);
      // Converte vírgula para ponto para aceitar formato brasileiro
      const creditLimitStr = String(body.creditLimit).replace(',', '.');
      const creditLimitValue = creditLimitStr && creditLimitStr !== '' ? parseFloat(creditLimitStr) : 0;
      console.log('[UPDATE_EMPLOYEE] creditLimit (convertido):', creditLimitValue);
      updateData.creditLimit = isNaN(creditLimitValue) ? 0 : creditLimitValue;
    }
    
    // Atualiza isDeliveryPerson (marca se funcionário é entregador)
    if (body.isDeliveryPerson !== undefined) {
      console.log('[UPDATE_EMPLOYEE] isDeliveryPerson:', body.isDeliveryPerson);
      updateData.isDeliveryPerson = Boolean(body.isDeliveryPerson);
    }
    
    // Atualiza isSupervisor (marca se funcionário é encarregado)
    if (body.isSupervisor !== undefined) {
      console.log('[UPDATE_EMPLOYEE] isSupervisor:', body.isSupervisor);
      updateData.isSupervisor = Boolean(body.isSupervisor);
    }
    
    // Atualiza supervisorId (encarregado do funcionário)
    if (body.supervisorId !== undefined) {
      console.log('[UPDATE_EMPLOYEE] supervisorId (original):', body.supervisorId);
      if (!body.supervisorId || body.supervisorId === '') {
        updateData.supervisorId = null;
      } else {
        // Verifica se o supervisor existe e é encarregado
        const supervisorExists = await prisma.employee.findUnique({
          where: { id: body.supervisorId }
        });
        if (supervisorExists) {
          console.log('[UPDATE_EMPLOYEE] ✅ Supervisor encontrado:', supervisorExists.name);
          updateData.supervisorId = body.supervisorId;
        } else {
          console.log('[UPDATE_EMPLOYEE] ⚠️ Supervisor não encontrado, definindo como null');
          updateData.supervisorId = null;
        }
      }
    }
    
    // Atualiza isManager (marca se funcionário é gerente)
    if (body.isManager !== undefined) {
      console.log('[UPDATE_EMPLOYEE] isManager:', body.isManager);
      updateData.isManager = Boolean(body.isManager);
    }
    
    // Atualiza isCEO (marca se funcionário é CEO)
    if (body.isCEO !== undefined) {
      console.log('[UPDATE_EMPLOYEE] isCEO:', body.isCEO);
      updateData.isCEO = Boolean(body.isCEO);
    }
    
    // Atualiza managerId (gerente do funcionário)
    if (body.managerId !== undefined) {
      console.log('[UPDATE_EMPLOYEE] managerId (original):', body.managerId);
      if (!body.managerId || body.managerId === '') {
        updateData.managerId = null;
      } else {
        // Verifica se o gerente existe
        const managerExists = await prisma.employee.findUnique({
          where: { id: body.managerId }
        });
        if (managerExists) {
          console.log('[UPDATE_EMPLOYEE] ✅ Gerente encontrado:', managerExists.name);
          updateData.managerId = body.managerId;
        } else {
          console.log('[UPDATE_EMPLOYEE] ⚠️ Gerente não encontrado, definindo como null');
          updateData.managerId = null;
        }
      }
    }
    
    // Atualiza sellerId (vendedor vinculado)
    if (body.sellerId !== undefined) {
      console.log('[UPDATE_EMPLOYEE] sellerId (original):', body.sellerId, 'tipo:', typeof body.sellerId);
      
      if (!body.sellerId || body.sellerId === 'no-seller' || body.sellerId === '') {
        console.log('[UPDATE_EMPLOYEE] sellerId definido como null (nenhum vendedor)');
        updateData.sellerId = null;
      } else if (typeof body.sellerId === 'string' && body.sellerId.trim() === '') {
        console.log('[UPDATE_EMPLOYEE] sellerId definido como null (string vazia)');
        updateData.sellerId = null;
      } else {
        // Verifica se o vendedor existe no banco de dados
        console.log('[UPDATE_EMPLOYEE] Verificando se vendedor existe:', body.sellerId);
        const sellerExists = await prisma.seller.findUnique({
          where: { id: body.sellerId }
        });
        
        if (sellerExists) {
          console.log('[UPDATE_EMPLOYEE] ✅ Vendedor encontrado:', sellerExists.name);
          updateData.sellerId = body.sellerId;
        } else {
          console.log('[UPDATE_EMPLOYEE] ⚠️ Vendedor não encontrado, definindo como null');
          updateData.sellerId = null;
        }
      }
    }

    // Se senha foi fornecida, atualiza ela também
    if (body.password && typeof body.password === 'string' && body.password.trim().length > 0) {
      console.log('[UPDATE_EMPLOYEE] Senha fornecida, hasheando...');
      const hashedPassword = await bcrypt.hash(body.password, 10);
      updateData.password = hashedPassword;
      console.log('[UPDATE_EMPLOYEE] ✅ Senha hasheada e será atualizada');
    }

    console.log('[UPDATE_EMPLOYEE] Dados que serão atualizados:', Object.keys(updateData));
    console.log('[UPDATE_EMPLOYEE] updateData completo:', JSON.stringify(updateData, null, 2));

    // Atualiza funcionário
    console.log('[UPDATE_EMPLOYEE] Executando prisma.employee.update...');
    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: updateData,
      include: {
        department: true,
      },
    });

    console.log('[UPDATE_EMPLOYEE] ✅ Funcionário atualizado com sucesso:', employee.id);
    console.log('========================================');

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error('========================================');
    console.error('[UPDATE_EMPLOYEE] ❌ ERRO CAPTURADO');
    console.error('[UPDATE_EMPLOYEE] error.message:', error.message);
    console.error('[UPDATE_EMPLOYEE] error.code:', error.code);
    console.error('[UPDATE_EMPLOYEE] error.meta:', error.meta);
    console.error('[UPDATE_EMPLOYEE] error.name:', error.name);
    console.error('[UPDATE_EMPLOYEE] Stack completo:', error.stack);
    console.error('========================================');
    
    // Retorna erro COMPLETO na resposta para debug
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar funcionário',
        errorMessage: error.message,
        errorCode: error.code,
        errorMeta: error.meta,
        errorName: error.name,
        errorStack: error.stack?.split('\n').slice(0, 5).join('\n'), // Primeiras 5 linhas do stack
      },
      { status: 500 }
    );
  }
}

// DELETE - Deleta funcionário
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    // Verifica se funcionário existe
    const existing = await prisma.employee.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    await prisma.employee.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Funcionário excluído com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir funcionário:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir funcionário', details: error.message },
      { status: 500 }
    );
  }
}
