import { NextRequest, NextResponse } from 'next/server'
import { getImageUrl } from '@/lib/s3'

export const dynamic = 'force-dynamic'

/**
 * ⚡ API para gerar URLs S3 assinadas em LOTE
 * Muito mais eficiente que fazer uma requisição por produto
 */
export async function POST(request: NextRequest) {
  try {
    const { paths } = await request.json()

    if (!Array.isArray(paths)) {
      return NextResponse.json(
        { error: 'paths deve ser um array' },
        { status: 400 }
      )
    }

    console.log(`⚡ [S3_BATCH] Gerando URLs para ${paths.length} imagens...`)
    const startTime = Date.now()

    // Gerar todas as URLs em paralelo
    const results = await Promise.all(
      paths.map(async (path: string) => {
        try {
          if (!path || path === '/placeholder-product.jpg') {
            return { path, url: '/placeholder-product.jpg' }
          }
          const url = await getImageUrl(path)
          return { path, url }
        } catch (error) {
          console.error(`❌ Erro ao gerar URL para ${path}:`, error)
          return { path, url: '/placeholder-product.jpg' }
        }
      })
    )

    // Converter array para objeto {path: url}
    const urls: Record<string, string> = {}
    for (const result of results) {
      urls[result.path] = result.url
    }

    const totalTime = Date.now() - startTime
    console.log(`✅ [S3_BATCH] ${paths.length} URLs geradas em ${totalTime}ms (média: ${Math.round(totalTime / paths.length)}ms/url)`)

    return NextResponse.json({ urls })
  } catch (error) {
    console.error('❌ [S3_BATCH] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar URLs' },
      { status: 500 }
    )
  }
}
