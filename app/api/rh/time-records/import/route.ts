
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

// POST - Importar registros de ponto do arquivo Kenup
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    // Ler o conteúdo do arquivo
    const text = await file.text();
    const lines = text.split("\n").filter(line => line.trim());

    console.log("📄 Processando arquivo Kenup:", {
      fileName: file.name,
      totalLines: lines.length
    });

    // Gerar ID único para este lote de importação
    const importBatchId = uuidv4();

    // Arrays para armazenar registros válidos e erros
    const validRecords: any[] = [];
    const errors: any[] = [];
    const employeeNumbers = new Set<number>();

    // Pular cabeçalho (primeira linha)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Extrair dados da linha (formato: Tra.No. Nome dept. Data Hora MáquinaNo.)
        // Exemplo: "20        eliete          Not Set1  01/11/2025 07:34:53  1"
        const parts = line.split(/\s+/);
        
        if (parts.length < 5) {
          errors.push({
            line: i + 1,
            content: line,
            error: "Formato inválido - menos de 5 campos"
          });
          continue;
        }

        const employeeNumber = parseInt(parts[0]);
        const name = parts[1];
        
        // Encontrar onde começa a data (procura por padrão DD/MM/YYYY)
        let dateIndex = -1;
        for (let j = 2; j < parts.length; j++) {
          if (parts[j].includes("/")) {
            dateIndex = j;
            break;
          }
        }

        if (dateIndex === -1) {
          errors.push({
            line: i + 1,
            content: line,
            error: "Data não encontrada"
          });
          continue;
        }

        const dateStr = parts[dateIndex]; // DD/MM/YYYY
        const timeStr = parts[dateIndex + 1]; // HH:MM:SS
        const machineNumber = parts[dateIndex + 2] ? parseInt(parts[dateIndex + 2]) : 1;

        // Converter data DD/MM/YYYY HH:MM:SS para ISO
        const [day, month, year] = dateStr.split("/").map(Number);
        const [hour, minute, second] = timeStr.split(":").map(Number);
        
        const dateTime = new Date(year, month - 1, day, hour, minute, second);

        if (isNaN(dateTime.getTime())) {
          errors.push({
            line: i + 1,
            content: line,
            error: "Data/hora inválida"
          });
          continue;
        }

        employeeNumbers.add(employeeNumber);

        validRecords.push({
          employeeNumber,
          dateTime,
          machineNumber,
          importBatchId,
          isManual: false
        });

      } catch (error: any) {
        errors.push({
          line: i + 1,
          content: line,
          error: error.message
        });
      }
    }

    console.log("📊 Resumo do processamento:", {
      totalLinhas: lines.length - 1,
      registrosValidos: validRecords.length,
      erros: errors.length,
      funcionariosEnvolvidos: employeeNumbers.size
    });

    if (validRecords.length === 0) {
      return NextResponse.json(
        { 
          error: "Nenhum registro válido encontrado",
          errors 
        },
        { status: 400 }
      );
    }

    // Buscar funcionários existentes
    const employees = await prisma.employee.findMany({
      where: {
        employeeNumber: {
          in: Array.from(employeeNumbers)
        }
      },
      select: {
        id: true,
        employeeNumber: true,
        name: true
      }
    });

    const employeeMap = new Map(
      employees.map(emp => [emp.employeeNumber, emp])
    );

    // Filtrar registros de funcionários que existem no sistema
    const recordsToInsert = validRecords
      .filter(record => employeeMap.has(record.employeeNumber))
      .map(record => ({
        ...record,
        employeeId: (employeeMap.get(record.employeeNumber) as any)!.id
      }));

    const missingEmployees = Array.from(employeeNumbers)
      .filter(num => !employeeMap.has(num));

    console.log("👥 Funcionários:", {
      encontrados: employees.length,
      faltando: missingEmployees.length,
      registrosParaInserir: recordsToInsert.length
    });

    // Inserir registros no banco
    const result = await prisma.timeRecord.createMany({
      data: recordsToInsert,
      skipDuplicates: true
    });

    return NextResponse.json({
      success: true,
      importBatchId,
      summary: {
        totalLinhas: lines.length - 1,
        registrosProcessados: validRecords.length,
        registrosInseridos: result.count,
        erros: errors.length,
        funcionariosEncontrados: employees.length,
        funcionariosFaltando: missingEmployees.length
      },
      missingEmployees: missingEmployees.map(num => ({
        employeeNumber: num,
        message: "Funcionário não cadastrado no sistema"
      })),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("❌ Erro ao importar registros:", error);
    return NextResponse.json(
      { error: "Erro ao importar registros", details: error.message },
      { status: 500 }
    );
  }
}
