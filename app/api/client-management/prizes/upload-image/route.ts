export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { uploadFile } from '@/lib/s3'

/**
 * API de Upload de Imagem de Prêmio do Cliente
 * POST: Faz upload de uma imagem de prêmio para o S3
 */

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userType = (session.user as any)?.userType
    const customerId = (session.user as any)?.customerId

    if (userType !== 'CUSTOMER' || !customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    console.log(`[CLIENT_PRIZE_UPLOAD] Cliente: ${customerId}`)

    // Obter arquivo do FormData
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Envie apenas imagens (JPEG, PNG, WEBP, GIF)' },
        { status: 400 }
      )
    }

    // Validar tamanho (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo: 5MB' },
        { status: 400 }
      )
    }

    // Gerar nome único
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const fileExtension = file.name.split('.').pop()
    const fileName = `client-prizes/${customerId}/${timestamp}-${randomString}.${fileExtension}`

    console.log(`[CLIENT_PRIZE_UPLOAD] Arquivo: ${file.name}, tamanho: ${file.size}, tipo: ${file.type}`)

    // Upload para S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const cloudStoragePath = await uploadFile(buffer, fileName, file.type)

    console.log(`[CLIENT_PRIZE_UPLOAD] Upload concluído: ${cloudStoragePath}`)

    return NextResponse.json(
      {
        message: 'Upload concluído com sucesso',
        cloudStoragePath,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[CLIENT_PRIZE_UPLOAD_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao fazer upload', details: (error as Error).message },
      { status: 500 }
    )
  }
}
