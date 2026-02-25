export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/s3";

/**
 * API para gerenciar folhas de pagamento (PDFs da contabilidade)
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const isProcessed = searchParams.get("isProcessed");

    const where: any = {};
    
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (isProcessed !== null) where.isProcessed = isProcessed === "true";

    const sheets = await prisma.payrollSheet.findMany({
      where,
      include: {
        payments: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" },
      ],
    });

    console.log("[PAYROLL_SHEETS_GET] Folhas encontradas:", sheets.length);

    return NextResponse.json(sheets);
  } catch (error) {
    console.error("[PAYROLL_SHEETS_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar folhas de pagamento" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("[PAYROLL_SHEETS_POST] Iniciando upload de folha de pagamento");
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      console.log("[PAYROLL_SHEETS_POST] Acesso negado - usuário não é admin");
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const monthStr = formData.get("month") as string;
    const yearStr = formData.get("year") as string;
    const notes = (formData.get("notes") as string) || "";

    console.log("[PAYROLL_SHEETS_POST] Dados recebidos:", {
      hasFile: !!file,
      month: monthStr,
      year: yearStr,
      notes: notes?.substring(0, 50),
    });

    if (!file || !monthStr || !yearStr) {
      console.log("[PAYROLL_SHEETS_POST] Dados incompletos");
      return NextResponse.json(
        { error: "Arquivo, mês e ano são obrigatórios" },
        { status: 400 }
      );
    }

    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    // Validar mês
    if (month < 1 || month > 12 || isNaN(month)) {
      console.log("[PAYROLL_SHEETS_POST] Mês inválido:", month);
      return NextResponse.json(
        { error: "Mês inválido" },
        { status: 400 }
      );
    }

    // PERMITE múltiplas folhas para o mesmo mês/ano
    // (adiantamento, vale alimentação, pagamento, premiação, etc.)
    console.log("[PAYROLL_SHEETS_POST] Sistema permite múltiplas folhas para o mesmo período");

    // Upload do arquivo para S3
    console.log("[PAYROLL_SHEETS_POST] Iniciando upload para S3");
    const buffer = Buffer.from(await file.arrayBuffer());
    const s3FileName = `payroll-sheets/${year}/${month}/${Date.now()}-${file.name}`;
    const fileUrl = await uploadFile(buffer, s3FileName);

    console.log("[PAYROLL_SHEETS_POST] Arquivo enviado:", fileUrl);

    // Criar registro da folha
    const sheet = await prisma.payrollSheet.create({
      data: {
        month,
        year,
        fileUrl,
        fileName: file.name,
        uploadedBy: session.user.email || "",
        notes: notes || undefined,
      },
    });

    console.log("[PAYROLL_SHEETS_POST] Folha criada com sucesso:", sheet.id);

    return NextResponse.json(sheet);
  } catch (error: any) {
    console.error("[PAYROLL_SHEETS_POST] Error completo:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { error: `Erro ao criar folha de pagamento: ${error?.message || "Erro desconhecido"}` },
      { status: 500 }
    );
  }
}
