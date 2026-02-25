export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Obter data atual em Brasília (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60; // -3 horas em minutos
    const brasiliaTime = new Date(now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000);
    
    const currentDay = brasiliaTime.getDate();
    const currentMonth = brasiliaTime.getMonth() + 1; // getMonth() retorna 0-11

    console.log('🎂 Verificando aniversários:', { 
      currentDay, 
      currentMonth,
      brasiliaTime: brasiliaTime.toISOString()
    });

    // Buscar todos os clientes com data de nascimento
    const allCustomers = await prisma.customer.findMany({
      where: {
        birthDate: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        city: true,
        birthDate: true,
        Seller: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`📋 Total de clientes com data de nascimento: ${allCustomers.length}`);

    // Filtrar clientes que fazem aniversário hoje
    const birthdayCustomers = allCustomers.filter((customer: any) => {
      if (!customer.birthDate) return false;
      
      const birthDate = new Date(customer.birthDate);
      const birthDay = birthDate.getDate();
      const birthMonth = birthDate.getMonth() + 1;

      const isBirthday = birthDay === currentDay && birthMonth === currentMonth;
      
      if (isBirthday) {
        console.log('🎉 Cliente aniversariante encontrado:', {
          nome: customer.name,
          dataNascimento: birthDate.toISOString(),
          dia: birthDay,
          mes: birthMonth
        });
      }

      return isBirthday;
    });

    // Calcular idade para cada cliente aniversariante
    const customerBirthdaysWithAge = birthdayCustomers.map((customer: any) => {
      const birthDate = new Date(customer.birthDate!);
      const age = brasiliaTime.getFullYear() - birthDate.getFullYear();
      
      return {
        ...customer,
        type: 'customer',
        age,
        birthDateFormatted: birthDate.toLocaleDateString('pt-BR')
      };
    });

    // ========== FUNCIONÁRIOS ==========
    // Buscar todos os funcionários com data de nascimento
    const allEmployees = await prisma.employee.findMany({
      where: {
        birthDate: {
          not: null
        },
        isActive: true,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        birthDate: true,
        position: true,
        employeeNumber: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`📋 Total de funcionários com data de nascimento: ${allEmployees.length}`);

    // Filtrar funcionários que fazem aniversário hoje
    const birthdayEmployees = allEmployees.filter((employee: any) => {
      if (!employee.birthDate) return false;
      
      const birthDate = new Date(employee.birthDate);
      const birthDay = birthDate.getDate();
      const birthMonth = birthDate.getMonth() + 1;

      const isBirthday = birthDay === currentDay && birthMonth === currentMonth;
      
      if (isBirthday) {
        console.log('🎉 Funcionário aniversariante encontrado:', {
          nome: employee.name,
          cargo: employee.position,
          dataNascimento: birthDate.toISOString(),
          dia: birthDay,
          mes: birthMonth
        });
      }

      return isBirthday;
    });

    // Calcular idade para cada funcionário aniversariante
    const employeeBirthdaysWithAge = birthdayEmployees.map((employee: any) => {
      const birthDate = new Date(employee.birthDate!);
      const age = brasiliaTime.getFullYear() - birthDate.getFullYear();
      
      return {
        ...employee,
        type: 'employee',
        age,
        birthDateFormatted: birthDate.toLocaleDateString('pt-BR')
      };
    });

    console.log(`🎂 Total de clientes aniversariantes hoje: ${customerBirthdaysWithAge.length}`);
    console.log(`🎂 Total de funcionários aniversariantes hoje: ${employeeBirthdaysWithAge.length}`);

    return NextResponse.json({
      count: customerBirthdaysWithAge.length,
      birthdays: customerBirthdaysWithAge,
      employeeCount: employeeBirthdaysWithAge.length,
      employeeBirthdays: employeeBirthdaysWithAge,
      totalCount: customerBirthdaysWithAge.length + employeeBirthdaysWithAge.length,
      currentDate: {
        day: currentDay,
        month: currentMonth,
        year: brasiliaTime.getFullYear(),
        formatted: brasiliaTime.toLocaleDateString('pt-BR')
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar aniversários:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar aniversários' },
      { status: 500 }
    );
  }
}
