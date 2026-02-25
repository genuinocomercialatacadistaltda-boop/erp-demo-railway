export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { uploadFile } from '@/lib/s3'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Use JPEG, PNG, WEBP ou GIF.' },
        { status: 400 }
      )
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo: 5MB' },
        { status: 400 }
      )
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split('.').pop()
    const fileName = `raw-materials/${timestamp}-${randomString}.${extension}`

    // Fazer upload para S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const cloudStoragePath = await uploadFile(buffer, fileName)

    console.log('✅ [RAW_MATERIALS_UPLOAD] Imagem enviada com sucesso:', cloudStoragePath)

    return NextResponse.json({ cloudStoragePath })
  } catch (error) {
    console.error('❌ [RAW_MATERIALS_UPLOAD] Erro ao fazer upload:', error)
    return NextResponse.json(
      { error: 'Erro ao fazer upload da imagem' },
      { status: 500 }
    )
  }
}
