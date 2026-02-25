
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Recurso temporariamente desabilitado - modelo WasteRecord não existe

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    { error: "Recurso temporariamente indisponível" },
    { status: 503 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    { error: "Recurso temporariamente indisponível" },
    { status: 503 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    { error: "Recurso temporariamente indisponível" },
    { status: 503 }
  );
}
