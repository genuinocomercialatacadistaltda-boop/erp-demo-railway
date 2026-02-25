export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * DELETE /api/hr/attendance/bulk-delete
 * 
 * Exclui registros de ponto em lote por:
 * - Data específica ou período (startDate + endDate)
 * - Lote de importação (importBatchId)
 * - Funcionário específico (employeeId)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      startDate, 
      endDate, 
      employeeId, 
      importBatchId,
      specificDate 
    } = body;

    console.log('🗑️  EXCLUSÃO EM LOTE - Parâmetros:', {
      startDate,
      endDate,
      employeeId,
      importBatchId,
      specificDate
    });

    // Validação: pelo menos um critério deve ser fornecido
    if (!startDate && !importBatchId && !specificDate) {
      return NextResponse.json(
        { error: 'É necessário fornecer ao menos um critério de exclusão (data, período ou lote de importação)' },
        { status: 400 }
      );
    }

    // Monta a query de exclusão
    const where: any = {};

    if (importBatchId) {
      where.importBatchId = importBatchId;
      console.log('🔍 Filtrando por lote:', importBatchId);
    }

    if (employeeId) {
      where.employeeId = employeeId;
      console.log('🔍 Filtrando por funcionário:', employeeId);
    }

    if (specificDate) {
      // Data específica (início e fim do dia)
      const date = new Date(specificDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.dateTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
      console.log('🔍 Filtrando por data específica:', specificDate);
    } else if (startDate && endDate) {
      // Período
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
      console.log('🔍 Filtrando por período:', startDate, 'até', endDate);
    } else if (startDate) {
      // Apenas data inicial (até o fim do dia)
      where.dateTime = {
        gte: new Date(startDate),
      };
      console.log('🔍 Filtrando a partir de:', startDate);
    }

    // Conta quantos registros serão excluídos
    const count = await prisma.timeRecord.count({ where });
    console.log('📊 Total de registros a serem excluídos:', count);

    if (count === 0) {
      return NextResponse.json(
        { message: 'Nenhum registro encontrado com os critérios fornecidos', deleted: 0 },
        { status: 200 }
      );
    }

    // Exclui os registros
    const result = await prisma.timeRecord.deleteMany({ where });

    console.log('✅ Registros excluídos com sucesso:', result.count);

    return NextResponse.json({
      message: `${result.count} registro(s) excluído(s) com sucesso`,
      deleted: result.count,
    });
  } catch (error: any) {
    console.error('❌ Erro ao excluir registros:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir registros', details: error.message },
      { status: 500 }
    );
  }
}
