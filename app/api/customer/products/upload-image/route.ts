
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { uploadFile } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é cliente
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { Customer: true },
    });

    if (!user?.Customer || user.userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso permitido apenas para clientes" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const productId = formData.get("productId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo inválido. Use JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Tamanho máximo: 5MB" },
        { status: 400 }
      );
    }

    // Converter arquivo para buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload para S3 (público para aparecer na loja)
    const cloud_storage_path = await uploadFile(buffer, file.name, file.type);

    console.log('[CUSTOMER_UPLOAD_IMAGE] Upload concluído:', {
      customerId: user.Customer.id,
      productId,
      cloud_storage_path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Se productId foi fornecido, atualizar o produto
    if (productId) {
      // Verificar se o produto pertence ao cliente
      const product = await prisma.clientProduct.findFirst({
        where: {
          id: productId,
          customerId: user.Customer.id,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: "Produto não encontrado" },
          { status: 404 }
        );
      }

      // Atualizar imagem do produto
      const updatedProduct = await prisma.clientProduct.update({
        where: { id: productId },
        data: { imageUrl: cloud_storage_path },
      });

      console.log('[CUSTOMER_UPLOAD_IMAGE] Produto atualizado:', updatedProduct.id);

      return NextResponse.json({
        success: true,
        imageUrl: cloud_storage_path,
        product: updatedProduct,
      });
    }

    // Se não tem productId, retorna apenas a URL da imagem
    return NextResponse.json({
      success: true,
      imageUrl: cloud_storage_path,
    });
  } catch (error) {
    console.error("[CUSTOMER_UPLOAD_IMAGE_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem" },
      { status: 500 }
    );
  }
}
