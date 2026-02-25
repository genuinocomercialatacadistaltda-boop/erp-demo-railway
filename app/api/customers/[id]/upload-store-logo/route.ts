import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/s3'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const customerId = params.id
    console.log(`[UPLOAD_STORE_LOGO] Cliente: ${customerId}`)

    // Verificar permissões (admin ou o próprio cliente)
    const userType = (session.user as any)?.userType
    const sessionCustomerId = (session.user as any)?.customerId
    
    if (userType !== 'ADMIN' && sessionCustomerId !== customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar se o cliente existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Obter o arquivo do FormData
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo (apenas imagens)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Envie apenas imagens (JPEG, PNG, WEBP, GIF)' },
        { status: 400 }
      )
    }

    // Validar tamanho do arquivo (máximo 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo: 5MB' },
        { status: 400 }
      )
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const fileExtension = file.name.split('.').pop()
    const fileName = `store-logo-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}-${randomString}.${fileExtension}`

    // Fazer upload para o S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const cloudStoragePath = await uploadFile(
      buffer,
      fileName,
      file.type
    )

    console.log(`[UPLOAD_STORE_LOGO] Upload concluído: ${cloudStoragePath}`)

    // Atualizar o cliente no banco de dados
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: { storeLogo: cloudStoragePath },
    })

    return NextResponse.json(
      {
        message: 'Logo atualizada com sucesso',
        cloudStoragePath,
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          storeLogo: updatedCustomer.storeLogo,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[UPLOAD_STORE_LOGO_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao fazer upload da logo', details: (error as Error).message },
      { status: 500 }
    )
  }
}
