
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/s3";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const payment = await prisma.employeePayment.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        payrollSheet: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Pagamento não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("[PAYMENT_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pagamento" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { notes } = body;

    const payment = await prisma.employeePayment.update({
      where: { id: params.id },
      data: { notes },
    });

    console.log("[PAYMENT_PUT] Pagamento atualizado:", params.id);

    return NextResponse.json(payment);
  } catch (error) {
    console.error("[PAYMENT_PUT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar pagamento" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const paymentId = formData.get("paymentId") as string;
    const file = formData.get("file") as File;

    if (!paymentId || !file) {
      return NextResponse.json(
        { error: "ID do pagamento e arquivo são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o pagamento existe
    const payment = await prisma.employeePayment.findUnique({
      where: { id: paymentId },
      include: { employee: true },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Pagamento não encontrado" },
        { status: 404 }
      );
    }

    // Upload do contracheque assinado
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `signed-payslips/${payment.year}/${payment.month}/${payment.employee.employeeNumber}-${Date.now()}.pdf`;
    const fileUrl = await uploadFile(buffer, fileName);

    console.log("[PAYMENT_UPLOAD] Contracheque assinado enviado:", fileUrl);

    // Atualizar pagamento
    const updated = await prisma.employeePayment.update({
      where: { id: paymentId },
      data: { signedPayslipUrl: fileUrl },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PAYMENT_UPLOAD] Error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload do contracheque" },
      { status: 500 }
    );
  }
}
