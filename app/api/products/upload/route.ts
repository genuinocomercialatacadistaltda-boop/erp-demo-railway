export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { uploadFile } from "@/lib/s3";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (user?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo inválido. Use JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Tamanho máximo: 5MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const cloud_storage_path = await uploadFile(buffer, file.name, file.type);

    return NextResponse.json({
      success: true,
      imageUrl: cloud_storage_path,
    });
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem" },
      { status: 500 }
    );
  }
}
