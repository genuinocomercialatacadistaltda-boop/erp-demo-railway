
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';

// POST - Importa registros de ponto do arquivo Kenup
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo foi enviado' },
        { status: 400 }
      );
    }

    // Lê o conteúdo do arquivo
    const fileContent = await file.text();

    // Parse do CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: ';', // Formato típico do Kenup usa ponto e vírgula
    }) as Array<Record<string, string>>;

    console.log('📋 Registros encontrados no arquivo:', records.length);
    console.log('📄 Primeira linha:', records[0]);

    // Gera ID único para este lote de importação
    const importBatchId = `import-${Date.now()}`;

    const importResults = {
      total: records.length,
      imported: 0,
      errors: [] as any[],
      employeesNotFound: [] as string[],
    };

    // Processa cada registro
    for (const record of records) {
      try {
        // Identificação dos campos do Kenup
        // Formato esperado: Tra. No.; Nome; A/C No.; Depto.; Tempo
        const employeeNumber = parseInt(record['Tra. No.'] || record['Tra No'] || record['employeeNumber'] || '0');
        const dateTimeStr = record['Tempo'] || record['datetime'] || record['dateTime'];

        if (!employeeNumber || !dateTimeStr) {
          importResults.errors.push({
            record,
            error: 'Número do funcionário ou data/hora inválidos',
          });
          continue;
        }

        // Busca o funcionário pelo número
        const employee = await prisma.employee.findUnique({
          where: { employeeNumber },
        });

        if (!employee) {
          if (!importResults.employeesNotFound.includes(employeeNumber.toString())) {
            importResults.employeesNotFound.push(employeeNumber.toString());
          }
          importResults.errors.push({
            record,
            error: `Funcionário ${employeeNumber} não encontrado no sistema`,
          });
          continue;
        }

        // Converte a data/hora para formato ISO
        // Formato esperado: "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY HH:MM"
        const [datePart, timePart] = dateTimeStr.split(' ');
        const [day, month, year] = datePart.split('/');
        const [hours, minutes, seconds = '00'] = timePart.split(':');
        
        // 🔧 Cria Date com timezone de Brasília explícito (-03:00)
        const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}-03:00`;
        const dateTime = new Date(isoString);

        if (isNaN(dateTime.getTime())) {
          importResults.errors.push({
            record,
            error: `Data/hora inválida: ${dateTimeStr}`,
          });
          continue;
        }

        // Verifica se já existe um registro idêntico
        const existing = await prisma.timeRecord.findFirst({
          where: {
            employeeId: employee.id,
            dateTime,
          },
        });

        if (existing) {
          console.log(`⚠️  Registro duplicado ignorado: ${employee.name} - ${dateTime.toISOString()}`);
          continue;
        }

        // Cria o registro de ponto
        await prisma.timeRecord.create({
          data: {
            employeeId: employee.id,
            employeeNumber,
            dateTime,
            machineNumber: parseInt(record['A/C No.'] || record['machine'] || '0') || null,
            isManual: false,
            importBatchId,
          },
        });

        importResults.imported++;
      } catch (error: any) {
        console.error('Erro ao processar registro:', error);
        importResults.errors.push({
          record,
          error: error.message,
        });
      }
    }

    console.log('✅ Importação concluída:', importResults);

    return NextResponse.json({
      success: true,
      message: `Importação concluída: ${importResults.imported} de ${importResults.total} registros importados`,
      ...importResults,
    });
  } catch (error: any) {
    console.error('Erro ao importar registros de ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao importar registros de ponto', details: error.message },
      { status: 500 }
    );
  }
}
