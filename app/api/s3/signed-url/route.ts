import { NextRequest, NextResponse } from 'next/server'
import { getImageUrl } from '@/lib/s3'

export const dynamic = 'force-dynamic'

/**
 * API para gerar URLs S3 assinadas de forma lazy
 * Usado pelo hook useS3Image no frontend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key } = body

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Key é obrigatória' },
        { status: 400 }
      )
    }

    // Gerar URL assinada (com cache interno)
    const signedUrl = await getImageUrl(key)

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    console.error('[S3_SIGNED_URL] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar URL', url: '/placeholder-product.jpg' },
      { status: 500 }
    )
  }
}
