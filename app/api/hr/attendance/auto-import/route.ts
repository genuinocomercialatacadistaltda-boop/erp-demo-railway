

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';

// Configuração da rota
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST - Importa arquivo Kenup e cria funcionários automaticamente
export async function POST(req: NextRequest) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 INICIANDO AUTO-IMPORT DE PONTO');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    console.log('🔐 ETAPA 1: Verificação de Autenticação');
    console.log('-----------------------------------------------------------');
    
    // Extrai cookies do request
    const cookies = req.headers.get('cookie');
    console.log('🍪 Cookies recebidos:', cookies ? 'SIM' : 'NÃO');
    
    if (!cookies) {
      console.error('❌ ERRO: Nenhum cookie recebido na requisição');
      console.log('   Isso indica que o navegador não está enviando cookies');
      console.log('   Possíveis causas: sessão expirada, configuração CORS, SameSite');
      return NextResponse.json(
        { 
          error: 'Sessão não encontrada. Por favor, faça login novamente.',
          details: 'No cookies in request'
        },
        { status: 401 }
      );
    }
    
    const session = await getServerSession(authOptions);
    
    console.log('📋 Resultado da verificação de sessão:');
    console.log('   - Session exists:', !!session);
    console.log('   - User:', session?.user?.email || 'N/A');
    console.log('   - UserType:', (session?.user as any)?.userType || 'N/A');
    
    if (!session || !session.user) {
      console.error('❌ ERRO: Sessão inválida ou expirada');
      console.log('   Session object:', JSON.stringify(session, null, 2));
      return NextResponse.json(
        { 
          error: 'Sessão expirada. Por favor, faça login novamente.',
          details: 'Invalid or expired session'
        },
        { status: 401 }
      );
    }
    
    const userType = (session.user as any)?.userType;
    if (userType !== 'ADMIN') {
      console.error('❌ ERRO: Usuário não é administrador');
      console.log(`   UserType recebido: "${userType}" (esperado: "ADMIN")`);
      return NextResponse.json(
        { 
          error: 'Apenas administradores podem importar registros de ponto.',
          details: `User type is ${userType}, expected ADMIN`
        },
        { status: 403 }
      );
    }
    
    console.log('✅ Autenticação bem-sucedida!');
    console.log(`   Usuário: ${session.user.email}`);
    console.log(`   Tipo: ${userType}`);

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

    console.log('📄 Primeiras 500 caracteres do arquivo:', fileContent.substring(0, 500));
    console.log('📄 Códigos ASCII dos primeiros 200 caracteres:', 
      fileContent.substring(0, 200).split('').map((c, i) => `${i}:${c}[${c.charCodeAt(0)}]`).join(' ')
    );

    // Detecta o delimitador automaticamente
    const firstLine = fileContent.split('\n')[0].trim();
    console.log('📋 Primeira linha (length=' + firstLine.length + '):', firstLine);
    console.log('📋 Caracteres da primeira linha:', 
      firstLine.split('').map((c, i) => `${i}:${c}[${c.charCodeAt(0)}]`).slice(0, 50).join(' ')
    );
    
    // Contadores de possíveis delimitadores
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    
    console.log('🔍 Contagem de delimitadores na primeira linha:');
    console.log('  - Vírgulas (,):', commaCount);
    console.log('  - Ponto e vírgula (;):', semicolonCount);
    console.log('  - Tabs (\\t):', tabCount);
    console.log('  - Pipes (|):', pipeCount);
    
    let delimiter = ';';
    
    // Escolhe o delimitador com maior contagem
    const counts = [
      { char: ',', count: commaCount },
      { char: ';', count: semicolonCount },
      { char: '\t', count: tabCount },
      { char: '|', count: pipeCount }
    ];
    
    const maxCount = Math.max(...counts.map(c => c.count));
    if (maxCount > 0) {
      const detected = counts.find(c => c.count === maxCount);
      if (detected) {
        delimiter = detected.char;
        console.log('🔍 Delimitador detectado:', detected.char === '\t' ? '\\t (tab)' : detected.char, '(', maxCount, 'ocorrências)');
      }
    } else {
      console.log('⚠️ NENHUM delimitador comum encontrado! Usando ; como padrão');
    }

    console.log('📋 Primeira linha do arquivo:', firstLine);

    // Parse do CSV com delimitador detectado
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: delimiter,
      relax_column_count: true, // Permite linhas com número variável de colunas
    }) as Array<Record<string, string>>;

    const debugInfo = {
      delimiter: delimiter,
      totalRecords: records.length,
      availableColumns: records[0] ? Object.keys(records[0]) : [],
      firstRecord: records[0] || null,
      secondRecord: records[1] || null,
      filePreview: fileContent.substring(0, 300),
    };

    console.log('📋 Total de registros no arquivo:', records.length);
    console.log('📋 Primeiros 3 registros:', JSON.stringify(records.slice(0, 3), null, 2));
    console.log('📋 Colunas disponíveis:', records[0] ? Object.keys(records[0]) : 'Nenhuma');
    console.log('📋 Número de colunas detectadas:', debugInfo.availableColumns.length);

    // ETAPA 1: Extrair funcionários únicos do arquivo
    const uniqueEmployees = new Map<number, { name: string; department: string }>();
    
    for (const record of records) {
      const employeeNumber = parseInt(record['Tra. No.'] || record['Tra No'] || record['employeeNumber'] || '0');
      const name = record['Nome'] || record['Name'] || record['name'] || '';
      const department = record['Depto.'] || record['Department'] || record['department'] || '';

      console.log('🔍 Processando registro:', {
        employeeNumber,
        name,
        department,
        rawRecord: record
      });

      if (employeeNumber && name) {
        if (!uniqueEmployees.has(employeeNumber)) {
          uniqueEmployees.set(employeeNumber, { name, department });
          console.log('✅ Adicionado funcionário:', employeeNumber, name);
        }
      } else {
        console.log('❌ Registro ignorado - campos faltando:', {
          employeeNumber,
          name,
          department
        });
      }
    }

    console.log('👥 Funcionários únicos encontrados:', uniqueEmployees.size);
    console.log('👥 Lista de funcionários:', Array.from(uniqueEmployees.entries()));

    // ETAPA 2: Criar departamentos únicos
    const departments = new Map<string, string>();
    const departmentNames = [...new Set(Array.from(uniqueEmployees.values()).map(e => e.department).filter(d => d))];
    
    for (const deptName of departmentNames) {
      if (!deptName) continue;
      
      let dept = await prisma.department.findUnique({
        where: { name: deptName },
      });

      if (!dept) {
        dept = await prisma.department.create({
          data: {
            name: deptName,
            code: deptName.substring(0, 3).toUpperCase(),
          },
        });
        console.log('✅ Departamento criado:', dept.name);
      }
      
      departments.set(deptName, dept.id);
    }

    // ETAPA 3: Criar funcionários
    const employeesCreated: number[] = [];
    const employeesExisting: number[] = [];
    
    console.log('🚀 Iniciando criação de funcionários...');
    
    for (const [employeeNumber, data] of uniqueEmployees) {
      try {
        console.log(`🔍 Verificando funcionário ${employeeNumber}...`);
        
        // Verifica se já existe
        const existing = await prisma.employee.findUnique({
          where: { employeeNumber },
        });

        if (existing) {
          employeesExisting.push(employeeNumber);
          console.log(`⚠️  Funcionário ${employeeNumber} já existe`);
          continue;
        }

        // Cria novo funcionário
        const departmentId = data.department ? departments.get(data.department) : null;
        
        console.log(`📝 Criando funcionário ${employeeNumber} com dados:`, {
          employeeNumber,
          name: data.name,
          cpf: `000.000.000-${employeeNumber.toString().padStart(2, '0')}`,
          position: 'A definir',
          departmentId
        });
        
        const createdEmployee = await prisma.employee.create({
          data: {
            employeeNumber,
            name: data.name,
            cpf: `000.000.000-${employeeNumber.toString().padStart(2, '0')}`, // CPF temporário
            position: 'A definir',
            admissionDate: new Date(),
            departmentId: departmentId || null,
          },
        });

        employeesCreated.push(employeeNumber);
        console.log(`✅ Funcionário criado: ${employeeNumber} - ${data.name} - ID: ${createdEmployee.id}`);
      } catch (error: any) {
        console.error(`❌ Erro ao criar funcionário ${employeeNumber}:`, error.message);
        console.error('Stack completo:', error);
      }
    }
    
    console.log('📊 Resumo da criação de funcionários:');
    console.log(`   - Criados: ${employeesCreated.length}`);
    console.log(`   - Existentes: ${employeesExisting.length}`);

    // ETAPA 4: Importar registros de ponto
    const importBatchId = `auto-import-${Date.now()}`;
    const importResults = {
      employeesFound: uniqueEmployees.size,
      employeesCreated: employeesCreated.length,
      employeesExisting: employeesExisting.length,
      departmentsCreated: departmentNames.length,
      totalRecords: records.length,
      imported: 0,
      duplicates: 0,
      errors: [] as any[],
    };

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 ETAPA 4: IMPORTAÇÃO DE REGISTROS DE PONTO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 Total de ${records.length} registros para processar`);
    
    // Lista todos os funcionários no banco ANTES da importação
    const allEmployees = await prisma.employee.findMany({
      select: {
        id: true,
        employeeNumber: true,
        name: true
      }
    });
    console.log('👥 Funcionários no banco ANTES da importação:', allEmployees.length);
    console.log('👥 Lista completa:', JSON.stringify(allEmployees, null, 2));

    let processedCount = 0;
    let failReasons = {
      noEmployeeNumber: 0,
      noDateTime: 0,
      employeeNotFound: 0,
      invalidDate: 0,
      duplicates: 0,
      otherErrors: 0
    };

    for (const record of records) {
      try {
        processedCount++;
        
        const employeeNumber = parseInt(record['Tra. No.'] || record['Tra No'] || record['employeeNumber'] || '0');
        const dateTimeStr = record['Tempo'] || record['datetime'] || record['dateTime'];

        if (processedCount <= 5 || processedCount % 50 === 0) {
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🔍 Processando Registro #${processedCount}/${records.length}`);
          console.log(`📊 Colunas disponíveis:`, Object.keys(record));
          console.log(`📋 Valores:`, {
            'Tra. No.': record['Tra. No.'],
            'Tempo': record['Tempo'],
            'Nome': record['Nome'],
            'employeeNumber': employeeNumber,
            'dateTimeStr': dateTimeStr
          });
        }

        if (!employeeNumber || employeeNumber === 0) {
          failReasons.noEmployeeNumber++;
          if (processedCount <= 5) {
            console.log(`❌ FALHOU: employeeNumber inválido (${employeeNumber})`);
          }
          continue;
        }

        if (!dateTimeStr) {
          failReasons.noDateTime++;
          if (processedCount <= 5) {
            console.log(`❌ FALHOU: dateTimeStr vazio`);
          }
          continue;
        }

        // ANÁLISE DETALHADA DA STRING DE DATA/HORA
        if (processedCount <= 5) {
          console.log(`\n🔬 ANÁLISE DETALHADA DO CAMPO "Tempo":`);
          console.log(`   Valor bruto: "${dateTimeStr}"`);
          console.log(`   Tipo: ${typeof dateTimeStr}`);
          console.log(`   Comprimento: ${dateTimeStr.length} caracteres`);
          console.log(`   Códigos ASCII dos caracteres:`);
          for (let i = 0; i < Math.min(dateTimeStr.length, 25); i++) {
            const char = dateTimeStr[i];
            const code = dateTimeStr.charCodeAt(i);
            console.log(`      [${i}] '${char}' → ASCII ${code} ${code === 32 ? '(ESPAÇO)' : code === 9 ? '(TAB)' : ''}`);
          }
        }

        // Busca o funcionário
        if (processedCount <= 5) {
          console.log(`\n🔎 Buscando funcionário com employeeNumber: ${employeeNumber}`);
        }
        
        const employee = await prisma.employee.findUnique({
          where: { employeeNumber },
        });

        if (!employee) {
          failReasons.employeeNotFound++;
          if (processedCount <= 5) {
            console.log(`❌ FALHOU: Funcionário ${employeeNumber} NÃO ENCONTRADO no banco`);
            console.log(`📋 Funcionários disponíveis:`, allEmployees.map(e => e.employeeNumber));
          }
          continue;
        }

        if (processedCount <= 5) {
          console.log(`✅ Funcionário encontrado: ${employee.name} (ID: ${employee.id})`);
        }

        // Converte a data/hora
        if (processedCount <= 5) {
          console.log(`📅 Convertendo data/hora: "${dateTimeStr}"`);
        }

        // Tenta múltiplos formatos de data
        let dateTime: Date | null = null;
        
        try {
          // 🔥 PARSING SIMPLIFICADO E DIRETO - Formato Kenup: "DD/MM/YYYY     HH:MM:SS"
          // Remove TODOS os espaços extras e normaliza para um único espaço
          const cleaned = dateTimeStr.trim().replace(/\s+/g, ' ');
          
          if (processedCount <= 5) {
            console.log(`   String original: "${dateTimeStr}"`);
            console.log(`   String limpa: "${cleaned}"`);
          }
          
          // Separa data e hora
          const parts = cleaned.split(' ');
          const datePart = parts[0];
          const timePart = parts[1] || '00:00:00';
          
          if (processedCount <= 5) {
            console.log(`   datePart: "${datePart}", timePart: "${timePart}"`);
          }
          
          // Valida que temos pelo menos a data
          if (!datePart || !datePart.includes('/')) {
            throw new Error(`Formato de data inválido: "${datePart}"`);
          }
          
          // Extrai componentes da data: DD/MM/YYYY
          const dateParts = datePart.split('/');
          if (dateParts.length !== 3) {
            throw new Error(`Data deve estar no formato DD/MM/YYYY: "${datePart}"`);
          }
          
          const day = parseInt(dateParts[0].trim());
          const month = parseInt(dateParts[1].trim());
          const year = parseInt(dateParts[2].trim());
          
          // Extrai componentes da hora: HH:MM:SS
          const timeParts = timePart.split(':');
          const hours = parseInt(timeParts[0]?.trim() || '0');
          const minutes = parseInt(timeParts[1]?.trim() || '0');
          const seconds = parseInt(timeParts[2]?.trim() || '0');
          
          if (processedCount <= 5) {
            console.log(`   Componentes: ${day}/${month}/${year} ${hours}:${minutes}:${seconds}`);
          }
          
          // Valida componentes
          if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) {
            throw new Error(`Componentes de data inválidos: ${day}/${month}/${year}`);
          }
          
          // 🔥 CORREÇÃO DE TIMEZONE: 
          // O arquivo Kenup vem com horário de Brasília (BRT/BRST - UTC-3)
          // Precisamos criar uma data que represente esse horário em Brasília
          // independentemente do timezone do servidor
          
          // Cria string ISO com offset de Brasília explícito: "YYYY-MM-DDTHH:MM:SS-03:00"
          const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}-03:00`;
          dateTime = new Date(isoString);
          
          // Valida se a data é válida
          if (!dateTime || isNaN(dateTime.getTime())) {
            throw new Error(`Data inválida após parsing: ${dateTime}`);
          }
          
          if (processedCount <= 5) {
            console.log(`✅ [#${processedCount}] ${record['Nome']}: "${dateTimeStr}"`);
            console.log(`   📍 Horário do arquivo (BRT): ${day}/${month}/${year} ${hours}:${minutes}:${seconds}`);
            console.log(`   📍 Salvo no banco (UTC): ${dateTime.toISOString()}`);
            console.log(`   📍 Será exibido como: ${dateTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
          }
          
        } catch (parseError: any) {
          failReasons.invalidDate++;
          if (processedCount <= 5) {
            console.log(`❌ [#${processedCount}] ERRO: "${dateTimeStr}" - ${parseError.message}`);
          }
          continue;
        }

        // Verifica duplicidade
        const existing = await prisma.timeRecord.findFirst({
          where: {
            employeeId: employee.id,
            dateTime,
          },
        });

        if (existing) {
          importResults.duplicates++;
          failReasons.duplicates++;
          if (processedCount <= 5) {
            console.log(`⚠️  Registro DUPLICADO - já existe no banco`);
          }
          continue;
        }

        if (processedCount <= 5) {
          console.log(`💾 Criando registro de ponto no banco...`);
        }

        // Cria o registro de ponto
        const timeRecord = await prisma.timeRecord.create({
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
        
        if (processedCount <= 5) {
          console.log(`✅ SUCESSO! Registro de ponto criado - ID: ${timeRecord.id}`);
        }
      } catch (error: any) {
        failReasons.otherErrors++;
        importResults.errors.push({
          record: processedCount,
          error: error.message,
        });
        if (processedCount <= 5) {
          console.log(`❌ ERRO ao processar registro:`, error.message);
          console.error('Stack:', error);
        }
        if (processedCount <= 3) {
          console.error(`❌ Erro ao processar registro ${processedCount}:`, error.message);
        }
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMO FINAL DA IMPORTAÇÃO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 Total de registros processados: ${processedCount}`);
    console.log(`✅ Registros importados com sucesso: ${importResults.imported}`);
    console.log(`⚠️  Duplicados (já existiam): ${importResults.duplicates}`);
    console.log(`❌ Total de falhas: ${processedCount - importResults.imported - importResults.duplicates}`);
    console.log('');
    console.log('📊 DETALHAMENTO DAS FALHAS:');
    console.log(`   ❌ Sem employeeNumber válido: ${failReasons.noEmployeeNumber}`);
    console.log(`   ❌ Sem data/hora: ${failReasons.noDateTime}`);
    console.log(`   ❌ Funcionário não encontrado: ${failReasons.employeeNotFound}`);
    console.log(`   ❌ Data inválida: ${failReasons.invalidDate}`);
    console.log(`   ⚠️  Duplicados: ${failReasons.duplicates}`);
    console.log(`   ❌ Outros erros: ${failReasons.otherErrors}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (importResults.errors.length > 0) {
      console.log('🔍 Primeiros 10 erros detalhados:');
      importResults.errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. Registro #${err.record}: ${err.error}`);
      });
    }

    console.log('✅ Importação automática concluída');
    console.log(`📊 RESUMO: ${importResults.imported} de ${records.length} registros importados`);
    console.log(`📊 Falhas: ${failReasons.invalidDate} datas inválidas, ${failReasons.employeeNotFound} funcionários não encontrados`);

    return NextResponse.json({
      success: true,
      message: `✅ Cadastro automático concluído! ${employeesCreated.length} funcionários criados, ${importResults.imported} registros de ponto importados`,
      ...importResults,
      failureDetails: failReasons,
    });
  } catch (error: any) {
    console.error('❌ Erro na importação automática:', error);
    return NextResponse.json(
      { error: 'Erro na importação automática', details: error.message },
      { status: 500 }
    );
  }
}
