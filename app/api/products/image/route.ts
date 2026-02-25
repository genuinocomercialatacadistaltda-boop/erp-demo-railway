
import { NextRequest, NextResponse } from "next/server";
import { downloadFile } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Chave da imagem não fornecida" },
        { status: 400 }
      );
    }

    // Generate signed URL
    const signedUrl = await downloadFile(key);

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Erro ao obter imagem:", error);
    return NextResponse.json(
      { error: "Erro ao obter imagem" },
      { status: 500 }
    );
  }
}
