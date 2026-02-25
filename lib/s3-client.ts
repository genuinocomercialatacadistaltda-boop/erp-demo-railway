/**
 * ⚡ Cliente S3 para Frontend
 * Gera URLs assinadas sob demanda (cache local)
 */

const urlCache = new Map<string, { url: string; expires: number }>()
const CACHE_DURATION = 50 * 60 * 1000 // 50 minutos

export async function getSignedImageUrl(cloudStoragePath: string | null | undefined): Promise<string> {
  // Se não houver path, retornar placeholder
  if (!cloudStoragePath || cloudStoragePath === '/placeholder-product.jpg') {
    return '/placeholder-product.jpg'
  }

  // Verificar cache
  const cached = urlCache.get(cloudStoragePath)
  if (cached && cached.expires > Date.now()) {
    return cached.url
  }

  try {
    // Gerar URL assinada via API
    const response = await fetch('/api/s3/sign-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cloudStoragePath })
    })

    if (!response.ok) {
      console.error(`Erro ao gerar URL para ${cloudStoragePath}:`, response.status)
      return '/placeholder-product.jpg'
    }

    const data = await response.json()
    const signedUrl = data.url

    // Salvar no cache
    urlCache.set(cloudStoragePath, {
      url: signedUrl,
      expires: Date.now() + CACHE_DURATION
    })

    return signedUrl
  } catch (error) {
    console.error(`Erro ao gerar URL para ${cloudStoragePath}:`, error)
    return '/placeholder-product.jpg'
  }
}

/**
 * Gerar URLs em lote (mais eficiente)
 */
export async function getBatchSignedUrls(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const pathsToFetch: string[] = []

  // Separar o que já está em cache do que precisa buscar
  for (const path of paths) {
    if (!path || path === '/placeholder-product.jpg') {
      result.set(path, '/placeholder-product.jpg')
      continue
    }

    const cached = urlCache.get(path)
    if (cached && cached.expires > Date.now()) {
      result.set(path, cached.url)
    } else {
      pathsToFetch.push(path)
    }
  }

  // Se não há nada para buscar, retornar resultado
  if (pathsToFetch.length === 0) {
    return result
  }

  try {
    // Buscar URLs em lote
    const response = await fetch('/api/s3/sign-urls-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: pathsToFetch })
    })

    if (!response.ok) {
      console.error('Erro ao gerar URLs em lote:', response.status)
      // Retornar placeholders para os que falharam
      for (const path of pathsToFetch) {
        result.set(path, '/placeholder-product.jpg')
      }
      return result
    }

    const data = await response.json()
    const urls: Record<string, string> = data.urls

    // Processar resultados e atualizar cache
    for (const path of pathsToFetch) {
      const signedUrl = urls[path] || '/placeholder-product.jpg'
      result.set(path, signedUrl)

      if (signedUrl !== '/placeholder-product.jpg') {
        urlCache.set(path, {
          url: signedUrl,
          expires: Date.now() + CACHE_DURATION
        })
      }
    }

    return result
  } catch (error) {
    console.error('Erro ao gerar URLs em lote:', error)
    // Retornar placeholders para os que falharam
    for (const path of pathsToFetch) {
      result.set(path, '/placeholder-product.jpg')
    }
    return result
  }
}
